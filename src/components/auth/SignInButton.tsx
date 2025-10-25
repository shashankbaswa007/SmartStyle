'use client';

/**
 * Sign-In Button Component
 * 
 * Displays Google sign-in button with loading states and error handling.
 * Shows user info and sign-out button when authenticated.
 */

import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { signInWithGoogle, signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function SignInButton() {
  const { user, loading: authLoading } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { user, error } = await signInWithGoogle();
    setGoogleLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Sign-in failed',
        description: error,
      });
    } else if (user) {
      toast({
        title: 'Welcome!',
        description: `Signed in as ${user.displayName || user.email}`,
      });
    }
  };

  const handleSignOut = async () => {
    setSignOutLoading(true);
    const { success, error } = await signOut();
    setSignOutLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Sign-out failed',
        description: error,
      });
    } else if (success) {
      toast({
        title: 'Signed out',
        description: 'You have been signed out successfully',
      });
    }
  };

  // Show loading state while auth initializes
  if (authLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // Show user info and sign-out button when authenticated
  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} />
            <AvatarFallback>
              {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:block">
            <p className="text-sm font-medium">{user.displayName || 'User'}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          disabled={signOutLoading}
        >
          {signOutLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </>
          )}
        </Button>
      </div>
    );
  }

  // Show sign-in button when not authenticated
  return (
    <Button
      variant="outline"
      onClick={handleGoogleSignIn}
      disabled={googleLoading}
      className="w-full sm:w-auto"
    >
      {googleLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      )}
      Sign in with Google
    </Button>
  );
}
