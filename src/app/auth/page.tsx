'use client';

/**
 * Authentication Page - First screen users see when opening the app
 * 
 * Features:
 * - Google Sign-In with OAuth 2.0
 * - Automatic user document creation in Firestore
 * - Stores user profile data (name, email, photo)
 * - Redirects to home page after successful authentication
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/components/auth/AuthProvider';
import { signInWithGoogle } from '@/lib/auth';
import { createUserDocument } from '@/lib/userService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';

export default function AuthPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);

  // Redirect to home if user is already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  /**
   * Handle Google Sign-In
   * - Opens Google OAuth popup
   * - Creates user document in Firestore if new user
   * - Redirects to home page on success
   */
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    
    try {
      const { user, error } = await signInWithGoogle();
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Authentication Failed',
          description: error,
        });
        setGoogleLoading(false);
        return;
      }

      if (user) {
        // Create user document in Firestore with profile data
        await createUserDocument(user.uid, {
          displayName: user.displayName || 'Anonymous User',
          email: user.email || '',
          photoURL: user.photoURL || '',
          provider: 'google',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        });

        toast({
          title: 'Welcome to SmartStyle!',
          description: `Signed in as ${user.displayName || user.email}`,
        });

        // Redirect to home page
        router.push('/');
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'An unexpected error occurred. Please try again.',
      });
      setGoogleLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't show auth page if user is already signed in (will redirect)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="border-accent/20 shadow-2xl backdrop-blur-sm bg-card/95">
          <CardHeader className="space-y-4 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center"
            >
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </motion.div>
            
            <CardTitle className="text-3xl font-headline font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Welcome to SmartStyle
            </CardTitle>
            
            <CardDescription className="text-base">
              Your personal AI stylist awaits. Sign in to unlock personalized fashion recommendations.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Google Sign-In Button */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 shadow-sm transition-all duration-200 hover:shadow-md"
              >
                {googleLoading ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>
            </motion.div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Secure Authentication
                </span>
              </div>
            </div>

            {/* Privacy Notice */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-xs text-center text-muted-foreground"
            >
              By continuing, you agree to our Terms of Service and Privacy Policy. 
              Your data is encrypted and secure.
            </motion.p>
          </CardContent>
        </Card>

        {/* Footer branding */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 text-center text-sm text-muted-foreground"
        >
          Powered by AI · Fashion Intelligence
        </motion.div>
      </motion.div>
    </div>
  );
}
