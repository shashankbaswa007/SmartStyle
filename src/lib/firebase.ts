/**
 * Centralized Firebase Configuration
 * 
 * This file initializes Firebase once and exports all services.
 * Use this file to avoid duplicate initialization across the app.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { logger } from './logger';

const globalFirebaseLogState = globalThis as typeof globalThis & {
  __smartstyleFirebaseEnvLogged?: boolean;
  __smartstyleFirebaseInitLogged?: boolean;
};

// Debug: Log what environment variables are available (for development only)
if (process.env.NODE_ENV === 'development' && !globalFirebaseLogState.__smartstyleFirebaseEnvLogged) {
  logger.debug('🔍 Firebase env check:', {
    hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    hasAuthDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (process.env.NODE_ENV === 'development' && !globalFirebaseLogState.__smartstyleFirebaseEnvLogged) {
  logger.debug('🔍 Firebase config object:', {
    hasApiKey: !!firebaseConfig.apiKey,
    hasAuthDomain: !!firebaseConfig.authDomain,
    hasProjectId: !!firebaseConfig.projectId,
    configKeys: Object.keys(firebaseConfig),
  });
  globalFirebaseLogState.__smartstyleFirebaseEnvLogged = true;
}

// Validate Firebase configuration values (not process.env, but actual config values)
const missingFields = Object.entries(firebaseConfig)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingFields.length > 0) {
  logger.error('❌ Missing Firebase configuration fields:', missingFields.join(', '));
  logger.error('Firebase config object:', firebaseConfig);
  logger.error('This usually means environment variables are not being loaded correctly.');
  logger.error('Check that .env or .env.local file exists with NEXT_PUBLIC_FIREBASE_* variables.');
  throw new Error(
    `Missing Firebase configuration: ${missingFields.map(f => 'NEXT_PUBLIC_FIREBASE_' + f.toUpperCase()).join(', ')}`
  );
}

// Initialize Firebase (singleton pattern - only initialize once)
let app;
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  if (process.env.NODE_ENV === 'development' && !globalFirebaseLogState.__smartstyleFirebaseInitLogged) {
    logger.debug('✅ Firebase initialized successfully');
    globalFirebaseLogState.__smartstyleFirebaseInitLogged = true;
  }
} catch (error) {
  logger.error('❌ Firebase initialization error:', error);
  throw error;
}

// Initialize Firebase services
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const firebaseApp = app;

export default app;
