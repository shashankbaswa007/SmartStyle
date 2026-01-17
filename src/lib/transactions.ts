/**
 * Firestore Transaction Utilities
 * 
 * Provides atomic transaction operations for multi-step database operations.
 * Ensures data consistency by rolling back all changes if any step fails.
 * 
 * Usage:
 * - Use transactions for operations that update multiple documents
 * - Transaction will automatically retry on conflicts
 * - All operations are atomic - either all succeed or all fail
 */

import { db } from '@/lib/firebase';
import {
  runTransaction,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
  DocumentReference,
} from 'firebase/firestore';
import { validateData, likedOutfitSchema, userPreferencesUpdateSchema } from './validation/schemas';
// import { logAuditEvent } from './audit-log';
import type { LikedOutfit, UserPreferencesUpdate } from './validation/schemas';

// ============================================
// LIKE OUTFIT TRANSACTION
// ============================================

/**
 * Atomically like an outfit and update user preferences
 * 
 * Steps:
 * 1. Add outfit to likedOutfits collection
 * 2. Update userPreferences (increment totalLikes, update colorWeights)
 * 3. Log audit event
 * 
 * @param userId - User ID
 * @param outfit - Outfit data to like
 * @param colorWeights - Updated color weights after liking
 * @returns Promise<void>
 * @throws Error if transaction fails
 */
export async function likeOutfitTransaction(
  userId: string,
  outfit: Omit<LikedOutfit, 'userId' | 'likedAt'>,
  colorWeights?: Record<string, number>
): Promise<void> {
  // Validate outfit data before transaction
  const likedOutfitData = validateData(likedOutfitSchema, {
    ...outfit,
    userId,
    likedAt: new Date(),
    wornCount: 0,
  }) as LikedOutfit;

  await runTransaction(db, async (transaction) => {
    // References
    const outfitRef = doc(db, 'users', userId, 'likedOutfits', outfit.id);
    const prefsRef = doc(db, 'userPreferences', userId);

    // Read current preferences
    const prefsSnap = await transaction.get(prefsRef);
    const currentPrefs = prefsSnap.data();

    // Prepare update data
    const prefsUpdate: Partial<UserPreferencesUpdate> = {
      userId,
      totalLikes: currentPrefs?.totalLikes ? currentPrefs.totalLikes + 1 : 1,
      updatedAt: new Date(),
      lastRecommendationAt: new Date(),
    };

    // Update color weights if provided
    if (colorWeights) {
      prefsUpdate.colorWeights = colorWeights;
    }

    // Update recent liked outfit IDs (keep last 10)
    const recentLikedIds = currentPrefs?.recentLikedOutfitIds || [];
    prefsUpdate.recentLikedOutfitIds = [outfit.id, ...recentLikedIds.slice(0, 9)];

    // Validate preferences update
    const validatedPrefsUpdate = validateData(userPreferencesUpdateSchema, prefsUpdate);

    // Execute transaction steps
    transaction.set(outfitRef, {
      ...likedOutfitData,
      likedAt: Timestamp.fromDate(likedOutfitData.likedAt as Date),
    });

    if (prefsSnap.exists()) {
      transaction.update(prefsRef, {
        ...validatedPrefsUpdate,
        updatedAt: Timestamp.now(),
      });
    } else {
      // Create preferences if they don't exist
      transaction.set(prefsRef, {
        userId,
        favoriteColors: [],
        dislikedColors: [],
        preferredOccasions: [],
        totalLikes: 1,
        totalDislikes: 0,
        totalRecommendations: 0,
        recentLikedOutfitIds: [outfit.id],
        colorWeights: colorWeights || {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  });

  // Log audit event after successful transaction
  await logAuditEvent({
    userId,
    action: 'like',
    collection: 'likedOutfits',
    documentId: outfit.id,
    newData: likedOutfitData,
  });
}

// ============================================
// UNLIKE OUTFIT TRANSACTION
// ============================================

/**
 * Atomically unlike an outfit and update user preferences
 * 
 * @param userId - User ID
 * @param outfitId - Outfit ID to unlike
 * @param colorWeights - Updated color weights after unliking
 */
export async function unlikeOutfitTransaction(
  userId: string,
  outfitId: string,
  colorWeights?: Record<string, number>
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const outfitRef = doc(db, 'users', userId, 'likedOutfits', outfitId);
    const prefsRef = doc(db, 'userPreferences', userId);

    // Read current data
    const outfitSnap = await transaction.get(outfitRef);
    const prefsSnap = await transaction.get(prefsRef);

    if (!outfitSnap.exists()) {
      throw new Error(`Outfit ${outfitId} not found in liked outfits`);
    }

    const previousData = outfitSnap.data();
    const currentPrefs = prefsSnap.data();

    // Remove from liked outfits
    transaction.delete(outfitRef);

    // Update preferences
    if (prefsSnap.exists()) {
      const recentLikedIds = (currentPrefs?.recentLikedOutfitIds || []).filter(
        (id: string) => id !== outfitId
      );

      transaction.update(prefsRef, {
        totalLikes: increment(-1),
        recentLikedOutfitIds: recentLikedIds,
        colorWeights: colorWeights || currentPrefs?.colorWeights || {},
        updatedAt: Timestamp.now(),
      });
    }

    // Log audit event (will be executed after transaction)
    await logAuditEvent({
      userId,
      action: 'delete',
      collection: 'likedOutfits',
      documentId: outfitId,
      previousData,
    });
  });
}

// ============================================
// UPDATE PREFERENCES TRANSACTION
// ============================================

/**
 * Atomically update user preferences with validation
 * 
 * @param userId - User ID
 * @param updates - Partial preferences to update
 */
export async function updatePreferencesTransaction(
  userId: string,
  updates: Partial<UserPreferencesUpdate>
): Promise<void> {
  // Validate updates
  const validatedUpdates = validateData(userPreferencesUpdateSchema, {
    userId,
    ...updates,
    updatedAt: new Date(),
  });

  await runTransaction(db, async (transaction) => {
    const prefsRef = doc(db, 'userPreferences', userId);
    const prefsSnap = await transaction.get(prefsRef);

    const previousData = prefsSnap.data();

    if (prefsSnap.exists()) {
      transaction.update(prefsRef, {
        ...validatedUpdates,
        updatedAt: Timestamp.now(),
      });
    } else {
      transaction.set(prefsRef, {
        favoriteColors: [],
        dislikedColors: [],
        preferredOccasions: [],
        totalLikes: 0,
        totalDislikes: 0,
        totalRecommendations: 0,
        recentLikedOutfitIds: [],
        ...validatedUpdates,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    // Log preference change
    await logAuditEvent({
      userId,
      action: 'preference_change',
      collection: 'userPreferences',
      documentId: userId,
      changes: validatedUpdates,
      previousData,
      newData: validatedUpdates,
    });
  });
}

// ============================================
// MARK OUTFIT AS WORN TRANSACTION
// ============================================

/**
 * Atomically mark outfit as worn and update usage statistics
 * 
 * @param userId - User ID
 * @param outfitId - Outfit ID
 * @param usageData - Usage details (occasion, weather, notes)
 */
export async function markOutfitWornTransaction(
  userId: string,
  outfitId: string,
  usageData: {
    occasion: string;
    weatherConditions?: { temperature: number; condition: string };
    notes?: string;
    rating?: number;
  }
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const outfitRef = doc(db, 'users', userId, 'likedOutfits', outfitId);
    const usageRef = doc(db, 'users', userId, 'outfitUsage', `${outfitId}_${Date.now()}`);

    // Read current outfit
    const outfitSnap = await transaction.get(outfitRef);

    if (!outfitSnap.exists()) {
      throw new Error(`Outfit ${outfitId} not found`);
    }

    // Update worn count and last worn date
    transaction.update(outfitRef, {
      wornCount: increment(1),
      lastWornAt: Timestamp.now(),
    });

    // Create usage record
    transaction.set(usageRef, {
      id: usageRef.id,
      userId,
      outfitId,
      occasion: usageData.occasion,
      wornAt: Timestamp.now(),
      weatherConditions: usageData.weatherConditions,
      notes: usageData.notes,
      rating: usageData.rating,
    });

    // Log audit event
    await logAuditEvent({
      userId,
      action: 'worn',
      collection: 'outfitUsage',
      documentId: usageRef.id,
      newData: usageData,
    });
  });
}

// ============================================
// FEEDBACK TRANSACTION
// ============================================

/**
 * Atomically record feedback and update user preferences
 * 
 * @param userId - User ID
 * @param recommendationId - Recommendation ID
 * @param feedbackType - Type of feedback (like, dislike, neutral)
 * @param colors - Colors from the recommendation
 * @param occasion - Occasion from the recommendation
 */
export async function submitFeedbackTransaction(
  userId: string,
  recommendationId: string,
  feedbackType: 'like' | 'dislike' | 'neutral',
  colors?: string[],
  occasion?: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const feedbackRef = doc(db, 'users', userId, 'feedback', recommendationId);
    const prefsRef = doc(db, 'userPreferences', userId);
    const historyRef = doc(db, 'users', userId, 'recommendationHistory', recommendationId);

    // Read current preferences
    const prefsSnap = await transaction.get(prefsRef);
    const currentPrefs = prefsSnap.data();

    // Create feedback document
    transaction.set(feedbackRef, {
      id: recommendationId,
      userId,
      recommendationId,
      type: feedbackType,
      colors,
      occasion,
      createdAt: Timestamp.now(),
    });

    // Update recommendation history
    transaction.update(historyRef, {
      feedback: feedbackType === 'like' ? 'liked' : feedbackType === 'dislike' ? 'disliked' : 'neutral',
      feedbackAt: Timestamp.now(),
    });

    // Update preferences based on feedback
    if (prefsSnap.exists()) {
      const updates: any = {
        updatedAt: Timestamp.now(),
      };

      if (feedbackType === 'like') {
        updates.totalLikes = increment(1);
      } else if (feedbackType === 'dislike') {
        updates.totalDislikes = increment(1);
      }

      transaction.update(prefsRef, updates);
    }

    // Log audit event
    await logAuditEvent({
      userId,
      action: feedbackType === 'like' ? 'like' : 'dislike',
      collection: 'feedback',
      documentId: recommendationId,
      newData: {
        type: feedbackType,
        colors,
        occasion,
      },
    });
  });
}

// ============================================
// BATCH DELETE WITH AUDIT TRANSACTION
// ============================================

/**
 * Atomically delete multiple documents with audit logging
 * 
 * @param userId - User ID
 * @param collection - Collection name
 * @param documentIds - Array of document IDs to delete
 */
export async function batchDeleteTransaction(
  userId: string,
  collection: string,
  documentIds: string[]
): Promise<void> {
  if (documentIds.length > 500) {
    throw new Error('Cannot delete more than 500 documents in a single transaction');
  }

  await runTransaction(db, async (transaction) => {
    const deletedData: Record<string, any> = {};

    // Read all documents first
    for (const docId of documentIds) {
      const docRef = doc(db, 'users', userId, collection, docId);
      const docSnap = await transaction.get(docRef);

      if (docSnap.exists()) {
        deletedData[docId] = docSnap.data();
        transaction.delete(docRef);
      }
    }

    // Log audit event for batch delete
    await logAuditEvent({
      userId,
      action: 'delete',
      collection,
      documentId: `batch_${documentIds.length}_items`,
      previousData: deletedData,
      metadata: {
        deletedCount: Object.keys(deletedData).length,
      },
    });
  });
}

// ============================================
// GENERIC TRANSACTION WRAPPER
// ============================================

/**
 * Generic transaction wrapper with automatic retry and error handling
 * 
 * @param operation - Transaction operation function
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns Promise<T>
 */
export async function executeTransaction<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      if (error instanceof Error && error.message.includes('contention')) {
        console.warn(`Transaction failed due to contention, retrying (${attempt}/${maxRetries})...`);
        
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
        continue;
      }
      
      // Non-retryable error, throw immediately
      throw error;
    }
  }

  throw new Error(`Transaction failed after ${maxRetries} attempts: ${lastError?.message}`);
}

// ============================================
// AUDIT LOGGING
// ============================================

/**
 * Log an audit event for tracking user actions
 * 
 * @param event - Audit event details
 */
async function logAuditEvent(event: {
  userId: string;
  action: string;
  collection: string;
  documentId: string;
  newData?: any;
  previousData?: any;
  changes?: any;
  metadata?: any;
}): Promise<void> {
  try {
    const auditRef = doc(db, 'auditLogs', `${event.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    
    await setDoc(auditRef, {
      ...event,
      timestamp: Timestamp.now(),
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    // Log error but don't throw - audit logging should not break main operations
    console.error('Failed to log audit event:', error);
  }
}

