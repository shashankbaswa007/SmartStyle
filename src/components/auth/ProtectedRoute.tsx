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
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        const data = await response.json();
        if (cancelled) return;

        if (data?.authenticated) {
          // Server session exists: wait for Firebase client hydration instead of bouncing.
          setResolvingSession(false);
          return;
        }
      } catch {
        // If we cannot confirm server session, fall through to redirect.
      }

      if (cancelled) return;
      setResolvingSession(false);
      const nextPath = pathname || '/';
      router.replace(`/auth?next=${encodeURIComponent(nextPath)}`);
    };

    void resolveAndMaybeRedirect();

    return () => {
      cancelled = true;
    };
  }, [initialized, user, loading, pathname, router]);

  // Show loading state while checking authentication state and initialization
  if (!initialized || loading || resolvingSession) {
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
  if (!user) {
    return null;
  }

  // User is authenticated, render protected content
  return <>{children}</>;
}
