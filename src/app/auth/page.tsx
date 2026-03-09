'use client';

/**
 * Authentication Page - First screen users see when opening the app
 * 
 * Features:
 * - Google Sign-In with OAuth 2.0
 * - Automatic user document creation in Firestore
 * - Stores user profile data (name, email, photo)
 * - Redirects to home page after successful authentication
 * - Interactive DotGrid background with glassmorphic card
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/components/auth/AuthProvider';
import { signInWithGoogle } from '@/lib/auth';
import { createUserDocument } from '@/lib/userService';

import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Chrome } from 'lucide-react';
import DotGrid from '@/components/DotGrid';

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
    <div className="relative min-h-screen overflow-hidden bg-[#0a0612]">
      {/* DotGrid Animated Background — sits at z-0 so card floats over it */}
      <div className="absolute inset-0 z-0">
        <DotGrid
          dotSize={5}
          gap={15}
          baseColor="#271E37"
          activeColor="#5227FF"
          proximity={120}
          shockRadius={250}
          shockStrength={5}
          resistance={750}
          returnDuration={1.5}
        />
      </div>

      {/* Auth Card — pointer-events-none on wrapper lets clicks pass to DotGrid, auto on card itself */}
      <div className="absolute inset-0 z-10 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto w-full max-w-[340px]"
        >
          {/* Glassmorphic card with animated glow ring */}
          <div className="relative rounded-3xl">
            {/* Animated glow ring behind the card */}
            <div className="absolute -inset-[1px] rounded-3xl auth-glow-ring" />

            {/* Card body — translucent glass */}
            <div className="relative rounded-3xl backdrop-blur-xl bg-[#110d1d]/70 border border-white/[0.06] px-7 py-8 flex flex-col items-center gap-5 shadow-[0_8px_60px_-12px_rgba(82,39,255,0.35)]">

              {/* Logo mark */}
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.25, type: 'spring', stiffness: 200, damping: 14 }}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#5227FF] via-[#7B68EE] to-[#5227FF] flex items-center justify-center shadow-lg shadow-[#5227FF]/40 ring-1 ring-white/10"
              >
                <Sparkles className="w-7 h-7 text-white" />
              </motion.div>

              {/* Title */}
              <div className="text-center space-y-1">
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="text-xl font-bold tracking-tight text-white"
                >
                  SmartStyle
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="text-sm text-[#9b8ec4]"
                >
                  AI-powered fashion, just for you
                </motion.p>
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-gradient-to-r from-transparent via-[#5227FF]/30 to-transparent" />

              {/* Google Sign-In button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="w-full"
              >
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="w-full h-12 text-sm font-semibold rounded-xl bg-[#5227FF] hover:bg-[#6840ff] active:scale-[0.98] transition-all duration-200 text-white shadow-lg shadow-[#5227FF]/30 hover:shadow-xl hover:shadow-[#5227FF]/40 border border-white/[0.08]"
                  size="lg"
                >
                  {googleLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2.5 animate-spin" />
                      Signing you in…
                    </>
                  ) : (
                    <>
                      <Chrome className="h-5 w-5 mr-2.5" />
                      Continue with Google
                    </>
                  )}
                </Button>
              </motion.div>

              {/* Footer text */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="text-[11px] leading-relaxed text-center text-[#6b5f8a]"
              >
                By signing in you agree to our Terms&nbsp;of&nbsp;Service
                <br />and Privacy&nbsp;Policy. Your data is encrypted.
              </motion.p>
            </div>
          </div>

          {/* Trust line beneath card */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75 }}
            className="mt-6 text-center text-xs text-[#4a3f6b] tracking-wide"
          >
            Trusted by fashion enthusiasts worldwide
          </motion.p>
        </motion.div>
      </div>

      {/* Scoped styles for the glow ring */}
      <style jsx global>{`
        .auth-glow-ring {
          background: conic-gradient(
            from 0deg,
            #5227FF 0%,
            #271E37 25%,
            #5227FF 50%,
            #271E37 75%,
            #5227FF 100%
          );
          animation: auth-ring-spin 6s linear infinite;
          opacity: 0.55;
          filter: blur(1.5px);
        }
        @keyframes auth-ring-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
