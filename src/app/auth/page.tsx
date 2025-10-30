'use client';

/**
 * Authentication Page - First screen users see when opening the app
 * 
 * Features:
 * - Google Sign-In with OAuth 2.0
 * - Automatic user document creation in Firestore
 * - Stores user profile data (name, email, photo)
 * - Redirects to home page after successful authentication
 * - Animated UnicornStudio background
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
import { Loader2, Sparkles, Chrome } from 'lucide-react';
import UnicornStudioBackground from '@/components/UnicornStudioBackground';

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
    <div className="relative min-h-screen overflow-hidden">
      {/* UnicornStudio Animated Background - Full Brightness */}
      <div className="absolute inset-0 -z-10">
        <UnicornStudioBackground
          projectId="eZYI0DQyjgFOe6169086"
          width="100%"
          height="100%"
          className="opacity-100 brightness-110 saturate-110"
        />
        {/* Subtle dark overlay for better contrast */}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Auth Card */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Animated Glowing Gradient Border Container */}
        <div className="relative rounded-3xl shadow-xl flex justify-center">
          {/* Uniform border: use a thin wrapper for the border effect */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full max-w-xs h-full rounded-3xl border-[2.5px] border-transparent bg-border-gradient animate-gradient-move-soft" />
          </div>
          <div className="relative rounded-3xl bg-black p-5 min-w-[260px] max-w-xs mx-auto flex flex-col items-center shadow-lg shadow-blue-900/40">
            <CardHeader className="relative z-10 space-y-2 text-center p-0 mb-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mx-auto w-11 h-11 bg-gradient-to-br from-purple-600 via-blue-500 to-blue-400 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/40"
              >
                <Sparkles className="w-6 h-6 text-white drop-shadow" />
              </motion.div>
              <CardTitle className="text-lg font-bold bg-gradient-to-r from-purple-200 via-blue-200 to-blue-400 bg-clip-text text-transparent drop-shadow">
                Sign in to SmartStyle
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 space-y-3 p-0 w-full">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-purple-500 via-blue-400 to-blue-500 hover:from-purple-400 hover:via-blue-300 hover:to-blue-400 transition-all shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-purple-500/30 text-white"
                  size="lg"
                >
                  {googleLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Signing you in...
                    </>
                  ) : (
                    <>
                      <Chrome className="h-5 w-5 mr-2" />
                      Continue with Google
                    </>
                  )}
                </Button>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xs text-center text-gray-400"
              >
                By signing in, you agree to our Terms of Service and Privacy Policy.<br />Your data is encrypted and secure.
              </motion.p>
            </CardContent>
          </div>
          <style jsx global>{`
            .bg-border-gradient {
              background: linear-gradient(90deg, #7B68EE 0%, #6EC3F4 50%, #7B68EE 100%);
              background-size: 250% 250%;
              filter: blur(0.2px) brightness(1.1) drop-shadow(0 0 8px #7B68EE) drop-shadow(0 0 12px #6EC3F4);
              animation: gradient-move-soft 3s linear infinite;
            }
            @keyframes gradient-move-soft {
              0% { background-position: 0% 50%; }
              100% { background-position: 100% 50%; }
            }
          `}</style>
        </div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-center space-y-4"
        >
          <p className="text-sm text-gray-300 font-medium drop-shadow-md">Trusted by fashion enthusiasts worldwide</p>
          <div className="flex items-center justify-center space-x-6"></div>
        </motion.div>
      </motion.div>
      </div>
    </div>
  );
}
