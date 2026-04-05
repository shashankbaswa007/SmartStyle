'use client';

/**
 * Protected Route Wrapper
 * 
 * This component:
 * - Checks if user is authenticated
 * - Redirects to /auth if not authenticated
 * - Shows loading state during auth check
 * - Only renders children if user is authenticated
 */

import { useEffect } from 'react';
import { useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Loader2 } from 'lucide-react';

const LOGIN_GRACE_KEY = 'smartstyle_login_grace_ts';
const E2E_AUTH_BYPASS_COOKIE = 'smartstyle-e2e-auth=enabled';

function hasRecentLoginGraceWindow(maxAgeMs = 15000): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.sessionStorage.getItem(LOGIN_GRACE_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= maxAgeMs;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, initialized } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [resolvingSession, setResolvingSession] = useState(false);
  const checkedServerSessionRef = useRef(false);
  const userRef = useRef(user);
  const e2eBypassEnabled = process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === 'true';
  const hasE2EBypassCookie =
    typeof document !== 'undefined' && document.cookie.includes(E2E_AUTH_BYPASS_COOKIE);
  const shouldBypassAuth = e2eBypassEnabled && hasE2EBypassCookie;

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchSessionAuthenticated = async (signal: AbortSignal): Promise<boolean> => {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal,
    });

    const data = await response.json().catch(() => ({ authenticated: false }));
    return Boolean(data?.authenticated);
  };

  useEffect(() => {
    // Reset session resolution marker once auth state recovers.
    if (user || !initialized || loading) {
      checkedServerSessionRef.current = false;
      setResolvingSession(false);
      return;
    }

    if (checkedServerSessionRef.current) {
      return;
    }

    checkedServerSessionRef.current = true;
    let cancelled = false;

    const resolveAndMaybeRedirect = async () => {
      if (hasRecentLoginGraceWindow()) {
        setResolvingSession(true);
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      setResolvingSession(true);

      try {
        const sessionTimeoutController = new AbortController();
        const timeoutId = window.setTimeout(() => sessionTimeoutController.abort(), 3500);
        const authenticated = await fetchSessionAuthenticated(sessionTimeoutController.signal);
        window.clearTimeout(timeoutId);

        if (cancelled) return;

        if (authenticated) {
          // Grace window for Firebase client hydration; prevents false redirects during auth races.
          await new Promise((resolve) => setTimeout(resolve, 1200));
          if (cancelled) return;

          if (userRef.current) {
            setResolvingSession(false);
            return;
          }
        }
      } catch {
        // If we cannot confirm server session, fall through to redirect.
      }

      if (cancelled) return;
      setResolvingSession(false);
      const rawNextPath = pathname || '/';
      // Prevent auth redirect loops if a protected route resolves to auth itself.
      const nextPath = rawNextPath.startsWith('/auth') ? '/' : rawNextPath;
      router.replace(`/auth?next=${encodeURIComponent(nextPath)}`);
    };

    void resolveAndMaybeRedirect();

    return () => {
      cancelled = true;
    };
  }, [initialized, user, loading, pathname, router]);

  // Show loading state while checking authentication state and initialization
  if (!shouldBypassAuth && (!initialized || loading || resolvingSession)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Don't render content if user is not authenticated (will redirect)
  if (!shouldBypassAuth && !user) {
    return null;
  }

  // User is authenticated, render protected content
  return <>{children}</>;
}
