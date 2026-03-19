'use client';

/**
 * Authentication Context Provider
 * 
 * Wraps the application to provide authentication state to all components.
 * Use the `useAuth` hook to access auth state and methods in any component.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange } from '@/lib/auth';
import { logger } from '@/lib/logger';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  initialized: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  initialized: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let didResolveAuthState = false;

    const syncSession = async (user: User | null) => {
      try {
        if (user) {
          const idToken = await user.getIdToken();
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken }),
            credentials: 'include',
          });
        } else {
          await fetch('/api/auth/session', {
            method: 'DELETE',
            credentials: 'include',
          });
        }
      } catch (error) {
        logger.warn('Failed to sync auth session cookie', error);
      }
    };

    // Subscribe to auth state changes
    const unsubscribe = onAuthChange((user) => {
      didResolveAuthState = true;
      setUser(user);
      setLoading(false);
      setInitialized(true);

      // Keep a secure HttpOnly session cookie in sync for middleware checks.
      void syncSession(user);
    });

    // Fallback: avoid getting stuck forever if auth callback is delayed.
    const fallbackTimer = window.setTimeout(() => {
      if (!didResolveAuthState) {
        logger.warn('Auth state callback timed out; continuing with unauthenticated UI fallback');
        setLoading(false);
        setInitialized(true);
      }
    }, 3000);

    // Cleanup subscription on unmount
    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to access authentication context
 * @returns Authentication state (user, loading, initialized)
 * @throws Error if used outside AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
