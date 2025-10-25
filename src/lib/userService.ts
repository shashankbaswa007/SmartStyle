/**
 * User Service - Manages user documents in Firestore
 * 
 * Handles:
 * - Creating new user documents
 * - Updating user profile data
 * - Fetching user information
 * - Storing authentication metadata
 */

import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // User exists, update last login time
      await updateDoc(userRef, {
        lastLoginAt: new Date().toISOString(),
        // Update profile data in case it changed (e.g., user updated their Google profile)
        displayName: userData.displayName,
        photoURL: userData.photoURL,
      });
      
      console.log('User document updated:', userId);
    } else {
      // New user, create document with full profile data
      await setDoc(userRef, {
        ...userData,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      });
      
      console.log('User document created:', userId);
    }
  } catch (error) {
    console.error('Error creating/updating user document:', error);
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
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
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
    await updateDoc(userRef, updates);
    
    console.log('User profile updated:', userId);
  } catch (error) {
    console.error('Error updating user profile:', error);
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
    const userSnap = await getDoc(userRef);
    return userSnap.exists();
  } catch (error) {
    console.error('Error checking user existence:', error);
    return false;
  }
}
