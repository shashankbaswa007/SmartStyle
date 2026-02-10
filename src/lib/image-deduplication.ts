import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

// Server-side API routes have no request.auth context, so Firestore
// security rules reject all reads/writes with PERMISSION_DENIED.
const isServerSide = typeof window === 'undefined';

export async function checkDuplicateImage(userId: string, imageHash: string) {
  // Server-side: Firestore client SDK lacks auth context — skip
  if (isServerSide) return null;

  try {
    // Check if this exact image was processed in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const q = query(
      collection(db, 'recommendationHistory'),
      where('userId', '==', userId),
      where('imageHash', '==', imageHash),
      where('createdAt', '>', Timestamp.fromDate(oneDayAgo))
    );
    
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const existingResult = snapshot.docs[0].data();
      console.log('🔄 Found duplicate image from last 24h - returning cached recommendations');
      return {
        ...existingResult,
        fromCache: true,
        cacheSource: '24h-history',
      };
    }
    
    return null;
  } catch (error) {
    console.error('Deduplication check error:', error);
    return null; // Continue with normal processing if check fails
  }
}

export function generateImageHash(base64Image: string): string {
  // Hash first 5000 characters for speed (enough to identify unique images)
  const crypto = require('crypto');
  return crypto.createHash('md5')
    .update(base64Image.substring(0, 5000))
    .digest('hex');
}
