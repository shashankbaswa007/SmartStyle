// Lightweight Firestore helper for saving recommendation metadata.
// Server-side only - uses Firebase Admin SDK (production) or skips in development
import { getFirestore, FieldValue } from '@/lib/firebase-admin';

/**
 * Retry helper with exponential backoff for transient failures
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  operationName: string = 'operation'
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`❌ ${operationName} failed after ${maxRetries} attempts:`, error);
        throw error;
      }
      
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.warn(`⚠️ ${operationName} attempt ${attempt}/${maxRetries} failed. Retrying in ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  
  throw new Error(`${operationName} failed unexpectedly`);
}

export async function saveRecommendation(userId: string, payload: any, customId?: string): Promise<string | null> {
  try {
    // Validate inputs
    if (!userId || userId.trim() === '') {
      console.error('❌ Invalid userId provided to saveRecommendation');
      return null;
    }

    if (!payload || typeof payload !== 'object') {
      console.error('❌ Invalid payload provided to saveRecommendation');
      return null;
    }

    // Check if we have Firebase credentials (optional for development)
    const hasCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (!hasCredentials) {
      console.warn('⚠️ Firebase Admin credentials not found - skipping recommendation save (development mode)');
      console.warn('ℹ️ To enable persistence, add FIREBASE_SERVICE_ACCOUNT_KEY to .env.local');
      // Return a temporary ID for development
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`✅ Using temporary ID (not persisted): ${tempId}`);
      return tempId;
    }

    // Use custom ID if provided, otherwise generate a new one
    const docId = customId || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use Admin SDK for server-side writes with retry logic
    const db = getFirestore();
    const docRef = db.collection('users').doc(userId).collection('recommendationHistory').doc(docId);
    
    // Retry the set operation up to 3 times with exponential backoff
    await retryOperation(
      async () => {
        await docRef.set({
          ...payload,
          createdAt: FieldValue.serverTimestamp(),
          userId, // Include userId in document for easier querying
        });
      },
      3,
      'saveRecommendation'
    );
    
    console.log(`✅ Recommendation saved to recommendationHistory: ${docId}`);
    return docId;
  } catch (err) {
    console.error('❌ Failed to save recommendation:', err);
    // Log more details for debugging
    if (err instanceof Error) {
      console.error('Error details:', err.message);
      
      // Provide helpful guidance for common errors
      if (err.message.includes('default credentials')) {
        console.warn('ℹ️ Firebase Admin credentials not configured');
        console.warn('ℹ️ Add FIREBASE_SERVICE_ACCOUNT_KEY to .env.local for production persistence');
      }
    }
    
    // Return null but don't crash the application
    console.warn('⚠️ Recommendation not persisted - returning temporary ID');
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default saveRecommendation;
