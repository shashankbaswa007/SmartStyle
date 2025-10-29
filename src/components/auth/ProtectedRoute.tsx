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
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to auth page if user is not authenticated
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  // Show loading state while checking authentication
  if (loading) {
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
