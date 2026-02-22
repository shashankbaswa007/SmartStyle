import { db } from '@/lib/firebase';
import { collection, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import crypto from 'crypto';

// Server-side API routes have no request.auth context, so Firestore
// security rules reject all reads/writes with PERMISSION_DENIED.
const isServerSide = typeof window === 'undefined';

export class FirestoreCache {
  private cacheCollection = 'apiCache';
  
  private generateCacheKey(params: {
    imageHash: string;
    colors: string[];
    gender: string;
    occasion?: string;
  }): string {
    const normalized = {
      imageHash: params.imageHash.substring(0, 16),
      colors: params.colors.sort().join(','),
      gender: params.gender,
      occasion: params.occasion?.toLowerCase() || 'casual',
    };
    return crypto.createHash('md5').update(JSON.stringify(normalized)).digest('hex');
  }
  
  async get<T>(params: {
    imageHash: string;
    colors: string[];
    gender: string;
    occasion?: string;
  }): Promise<T | null> {
    // Server-side: Firestore client SDK lacks auth context — skip
    if (isServerSide) return null;

    try {
      const cacheKey = this.generateCacheKey(params);
      const docRef = doc(db, this.cacheCollection, cacheKey);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      const expiresAt = data.expiresAt?.toDate();
      
      // Check if expired (1 hour TTL)
      if (expiresAt && expiresAt < new Date()) {
        return null;
      }
      
      return data.result as T;
    } catch (error) {
      return null;
    }
  }
  
  async set<T>(params: {
    imageHash: string;
    colors: string[];
    gender: string;
    occasion?: string;
  }, result: T, ttlSeconds: number = 3600): Promise<void> {
    // Server-side: Firestore client SDK lacks auth context — skip
    if (isServerSide) return;

    try {
      const cacheKey = this.generateCacheKey(params);
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      
      await setDoc(doc(db, this.cacheCollection, cacheKey), {
        result,
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: Timestamp.now(),
        params: {
          colors: params.colors,
          gender: params.gender,
          occasion: params.occasion,
        }
      });
      
    } catch (error) {
      // Non-critical error, continue without caching
    }
  }
}
