import { db } from '@/lib/firebase';
import { collection, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import crypto from 'crypto';

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
    try {
      const cacheKey = this.generateCacheKey(params);
      const docRef = doc(db, this.cacheCollection, cacheKey);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        console.log('❌ Cache MISS - generating new recommendations');
        return null;
      }
      
      const data = docSnap.data();
      const expiresAt = data.expiresAt?.toDate();
      
      // Check if expired (1 hour TTL)
      if (expiresAt && expiresAt < new Date()) {
        console.log('⏰ Cache EXPIRED - generating new recommendations');
        return null;
      }
      
      console.log('🎯 Cache HIT - returning cached recommendations (saves API calls!)');
      return data.result as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  async set<T>(params: {
    imageHash: string;
    colors: string[];
    gender: string;
    occasion?: string;
  }, result: T, ttlSeconds: number = 3600): Promise<void> {
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
      
      console.log('💾 Cached result for 1 hour');
    } catch (error) {
      console.error('Cache set error:', error);
      // Non-critical error, continue without caching
    }
  }
}
