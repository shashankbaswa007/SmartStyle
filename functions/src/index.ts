/**
 * Cloud Functions for SmartStyle
 * 
 * Scheduled maintenance jobs:
 * - cleanupOrphanedImages: Remove unused images from Firebase Storage
 * - archiveOldRecommendations: Move old recommendations to cold storage
 * - cleanupExpiredCache: Remove expired cache entries
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as https from 'https';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

// ============================================
// CLEANUP ORPHANED IMAGES
// ============================================

/**
 * Runs daily at 2:00 AM UTC
 * Deletes Firebase Storage images not referenced in Firestore
 */
export const cleanupOrphanedImages = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes
    memory: '1GB',
  })
  .pubsub.schedule('0 2 * * *') // Daily at 2:00 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('🧹 Starting orphaned images cleanup...');

    const startTime = Date.now();
    let processedCount = 0;
    let deletedCount = 0;
    const errors: string[] = [];

    try {
      const bucket = storage.bucket();

      // Get all images from storage
      const [files] = await bucket.getFiles({
        prefix: 'user-uploads/', // Adjust path as needed
      });

      console.log(`📦 Found ${files.length} files in storage`);

      for (const file of files) {
        try {
          processedCount++;
          const imagePath = file.name;

          // Check if image is referenced in any Firestore collection
          const isReferenced = await checkImageReferences(imagePath);

          if (!isReferenced) {
            // Check file age (only delete if older than 7 days)
            const [metadata] = await file.getMetadata();
            const uploadDate = new Date(metadata.timeCreated || Date.now());
            const daysSinceUpload = (Date.now() - uploadDate.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceUpload > 7) {
              await file.delete();
              deletedCount++;
              console.log(`🗑️  Deleted orphaned image: ${imagePath}`);
            } else {
              console.log(`⏳ Skipping recent file (${daysSinceUpload.toFixed(1)} days old): ${imagePath}`);
            }
          }
        } catch (error) {
          const errorMsg = `Failed to process ${file.name}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Log cleanup results to Firestore
      await db.collection('cleanupJobs').add({
        jobId: `cleanup_images_${Date.now()}`,
        jobType: 'orphaned_images',
        startedAt: admin.firestore.Timestamp.fromMillis(startTime),
        completedAt: admin.firestore.Timestamp.now(),
        itemsProcessed: processedCount,
        itemsDeleted: deletedCount,
        errors,
        status: errors.length === 0 ? 'success' : 'partial_success',
      });

      console.log(`✅ Cleanup completed: ${deletedCount}/${processedCount} images deleted`);
      return { success: true, deleted: deletedCount, processed: processedCount };
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  });

/**
 * Check if image is referenced in Firestore collections
 */
async function checkImageReferences(imagePath: string): Promise<boolean> {
  try {
    // Check in likedOutfits
    const likedOutfitsQuery = await db
      .collectionGroup('likedOutfits')
      .where('imageUrl', '==', imagePath)
      .limit(1)
      .get();

    if (!likedOutfitsQuery.empty) return true;

    // Check in recommendationHistory
    const recommendationsQuery = await db
      .collectionGroup('recommendationHistory')
      .where('imageUrl', '==', imagePath)
      .limit(1)
      .get();

    if (!recommendationsQuery.empty) return true;

    // Check in outfitUsage
    const usageQuery = await db
      .collectionGroup('outfitUsage')
      .where('photos', 'array-contains', imagePath)
      .limit(1)
      .get();

    if (!usageQuery.empty) return true;

    return false;
  } catch (error) {
    console.error('❌ Error checking image references:', error);
    return true; // Assume referenced if check fails (safer)
  }
}

// ============================================
// ARCHIVE OLD RECOMMENDATIONS
// ============================================

/**
 * Runs weekly on Sunday at 3:00 AM UTC
 * Archives recommendation history older than 6 months to cold storage
 */
export const archiveOldRecommendations = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
  })
  .pubsub.schedule('0 3 * * 0') // Weekly on Sunday at 3:00 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('📦 Starting old recommendations archival...');

    const startTime = Date.now();
    let processedCount = 0;
    let archivedCount = 0;
    const errors: string[] = [];

    try {
      // Calculate cutoff date (6 months ago)
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 6);

      // Query old recommendations
      const usersSnapshot = await db.collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        try {
          const userId = userDoc.id;
          const recommendationsRef = db
            .collection('users')
            .doc(userId)
            .collection('recommendationHistory');

          const oldRecsQuery = await recommendationsRef
            .where('createdAt', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
            .get();

          console.log(`📊 User ${userId}: ${oldRecsQuery.size} old recommendations`);

          // Batch archive recommendations
          const batch = db.batch();
          let batchCount = 0;

          for (const recDoc of oldRecsQuery.docs) {
            try {
              processedCount++;

              // Copy to archive collection
              const archiveRef = db
                .collection('users')
                .doc(userId)
                .collection('recommendationHistoryArchive')
                .doc(recDoc.id);

              batch.set(archiveRef, {
                ...recDoc.data(),
                archivedAt: admin.firestore.Timestamp.now(),
              });

              // Delete from main collection
              batch.delete(recDoc.ref);

              batchCount++;
              archivedCount++;

              // Commit batch every 500 operations (Firestore limit)
              if (batchCount >= 500) {
                await batch.commit();
                console.log(`✅ Archived batch of ${batchCount} recommendations`);
                batchCount = 0;
              }
            } catch (error) {
              const errorMsg = `Failed to archive ${recDoc.id}: ${error}`;
              console.error(`❌ ${errorMsg}`);
              errors.push(errorMsg);
            }
          }

          // Commit remaining items
          if (batchCount > 0) {
            await batch.commit();
            console.log(`✅ Archived final batch of ${batchCount} recommendations`);
          }
        } catch (error) {
          const errorMsg = `Failed to process user ${userDoc.id}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Log archival results
      await db.collection('cleanupJobs').add({
        jobId: `archive_recommendations_${Date.now()}`,
        jobType: 'old_recommendations',
        startedAt: admin.firestore.Timestamp.fromMillis(startTime),
        completedAt: admin.firestore.Timestamp.now(),
        itemsProcessed: processedCount,
        itemsDeleted: archivedCount,
        errors,
        status: errors.length === 0 ? 'success' : 'partial_success',
      });

      console.log(`✅ Archival completed: ${archivedCount}/${processedCount} recommendations archived`);
      return { success: true, archived: archivedCount, processed: processedCount };
    } catch (error) {
      console.error('❌ Archival failed:', error);
      throw error;
    }
  });

// ============================================
// CLEANUP EXPIRED AUDIT LOGS
// ============================================

/**
 * Runs monthly on the 1st at 4:00 AM UTC
 * Archives audit logs older than 12 months
 */
export const archiveOldAuditLogs = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
  })
  .pubsub.schedule('0 4 1 * *') // Monthly on 1st at 4:00 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('📝 Starting audit logs archival...');

    const startTime = Date.now();
    let processedCount = 0;
    let archivedCount = 0;
    const errors: string[] = [];

    try {
      // Calculate cutoff date (12 months ago)
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 12);

      const oldLogsQuery = await db
        .collection('auditLogs')
        .where('timestamp', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
        .limit(1000) // Process in batches
        .get();

      console.log(`📊 Found ${oldLogsQuery.size} old audit logs`);

      const batch = db.batch();
      let batchCount = 0;

      for (const logDoc of oldLogsQuery.docs) {
        try {
          processedCount++;

          // Copy to archive collection
          const archiveRef = db.collection('auditLogsArchive').doc(logDoc.id);
          batch.set(archiveRef, {
            ...logDoc.data(),
            archivedAt: admin.firestore.Timestamp.now(),
          });

          // Delete from main collection
          batch.delete(logDoc.ref);

          batchCount++;
          archivedCount++;

          // Commit batch every 500 operations
          if (batchCount >= 500) {
            await batch.commit();
            console.log(`✅ Archived batch of ${batchCount} audit logs`);
            batchCount = 0;
          }
        } catch (error) {
          const errorMsg = `Failed to archive ${logDoc.id}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Commit remaining items
      if (batchCount > 0) {
        await batch.commit();
        console.log(`✅ Archived final batch of ${batchCount} audit logs`);
      }

      // Log cleanup results
      await db.collection('cleanupJobs').add({
        jobId: `archive_audit_logs_${Date.now()}`,
        jobType: 'expired_cache',
        startedAt: admin.firestore.Timestamp.fromMillis(startTime),
        completedAt: admin.firestore.Timestamp.now(),
        itemsProcessed: processedCount,
        itemsDeleted: archivedCount,
        errors,
        status: errors.length === 0 ? 'success' : 'partial_success',
      });

      console.log(`✅ Archival completed: ${archivedCount}/${processedCount} audit logs archived`);
      return { success: true, archived: archivedCount, processed: processedCount };
    } catch (error) {
      console.error('❌ Archival failed:', error);
      throw error;
    }
  });

// ============================================
// CLEANUP DELETED ITEMS (NON-RECOVERABLE)
// ============================================

/**
 * Runs monthly on the 15th at 5:00 AM UTC
 * Permanently removes deleted items older than 90 days
 */
export const cleanupOldDeletedItems = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB',
  })
  .pubsub.schedule('0 5 15 * *') // Monthly on 15th at 5:00 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('🗑️  Starting old deleted items cleanup...');

    const startTime = Date.now();
    let processedCount = 0;
    let deletedCount = 0;
    const errors: string[] = [];

    try {
      // Calculate cutoff date (90 days ago)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const oldDeletedQuery = await db
        .collection('deletedItems')
        .where('deletedAt', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
        .where('canRecover', '==', true)
        .limit(500)
        .get();

      console.log(`📊 Found ${oldDeletedQuery.size} old deleted items`);

      const batch = db.batch();
      let batchCount = 0;

      for (const deletedDoc of oldDeletedQuery.docs) {
        try {
          processedCount++;

          // Mark as non-recoverable (archive)
          const archiveRef = db.collection('deletedItemsArchive').doc(deletedDoc.id);
          batch.set(archiveRef, {
            ...deletedDoc.data(),
            archivedAt: admin.firestore.Timestamp.now(),
            canRecover: false,
          });

          // Delete from deletedItems
          batch.delete(deletedDoc.ref);

          batchCount++;
          deletedCount++;

          if (batchCount >= 500) {
            await batch.commit();
            console.log(`✅ Cleaned up batch of ${batchCount} deleted items`);
            batchCount = 0;
          }
        } catch (error) {
          const errorMsg = `Failed to cleanup ${deletedDoc.id}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        console.log(`✅ Cleaned up final batch of ${batchCount} deleted items`);
      }

      // Log cleanup results
      await db.collection('cleanupJobs').add({
        jobId: `cleanup_deleted_${Date.now()}`,
        jobType: 'expired_cache',
        startedAt: admin.firestore.Timestamp.fromMillis(startTime),
        completedAt: admin.firestore.Timestamp.now(),
        itemsProcessed: processedCount,
        itemsDeleted: deletedCount,
        errors,
        status: errors.length === 0 ? 'success' : 'partial_success',
      });

      console.log(`✅ Cleanup completed: ${deletedCount}/${processedCount} deleted items removed`);
      return { success: true, deleted: deletedCount, processed: processedCount };
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  });

// ============================================
// DAILY RECOMMEND EXPERIMENT SNAPSHOT
// ============================================

function postJson(
  endpoint: string,
  headers: Record<string, string>,
  body: string
): Promise<{ statusCode: number; responseBody: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let chunks = '';
        res.on('data', (chunk: Buffer | string) => {
          chunks += chunk.toString();
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            responseBody: chunks,
          });
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Runs daily at 06:15 AM UTC
 * Persists recommendation A/B metrics snapshots to Firestore via app API route.
 */
export const snapshotRecommendExperimentMetricsDaily = functions
  .runWith({
    timeoutSeconds: 120,
    memory: '256MB',
  })
  .pubsub.schedule('15 6 * * *') // Daily at 06:15 AM UTC
  .timeZone('UTC')
  .onRun(async () => {
    const endpoint = process.env.RECOMMEND_METRICS_SNAPSHOT_URL;
    const secret = process.env.RECOMMEND_METRICS_SNAPSHOT_SECRET;

    if (!endpoint || !secret) {
      throw new Error('Missing RECOMMEND_METRICS_SNAPSHOT_URL or RECOMMEND_METRICS_SNAPSHOT_SECRET');
    }

    console.log('📈 Running daily recommend experiment metrics snapshot...');
    const startedAt = Date.now();

    const response = await postJson(
      endpoint,
      {
        'x-cron-secret': secret,
      },
      JSON.stringify({ trigger: 'firebase-scheduler' })
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Snapshot endpoint failed: ${response.statusCode} ${response.responseBody}`);
    }

    await db.collection('cleanupJobs').add({
      jobId: `recommend_metrics_snapshot_${Date.now()}`,
      jobType: 'recommend_experiment_metrics',
      startedAt: admin.firestore.Timestamp.fromMillis(startedAt),
      completedAt: admin.firestore.Timestamp.now(),
      status: 'success',
      endpoint,
      responseStatusCode: response.statusCode,
    });

    console.log('✅ Daily recommend experiment metrics snapshot completed');
    return { success: true, statusCode: response.statusCode };
  });

// ============================================
// USER DATA CLEANUP ON ACCOUNT DELETION
// ============================================

/**
 * Triggered when a Firebase Auth user is deleted.
 * Ensures Firestore user profile documents and nested user subcollections
 * are removed so no orphaned personal data remains.
 */
export const cleanupUserDataOnDelete = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  console.log(`🧽 Starting user data cleanup for uid=${uid}`);

  const startTime = Date.now();
  const errors: string[] = [];

  try {
    const userRootRef = db.collection('users').doc(uid);

    // Delete the full user tree first (profile + nested subcollections).
    await db.recursiveDelete(userRootRef);

    // Remove additional top-level user-bound docs if present.
    const topLevelRefs = [
      db.collection('userPreferences').doc(uid),
      db.collection('userBlocklists').doc(uid),
      db.collection('usageTracking').doc(uid),
      db.collection('userInteractions').doc(uid),
    ];

    for (const ref of topLevelRefs) {
      try {
        await ref.delete();
      } catch (error) {
        // Ignore not-found; capture any other failures for observability.
        errors.push(`Failed deleting ${ref.path}: ${String(error)}`);
      }
    }

    await db.collection('cleanupJobs').add({
      jobId: `cleanup_user_${uid}_${Date.now()}`,
      jobType: 'user_delete_cleanup',
      userId: uid,
      startedAt: admin.firestore.Timestamp.fromMillis(startTime),
      completedAt: admin.firestore.Timestamp.now(),
      errors,
      status: errors.length === 0 ? 'success' : 'partial_success',
    });

    console.log(`✅ User cleanup completed for uid=${uid}`);
    return;
  } catch (error) {
    console.error(`❌ User cleanup failed for uid=${uid}:`, error);

    await db.collection('cleanupJobs').add({
      jobId: `cleanup_user_${uid}_${Date.now()}`,
      jobType: 'user_delete_cleanup',
      userId: uid,
      startedAt: admin.firestore.Timestamp.fromMillis(startTime),
      completedAt: admin.firestore.Timestamp.now(),
      errors: [...errors, String(error)],
      status: 'failed',
    });

    throw error;
  }
});
