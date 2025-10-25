// Lightweight Firestore helper for saving recommendation metadata.
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function saveRecommendation(userId: string, payload: any, customId?: string): Promise<string | null> {
  try {
    // Use custom ID if provided, otherwise generate a new one
    const docId = customId || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const docRef = doc(db, `users/${userId}/recommendationHistory/${docId}`);
    
    await setDoc(docRef, {
      ...payload,
      createdAt: serverTimestamp(),
    });
    
    console.log(`✅ Recommendation saved to recommendationHistory: ${docId}`);
    return docId;
  } catch (err) {
    console.warn('Failed to save recommendation', err);
    return null;
  }
}

export default saveRecommendation;
