/**
 * Audit Logging System
 * 
 * Tracks all data changes for compliance, debugging, and data recovery.
 * Enables restoration of accidentally deleted data and provides
 * full audit trail for regulatory compliance.
 * 
 * Features:
 * - Automatic change tracking
 * - Data recovery capabilities
 * - Compliance logging
 * - User action history
 */

import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDocs, query, where, orderBy, limit, Timestamp, deleteDoc } from 'firebase/firestore';
import { validateData, auditLogSchema } from './validation/schemas';
import type { AuditLog } from './validation/schemas';

// ============================================
// AUDIT LOG CREATION
// ============================================

/**
 * Log an audit event to Firestore
 * 
 * @param event - Audit event details
 */
export async function logAuditEvent(
  event: Omit<AuditLog, 'id' | 'timestamp'>
): Promise<string> {
  const auditLogId = `${event.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const auditLogData: AuditLog = validateData(auditLogSchema, {
    id: auditLogId,
    ...event,
    timestamp: new Date(),
  });

  try {
    const auditRef = doc(db, 'auditLogs', auditLogId);
    await setDoc(auditRef, {
      ...auditLogData,
      timestamp: Timestamp.fromDate(auditLogData.timestamp as Date),
    });

    console.log(`✅ Audit log created: ${auditLogId} (${event.action} on ${event.collection}/${event.documentId})`);
    return auditLogId;
  } catch (error) {
    console.error('❌ Failed to create audit log:', error);
    // Don't throw - audit logging failure shouldn't break the main operation
    return '';
  }
}

// ============================================
// PREFERENCE CHANGE TRACKING
// ============================================

/**
 * Track user preference changes with full history
 * 
 * @param userId - User ID
 * @param changes - Changed fields
 * @param previousData - Data before changes
 * @param newData - Data after changes
 */
export async function trackPreferenceChange(
  userId: string,
  changes: Record<string, any>,
  previousData?: Record<string, any>,
  newData?: Record<string, any>
): Promise<void> {
  const changeId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const historyRef = doc(db, 'userPreferencesHistory', changeId);
    await setDoc(historyRef, {
      id: changeId,
      userId,
      changes,
      previousData: previousData || null,
      newData: newData || null,
      timestamp: Timestamp.now(),
    });

    // Also create audit log
    await logAuditEvent({
      userId,
      action: 'preference_change',
      collection: 'userPreferences',
      documentId: userId,
      changes,
      previousData,
      newData,
    });

    console.log(`✅ Preference change tracked: ${changeId}`);
  } catch (error) {
    console.error('❌ Failed to track preference change:', error);
  }
}

// ============================================
// DELETION EVENT LOGGING
// ============================================

/**
 * Log deletion event with full data for recovery
 * 
 * @param userId - User ID
 * @param collection - Collection name
 * @param documentId - Deleted document ID
 * @param deletedData - Full data of deleted document
 * @param reason - Reason for deletion (optional)
 */
export async function logDeletion(
  userId: string,
  collection: string,
  documentId: string,
  deletedData: Record<string, any>,
  reason?: string
): Promise<string> {
  const deletionId = `del_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Store in dedicated deletions collection for easy recovery
    const deletionRef = doc(db, 'deletedItems', deletionId);
    await setDoc(deletionRef, {
      id: deletionId,
      userId,
      originalCollection: collection,
      originalDocumentId: documentId,
      deletedData,
      reason: reason || 'User requested',
      deletedAt: Timestamp.now(),
      canRecover: true,
      recoveredAt: null,
    });

    // Also create audit log
    await logAuditEvent({
      userId,
      action: 'delete',
      collection,
      documentId,
      previousData: deletedData,
    });

    console.log(`✅ Deletion logged: ${deletionId} (${collection}/${documentId})`);
    return deletionId;
  } catch (error) {
    console.error('❌ Failed to log deletion:', error);
    throw error;
  }
}

// ============================================
// DATA RECOVERY
// ============================================

/**
 * Recover accidentally deleted data
 * 
 * @param deletionId - ID from deletion log
 * @returns Recovered data or null if not found
 */
export async function recoverDeletedData(deletionId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const deletionRef = doc(db, 'deletedItems', deletionId);
    const deletionSnap = await getDocs(
      query(collection(db, 'deletedItems'), where('id', '==', deletionId), limit(1))
    );

    if (deletionSnap.empty) {
      return {
        success: false,
        error: 'Deletion record not found',
      };
    }

    const deletionData = deletionSnap.docs[0].data();

    if (deletionData.recoveredAt) {
      return {
        success: false,
        error: 'Data already recovered',
      };
    }

    // Restore original document
    const originalRef = doc(
      db,
      'users',
      deletionData.userId,
      deletionData.originalCollection,
      deletionData.originalDocumentId
    );

    await setDoc(originalRef, deletionData.deletedData);

    // Mark as recovered in deletion log
    await setDoc(
      deletionRef,
      {
        recoveredAt: Timestamp.now(),
        canRecover: false,
      },
      { merge: true }
    );

    // Log recovery event
    await logAuditEvent({
      userId: deletionData.userId,
      action: 'create',
      collection: deletionData.originalCollection,
      documentId: deletionData.originalDocumentId,
      newData: {
        ...deletionData.deletedData,
        recoveredFrom: deletionId,
      },
    });

    console.log(`✅ Data recovered: ${deletionId}`);
    return {
      success: true,
      data: deletionData.deletedData,
    };
  } catch (error) {
    console.error('❌ Failed to recover data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// AUDIT LOG QUERIES
// ============================================

/**
 * Get audit logs for a specific user
 * 
 * @param userId - User ID
 * @param maxResults - Maximum number of results (default: 100)
 */
export async function getUserAuditLogs(
  userId: string,
  maxResults: number = 100
): Promise<AuditLog[]> {
  try {
    const auditQuery = query(
      collection(db, 'auditLogs'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );

    const querySnap = await getDocs(auditQuery);
    return querySnap.docs.map((doc) => doc.data() as AuditLog);
  } catch (error) {
    console.error('❌ Failed to fetch audit logs:', error);
    return [];
  }
}

/**
 * Get audit logs for a specific action
 * 
 * @param userId - User ID
 * @param action - Action type (create, update, delete, etc.)
 * @param maxResults - Maximum number of results
 */
export async function getAuditLogsByAction(
  userId: string,
  action: AuditLog['action'],
  maxResults: number = 50
): Promise<AuditLog[]> {
  try {
    const auditQuery = query(
      collection(db, 'auditLogs'),
      where('userId', '==', userId),
      where('action', '==', action),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );

    const querySnap = await getDocs(auditQuery);
    return querySnap.docs.map((doc) => doc.data() as AuditLog);
  } catch (error) {
    console.error('❌ Failed to fetch audit logs by action:', error);
    return [];
  }
}

/**
 * Get audit logs for a specific collection
 * 
 * @param userId - User ID
 * @param collectionName - Collection name
 * @param maxResults - Maximum number of results
 */
export async function getAuditLogsByCollection(
  userId: string,
  collectionName: string,
  maxResults: number = 50
): Promise<AuditLog[]> {
  try {
    const auditQuery = query(
      collection(db, 'auditLogs'),
      where('userId', '==', userId),
      where('collection', '==', collectionName),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );

    const querySnap = await getDocs(auditQuery);
    return querySnap.docs.map((doc) => doc.data() as AuditLog);
  } catch (error) {
    console.error('❌ Failed to fetch audit logs by collection:', error);
    return [];
  }
}

/**
 * Get user's preference change history
 * 
 * @param userId - User ID
 * @param maxResults - Maximum number of results
 */
export async function getPreferenceHistory(
  userId: string,
  maxResults: number = 50
): Promise<any[]> {
  try {
    const historyQuery = query(
      collection(db, 'userPreferencesHistory'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );

    const querySnap = await getDocs(historyQuery);
    return querySnap.docs.map((doc) => doc.data());
  } catch (error) {
    console.error('❌ Failed to fetch preference history:', error);
    return [];
  }
}

/**
 * Get all deleted items for a user (for recovery UI)
 * 
 * @param userId - User ID
 */
export async function getRecoverableItems(userId: string): Promise<any[]> {
  try {
    const deletionsQuery = query(
      collection(db, 'deletedItems'),
      where('userId', '==', userId),
      where('canRecover', '==', true),
      orderBy('deletedAt', 'desc'),
      limit(50)
    );

    const querySnap = await getDocs(deletionsQuery);
    return querySnap.docs.map((doc) => doc.data());
  } catch (error) {
    console.error('❌ Failed to fetch recoverable items:', error);
    return [];
  }
}

// ============================================
// COMPLIANCE REPORTING
// ============================================

/**
 * Generate compliance report for a user
 * 
 * @param userId - User ID
 * @param startDate - Start date for report
 * @param endDate - End date for report
 */
export async function generateComplianceReport(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  userId: string;
  period: { start: Date; end: Date };
  summary: {
    totalActions: number;
    creates: number;
    updates: number;
    deletes: number;
    preferenceChanges: number;
  };
  actions: AuditLog[];
}> {
  try {
    const auditQuery = query(
      collection(db, 'auditLogs'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );

    const querySnap = await getDocs(auditQuery);
    const allLogs = querySnap.docs.map((doc) => doc.data() as AuditLog);

    // Filter by date range
    const filteredLogs = allLogs.filter((log) => {
      const logDate = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
      return logDate >= startDate && logDate <= endDate;
    });

    // Calculate summary
    const summary = {
      totalActions: filteredLogs.length,
      creates: filteredLogs.filter((log) => log.action === 'create').length,
      updates: filteredLogs.filter((log) => log.action === 'update').length,
      deletes: filteredLogs.filter((log) => log.action === 'delete').length,
      preferenceChanges: filteredLogs.filter((log) => log.action === 'preference_change').length,
    };

    return {
      userId,
      period: { start: startDate, end: endDate },
      summary,
      actions: filteredLogs,
    };
  } catch (error) {
    console.error('❌ Failed to generate compliance report:', error);
    throw error;
  }
}

// ============================================
// CLEANUP UTILITIES
// ============================================

/**
 * Archive old audit logs (move to cold storage collection)
 * Should be called periodically by Cloud Function
 * 
 * @param olderThanMonths - Archive logs older than X months
 */
export async function archiveOldAuditLogs(olderThanMonths: number = 12): Promise<{
  archived: number;
  errors: number;
}> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - olderThanMonths);

  let archived = 0;
  let errors = 0;

  try {
    const oldLogsQuery = query(collection(db, 'auditLogs'), orderBy('timestamp', 'asc'), limit(500));

    const querySnap = await getDocs(oldLogsQuery);

    for (const docSnap of querySnap.docs) {
      try {
        const logData = docSnap.data();
        const logDate = logData.timestamp.toDate();

        if (logDate < cutoffDate) {
          // Move to archive collection
          const archiveRef = doc(db, 'auditLogsArchive', docSnap.id);
          await setDoc(archiveRef, {
            ...logData,
            archivedAt: Timestamp.now(),
          });

          // Delete from main collection
          await deleteDoc(docSnap.ref);
          archived++;
        }
      } catch (error) {
        console.error(`❌ Failed to archive log ${docSnap.id}:`, error);
        errors++;
      }
    }

    console.log(`✅ Archived ${archived} audit logs (${errors} errors)`);
    return { archived, errors };
  } catch (error) {
    console.error('❌ Failed to archive audit logs:', error);
    throw error;
  }
}
