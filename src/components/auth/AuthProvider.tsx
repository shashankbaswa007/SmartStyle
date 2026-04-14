'use client';

/**
 * Authentication Context Provider
 * 
 * Wraps the application to provide authentication state to all components.
 * Use the `useAuth` hook to access auth state and methods in any component.
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange } from '@/lib/auth';
import { logger } from '@/lib/logger';

const E2E_AUTH_BYPASS_COOKIE = 'smartstyle-e2e-auth=enabled';

function hasE2EAuthBypassCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes(E2E_AUTH_BYPASS_COOKIE);
}

function isLocalBypassHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
}

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
  const previousUserRef = useRef<User | null>(null);

  useEffect(() => {
    const isLocalHost = typeof window !== 'undefined' && isLocalBypassHost(window.location.hostname);
    const e2eBypassEnabled =
      process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === 'true' &&
      (process.env.NODE_ENV !== 'production' || isLocalHost);
    if (e2eBypassEnabled && hasE2EAuthBypassCookie()) {
      const now = new Date().toISOString();
      const e2eUser = {
        uid: 'e2e-bypass-user',
        email: 'e2e@smartstyle.local',
        displayName: 'E2E Test User',
        getIdToken: async () => 'e2e-bypass-token',
        getIdTokenResult: async () => ({ token: 'e2e-bypass-token' }),
        providerData: [{ providerId: 'password' }],
        metadata: {
          creationTime: now,
          lastSignInTime: now,
        },
      } as unknown as User;

      previousUserRef.current = e2eUser;
      setUser(e2eUser);
      setLoading(false);
      setInitialized(true);
      return;
    }

    let didResolveAuthState = false;
    let unsubscribe: (() => void) | undefined;

    const syncSession = async (user: User | null, shouldClear: boolean) => {
      const requestWithRetry = async (input: RequestInfo, init: RequestInit) => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const response = await fetch(input, init);
            if (response.ok) {
              return true;
            }
          } catch {
            // Retry transient failures.
          }

          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 250));
          }
        }

        return false;
      };

      try {
        if (user) {
          const idToken = await user.getIdToken();
          await requestWithRetry('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
            },
            body: JSON.stringify({ idToken }),
            credentials: 'include',
          });
        } else if (shouldClear) {
          await requestWithRetry('/api/auth/session', {
            method: 'DELETE',
            headers: {
              'Cache-Control': 'no-store',
            },
            credentials: 'include',
          });
        }
      } catch (error) {
        logger.warn('Failed to sync auth session cookie', error);
      }
    };

    // Subscribe to auth state changes
    try {
      unsubscribe = onAuthChange((user) => {
        const previousUser = previousUserRef.current;
        previousUserRef.current = user;

        didResolveAuthState = true;
        setUser(user);
        setLoading(false);
        setInitialized(true);

        // Keep a secure HttpOnly session cookie in sync for middleware checks.
        const shouldClear = !!previousUser && !user;
        void syncSession(user, shouldClear);
      });
    } catch (error) {
      logger.warn('Failed to subscribe to auth state; continuing with unauthenticated UI fallback', error);
      setLoading(false);
      setInitialized(true);
    }

    // Fallback: avoid getting stuck forever if auth callback is unusually delayed.
    const fallbackTimer = window.setTimeout(() => {
      if (!didResolveAuthState) {
        logger.warn('Auth state callback timed out after extended wait; continuing with unauthenticated UI fallback');
        setLoading(false);
        setInitialized(true);
      }
    }, 8000);

    // Cleanup subscription on unmount
    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe?.();
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
