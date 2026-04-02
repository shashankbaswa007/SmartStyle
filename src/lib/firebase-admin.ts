/**
 * Firebase Admin SDK Configuration
 * 
 * This file initializes the Firebase Admin SDK for server-side operations.
 * Used in Server Actions and API routes.
 */

import * as admin from 'firebase-admin';
import { logger } from './logger';

let initializationAttempted = false;

function hasManagedRuntimeCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.K_SERVICE ||
    process.env.FUNCTION_TARGET ||
    process.env.GAE_ENV ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST
  );
}

function ensureAdminInitialized(): boolean {
  if (admin.apps.length) {
    return true;
  }

  if (initializationAttempted) {
    return false;
  }
  initializationAttempted = true;

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccount) {
      const credentials = JSON.parse(serviceAccount);
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
      logger.log('✅ Firebase Admin SDK initialized with service account');
      return true;
    }

    if (!hasManagedRuntimeCredentials()) {
      logger.warn('⚠️ Firebase Admin SDK credentials not configured; using graceful fallback path');
      return false;
    }

    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
    logger.log('ℹ️ Firebase Admin SDK initialized with runtime credentials');
    return true;
  } catch (error) {
    logger.warn('⚠️ Firebase Admin SDK unavailable, falling back where supported', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// Export Firestore instance
export const getFirestore = () => {
  if (!ensureAdminInitialized() || !admin.apps.length) {
    throw new Error('Firebase Admin SDK not initialized');
  }
  return admin.firestore();
};

// Export FieldValue for server-side operations
export const FieldValue = admin.firestore.FieldValue;

// Export the admin app
export const adminApp = () => {
  if (!ensureAdminInitialized() || !admin.apps.length) return null;
  return admin.app();
};

export default admin;
