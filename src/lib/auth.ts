/**
 * Firebase Authentication Service
 * 
 * Provides sign-in/sign-out methods for:
 * - Google Authentication
 * 
 * All methods handle errors gracefully and return user data or error messages.
 */

import {
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  User,
  UserCredential,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { logger } from './logger';

// ============================================
// GOOGLE AUTHENTICATION
// ============================================

/**
 * Sign in with Google using popup-first flow with redirect fallback
 * @returns Promise with user credential or error
 */
export async function signInWithGoogle(): Promise<{ user: User | null; error?: string; redirecting?: boolean }> {
  try {
    // Enable persistence so users stay logged in after page refresh
    await setPersistence(auth, browserLocalPersistence);
    
    const provider = new GoogleAuthProvider();
    
    // Add required scopes for profile and email
    provider.addScope('profile');
    provider.addScope('email');
    
    // Set custom parameters (optional)
    provider.setCustomParameters({
      prompt: 'select_account', // Forces account selection even if user is already signed in
    });

    // Prefer popup for more deterministic callback handling.
    // Fall back to redirect if popup is blocked or disallowed.
    try {
      const popupResult: UserCredential = await signInWithPopup(auth, provider);
      logger.info('Google popup sign-in succeeded', {
        userId: popupResult.user?.uid || null,
      });
      return { user: popupResult.user, redirecting: false };
    } catch (popupError: any) {
      const code = String(popupError?.code || '');
      const shouldFallbackToRedirect =
        code === 'auth/popup-blocked' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/operation-not-supported-in-this-environment';

      if (!shouldFallbackToRedirect) {
        throw popupError;
      }

      logger.warn('Google popup unavailable, falling back to redirect', {
        code,
      });

      logger.info('Starting Google OAuth redirect flow', {
        authDomain: typeof window !== 'undefined' ? window.location.host : 'server',
        configuredAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      });

      await signInWithRedirect(auth, provider);
      return { user: null, redirecting: true };
    }
  } catch (error: any) {
    logger.error('Google sign-in error:', error);
    
    // Handle specific error codes
    let errorMessage = 'Failed to sign in with Google';
    if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Sign-in popup was closed';
    } else if (error.code === 'auth/cancelled-popup-request') {
      errorMessage = 'Sign-in was cancelled';
    }
    
    return { user: null, error: errorMessage, redirecting: false };
  }
}

/**
 * Resolve Google redirect sign-in result, if this page load is returning from OAuth.
 */
export async function consumeGoogleRedirectResult(): Promise<{ user: User | null; error?: string }> {
  try {
    const result = await getRedirectResult(auth);
    const fallbackUser = auth.currentUser;
    const resolvedUser = result?.user || fallbackUser || null;
    logger.info('Google redirect result resolved', {
      hasUser: !!result?.user,
      hasCurrentUserFallback: !!fallbackUser,
      userId: resolvedUser?.uid || null,
    });
    return { user: resolvedUser };
  } catch (error: any) {
    logger.error('Google redirect result error:', error);
    return { user: null, error: 'Failed to complete Google sign-in redirect' };
  }
}

// ============================================
// SIGN OUT
// ============================================

/**
 * Sign out current user
 * @returns Promise that resolves when sign-out is complete
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    await firebaseSignOut(auth);
    try {
      await fetch('/api/auth/session', {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      // Non-fatal: firebase sign-out already completed.
    }
    
    return { success: true };
  } catch (error: any) {
    logger.error('Sign-out error:', error);
    return { success: false, error: 'Failed to sign out' };
  }
}

// ============================================
// AUTH STATE OBSERVER
// ============================================

/**
 * Subscribe to authentication state changes
 * @param callback Function to call when auth state changes
 * @returns Unsubscribe function
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get current authenticated user
 * @returns Current user or null
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Check if user is authenticated
 * @returns Boolean indicating auth status
 */
export function isAuthenticated(): boolean {
  return auth.currentUser !== null;
}

/**
 * Get user's display name (fallback to email if not available)
 * @returns User's display name or email
 */
export function getUserDisplayName(): string | null {
  const user = auth.currentUser;
  if (!user) return null;
  return user.displayName || user.email || 'Anonymous User';
}

/**
 * Get user's email
 * @returns User's email or null
 */
export function getUserEmail(): string | null {
  return auth.currentUser?.email || null;
}

/**
 * Get user's photo URL
 * @returns User's photo URL or null
 */
export function getUserPhotoURL(): string | null {
  return auth.currentUser?.photoURL || null;
}

/**
 * Get user's unique ID
 * @returns User's UID or null
 */
export function getUserId(): string | null {
  return auth.currentUser?.uid || null;
}
