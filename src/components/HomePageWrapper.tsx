'use client';

/**
 * Home Page Client Wrapper - Handles authentication check
 * 
 * This component:
 * - Checks if user is authenticated
 * - Redirects to /auth if not authenticated
 * - Shows loading state during auth check
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export function HomePageWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuth();
  const router = useRouter();
  const [resolvingSession, setResolvingSession] = useState(false);
  const checkedServerSessionRef = useRef(false);

  useEffect(() => {
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
          setResolvingSession(false);
          return;
        }
      } catch {
        // Fall through to redirect.
      }

      if (cancelled) return;
      setResolvingSession(false);
      router.push('/auth');
    };

    void resolveAndMaybeRedirect();

    return () => {
      cancelled = true;
    };
  }, [initialized, user, loading, router]);

  // Show loading state while checking authentication
  if (!initialized || loading || resolvingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading SmartStyle...</p>
        </div>
      </div>
    );
  }

  // Don't render home content if user is not authenticated (will redirect)
  if (!user) {
    return null;
  }

  // User is authenticated, render home page content
  return <>{children}</>;
}
