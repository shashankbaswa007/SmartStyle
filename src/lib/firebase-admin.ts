/**
 * Firebase Admin SDK Configuration
 * 
 * This file initializes the Firebase Admin SDK for server-side operations.
 * Used in Server Actions and API routes.
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK (singleton pattern)
if (!admin.apps.length) {
  try {
    // Check if we have the service account credentials
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccount) {
      try {
        // Initialize with service account (production)
        const credentials = JSON.parse(serviceAccount);
        admin.initializeApp({
          credential: admin.credential.cert(credentials),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
        console.log('✅ Firebase Admin SDK initialized with service account');
      } catch (jsonError) {
        console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', jsonError);
        throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY format - must be valid JSON');
      }
    } else {
      // Initialize with project ID only (development/fallback)
      // This will work with Firebase Emulator or if deployed to Firebase
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
      console.log('ℹ️ Firebase Admin SDK initialized without service account (development mode)');
    }
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization error:', error);
    throw error;
  }
}

// Export Firestore instance
export const getFirestore = () => admin.firestore();

// Export FieldValue for server-side operations
export const FieldValue = admin.firestore.FieldValue;

// Export the admin app
export const adminApp = admin.app();

export default admin;
