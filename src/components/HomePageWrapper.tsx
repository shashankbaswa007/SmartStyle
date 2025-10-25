'use client';

/**
 * Home Page Client Wrapper - Handles authentication check
 * 
 * This component:
 * - Checks if user is authenticated
 * - Redirects to /auth if not authenticated
 * - Shows loading state during auth check
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Loader2 } from 'lucide-react';

export function HomePageWrapper({ children }: { children: React.ReactNode }) {
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
