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
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/components/auth/AuthProvider';
import { signInWithGoogle } from '@/lib/auth';
import { createUserDocument } from '@/lib/userService';

import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Chrome } from 'lucide-react';
import dynamic from 'next/dynamic';
const DotGrid = dynamic(() => import('@/components/DotGrid'), { ssr: false });

export default function AuthPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';
  const [googleLoading, setGoogleLoading] = useState(false);

  // Redirect to home if user is already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      router.push(nextPath);
    }
  }, [user, authLoading, nextPath, router]);

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
        const idToken = await user.getIdToken();
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
          credentials: 'include',
        });

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
        // Redirect to requested path or home page
        router.push(nextPath);
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
    <div className="relative min-h-screen overflow-hidden bg-[#06020f]">
      {/* DotGrid Animated Background */}
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

      {/* Ambient gradient glow behind the card area */}
      <div className="absolute inset-0 z-[1] pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full bg-[#5227FF]/[0.07] blur-[120px]" />
      </div>

      {/* Auth Card — pointer-events-none on wrapper lets clicks pass to DotGrid */}
      <div className="absolute inset-0 z-10 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto w-full max-w-[360px]"
        >
          {/* Glassmorphic card with animated border */}
          <div className="relative rounded-[28px] auth-card-wrapper group">
            {/* Animated gradient border — rotating conic gradient */}
            <div className="absolute -inset-[1.5px] rounded-[28px] auth-glow-ring" />

            {/* Outer glass highlight — top edge refraction line */}
            <div className="absolute inset-[1px] rounded-[27px] overflow-hidden pointer-events-none">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            {/* Card body — deep frosted glass */}
            <div className="relative rounded-[27px] overflow-hidden">
              {/* Multi-layer glassmorphism background */}
              <div className="absolute inset-0 backdrop-blur-2xl bg-gradient-to-b from-[#160f28]/80 via-[#0e0a1a]/75 to-[#0a0714]/80" />

              {/* Subtle inner gradient sheen — mimics light refraction on frosted glass */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#5227FF]/[0.06] via-transparent to-[#7B68EE]/[0.04]" />

              {/* Noise texture overlay for that frosted-glass grain */}
              <div className="absolute inset-0 opacity-[0.03] auth-noise" />

              {/* Top inner glow — subtle light coming from above */}
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#5227FF]/[0.08] to-transparent pointer-events-none" />

              {/* Content layer */}
              <div className="relative px-8 py-10 flex flex-col items-center gap-6">

                {/* Logo mark with gradient glow */}
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.25, type: 'spring', stiffness: 200, damping: 14 }}
                  className="relative"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[#5227FF]/40 blur-xl scale-150" />
                  <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6B3FFF] via-[#5227FF] to-[#3D18CC] flex items-center justify-center shadow-xl shadow-[#5227FF]/50 ring-1 ring-white/[0.12]">
                    <Sparkles className="w-7 h-7 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]" />
                  </div>
                </motion.div>

                {/* Title block */}
                <div className="text-center space-y-1.5">
                  <motion.h1
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="text-2xl font-bold tracking-tight bg-gradient-to-b from-white via-white/90 to-[#a78bfa] bg-clip-text text-transparent"
                  >
                    SmartStyle
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.45 }}
                    className="text-sm text-[#9b8ec4]/80 font-medium"
                  >
                    AI-powered fashion, just for you
                  </motion.p>
                </div>

                {/* Gradient divider */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-[#5227FF]/25 to-transparent" />

                {/* Google Sign-In button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="w-full"
                >
                  <div className="relative group/btn">
                    {/* Button glow on hover */}
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#5227FF] to-[#7B68EE] opacity-0 group-hover/btn:opacity-30 blur-lg transition-opacity duration-500" />
                    <Button
                      onClick={handleGoogleSignIn}
                      disabled={googleLoading}
                      className="relative w-full h-12 text-sm font-semibold rounded-xl bg-gradient-to-r from-[#5227FF] via-[#6038EE] to-[#7B68EE] hover:from-[#6038EE] hover:via-[#6B3FFF] hover:to-[#8B7AFF] active:scale-[0.98] transition-all duration-300 text-white shadow-lg shadow-[#5227FF]/25 border border-white/[0.08]"
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
                  </div>
                </motion.div>

                {/* Footer text */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.65 }}
                  className="text-[11px] leading-relaxed text-center text-[#6b5f8a]/80"
                >
                  By signing in you agree to our{' '}
                  <Link href="/terms" className="underline hover:text-[#b8a9e8]">Terms of Service</Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="underline hover:text-[#b8a9e8]">Privacy Policy</Link>.
                  <br />Read our <Link href="/trust" className="underline hover:text-[#b8a9e8]">Trust Center</Link> for data handling details.
                </motion.p>
              </div>
            </div>
          </div>

          {/* Trust line beneath card */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75 }}
            className="mt-7 text-center text-xs text-[#4a3f6b]/70 tracking-wide font-medium"
          >
            Trusted by fashion enthusiasts worldwide
          </motion.p>
        </motion.div>
      </div>

      {/* Scoped styles */}
      <style jsx global>{`
        .auth-glow-ring {
          background: conic-gradient(
            from 0deg,
            #5227FF 0%,
            #271E37 20%,
            #7B68EE 40%,
            #271E37 60%,
            #5227FF 80%,
            #271E37 100%
          );
          animation: auth-ring-spin 8s linear infinite;
          opacity: 0.5;
          filter: blur(1px);
        }
        .auth-card-wrapper:hover .auth-glow-ring {
          opacity: 0.7;
          filter: blur(1.5px);
        }
        @keyframes auth-ring-spin {
          to { transform: rotate(360deg); }
        }
        .auth-noise {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-size: 128px 128px;
        }
      `}</style>
    </div>
  );
}
