/**
 * User Service - Manages user documents in Firestore
 * 
 * Handles:
 * - Creating new user documents
 * - Updating user profile data
 * - Fetching user information
 * - Storing authentication metadata
 */

import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function isTransientFirestoreError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  return (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code.includes('aborted') ||
    code.includes('resource-exhausted') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('timeout')
  );
}

async function withFirestoreRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientFirestoreError(error) || attempt >= attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  throw lastError;
}

/**
 * User profile data structure
 */
export interface UserProfile {
  displayName: string;
  email: string;
  photoURL: string;
  provider: 'google' | 'email';
  createdAt: string;
  lastLoginAt: string;
}

/**
 * Create or update user document in Firestore
 * - Checks if user document exists
 * - Creates new document for first-time users
 * - Updates lastLoginAt for returning users
 * 
 * @param userId - Firebase Auth user ID
 * @param userData - User profile data from authentication provider
 * @returns Promise that resolves when document is created/updated
 */
export async function createUserDocument(
  userId: string,
  userData: UserProfile
): Promise<void> {
  try {
    // Validate inputs
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required');
    }

    if (!userData || !userData.email) {
      throw new Error('User data with email is required');
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await withFirestoreRetry(() => getDoc(userRef));

    if (userSnap.exists()) {
      // User exists, update last login time
      await withFirestoreRetry(() => updateDoc(userRef, {
        lastLoginAt: new Date().toISOString(),
        // Update profile data in case it changed (e.g., user updated their Google profile)
        displayName: userData.displayName || userSnap.data().displayName,
        photoURL: userData.photoURL || userSnap.data().photoURL,
      }));
      
    } else {
      // New user, create document with full profile data
      await withFirestoreRetry(() => setDoc(userRef, {
        ...userData,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      }));
      
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Get user profile data from Firestore
 * 
 * @param userId - Firebase Auth user ID
 * @returns User profile data or null if not found
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await withFirestoreRetry(() => getDoc(userRef));

    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Update user profile data
 * 
 * @param userId - Firebase Auth user ID
 * @param updates - Partial user profile data to update
 * @returns Promise that resolves when update is complete
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await withFirestoreRetry(() => updateDoc(userRef, updates));
    
  } catch (error) {
    throw error;
  }
}

/**
 * Check if user document exists in Firestore
 * 
 * @param userId - Firebase Auth user ID
 * @returns Boolean indicating whether user document exists
 */
export async function userExists(userId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await withFirestoreRetry(() => getDoc(userRef));
    return userSnap.exists();
  } catch (error) {
    return false;
  }
}
