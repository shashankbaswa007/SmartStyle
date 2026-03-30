'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Palette, Shirt } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { signInWithGoogle } from '@/lib/auth';
import { createUserDocument } from '@/lib/userService';
import { toast } from '@/hooks/use-toast';
import DarkVeil from '@/components/DarkVeil';
import { BRAND } from '@/lib/branding';
import { MOTION_DURATION, MOTION_EASING } from '@/lib/premium-motion';
import { useMotionSettings } from '@/components/MotionProvider';
import AnimatedLogo from '@/components/AnimatedLogo';
import { PremiumAuthLoader } from '@/components/auth/PremiumAuthLoader';

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.3s2.7-6.3 6-6.3c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 2.8 14.6 2 12 2 6.9 2 2.8 6.4 2.8 11.7S6.9 21.4 12 21.4c6.1 0 9.2-4.4 9.2-6.7 0-.5-.1-.9-.1-1.2H12Z" />
      <path fill="#4285F4" d="M21.1 13.5c.1.3.1.7.1 1.2 0 2.3-3.1 6.7-9.2 6.7-5.1 0-9.2-4.4-9.2-9.7S6.9 2 12 2c2.6 0 4.7.8 6.4 2.4l-2.6 2.5C15.1 6.2 13.9 5.4 12 5.4c-3.3 0-6 2.8-6 6.3s2.7 6.3 6 6.3c4 0 5.3-2.6 5.5-3.9h-5.5v-3.9h9.1Z" opacity=".18" />
      <path fill="#FBBC05" d="M4.8 7.3 L8 9.6c.9-2.1 2.7-3.5 5-3.5 1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 2.8 14.6 2 12 2 8 2 4.6 4.2 2.9 7.3l1.9 0Z" />
      <path fill="#34A853" d="M12 21.4c2.5 0 4.6-.8 6.2-2.3l-2.9-2.4c-.8.6-1.9 1-3.3 1-2.3 0-4.2-1.5-5-3.6l-3.1 2.5C5.5 19.5 8.5 21.4 12 21.4Z" />
    </svg>
  );
}

function AuthLoadingSplash() {
  return <PremiumAuthLoader statusText="Composing your style atmosphere" />;
}

export default function AuthPage() {
  const { user, loading: authLoading } = useAuth();
  const { prefersReducedMotion, duration } = useMotionSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';
  const [googleLoading, setGoogleLoading] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);

  const cardTransition = useMemo(
    () => ({
      duration: duration(MOTION_DURATION.cinematic, 'primary'),
      ease: MOTION_EASING.smooth,
    }),
    [duration]
  );

  useEffect(() => {
    if (!authLoading && user) {
      router.push(nextPath);
    }
  }, [user, authLoading, nextPath, router]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);

    try {
      const { user, error, redirecting } = await signInWithGoogle();

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Authentication Failed',
          description: error,
        });
        setGoogleLoading(false);
        return;
      }

      if (redirecting) {
        toast({
          title: 'Redirecting to Google',
          description: 'Complete sign-in and you will return automatically.',
        });
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

        router.push(nextPath);
      }

      setGoogleLoading(false);
    } catch (_error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'An unexpected error occurred. Please try again.',
      });
      setGoogleLoading(false);
    }
  };

  if (authLoading) {
    return <AuthLoadingSplash />;
  }

  if (user) {
    return null;
  }

  return (
    <div ref={sceneRef} className="relative min-h-[100dvh] md:min-h-screen flex flex-col md:flex-row overflow-x-hidden overflow-y-auto md:overflow-hidden bg-[#050813]">
      {/* LEFT PANEL (55% on desktop, full on mobile) */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={cardTransition}
        className="relative w-full md:w-[55%] flex items-center justify-center px-4 sm:px-6 py-10 sm:py-12 md:py-0 order-1"
      >
        {/* Background layers */}
        <div className="absolute inset-0 z-0">
          <DarkVeil
            hueShift={8}
            noiseIntensity={0.012}
            scanlineIntensity={0.018}
            speed={0.34}
            scanlineFrequency={0.001}
            warpAmount={0.03}
            resolutionScale={0.8}
          />
        </div>

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(circle at 10% 16%, rgba(14,165,233,0.18), transparent 33%), radial-gradient(circle at 92% 24%, rgba(59,130,246,0.2), transparent 43%), radial-gradient(circle at 74% 82%, rgba(6,182,212,0.12), transparent 42%), linear-gradient(138deg, rgba(2,6,23,0.78) 0%, rgba(7,12,28,0.85) 46%, rgba(2,6,23,0.84) 100%)',
          }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 z-0 opacity-[0.2]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '62px 62px',
          }}
        />

        {/* Noise overlay */}
        <div className="absolute inset-0 z-0 noise-overlay pointer-events-none" />

        {/* Drifting blobs animation */}
        {!prefersReducedMotion ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 top-16 h-[28rem] w-[28rem] rounded-full bg-teal-300/8 blur-[150px] z-0"
            animate={{ x: [-20, 20], y: [-30, 30], scale: [0.95, 1.05] }}
            transition={{ duration: 12, repeat: Infinity, repeatType: 'mirror' }}
          />
        ) : null}

        {!prefersReducedMotion ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -right-28 bottom-0 h-[32rem] w-[32rem] rounded-full bg-indigo-500/10 blur-[165px] z-0"
            animate={{ x: [20, -20], y: [30, -30], scale: [0.95, 1.05] }}
            transition={{ duration: 14, repeat: Infinity, repeatType: 'mirror' }}
          />
        ) : null}

        {/* Content */}
        <div className="relative z-10 max-w-2xl">
          {/* Logo and branding header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: prefersReducedMotion ? 0 : 0.15,
              ease: MOTION_EASING.graceful,
            }}
            className="flex flex-col items-center gap-2 mb-8"
          >
            <AnimatedLogo size={64} className="scale-90 sm:scale-100" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/72">Your Personal Style Assistant</p>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: prefersReducedMotion ? 0 : 0.3,
              ease: MOTION_EASING.graceful,
            }}
            className="font-headline text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-medium leading-[1.08] tracking-[-0.02em] text-white text-center mb-4"
          >
            Dress with clarity, not guesswork.
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: prefersReducedMotion ? 0 : 0.45,
              ease: MOTION_EASING.graceful,
            }}
            className="text-center text-sm sm:text-base md:text-lg text-slate-200/74 mb-8 leading-relaxed"
          >
            Build a sharper wardrobe identity with AI guidance tuned for tone, silhouette, and daily confidence.
          </motion.p>

          {/* Feature badges */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: prefersReducedMotion ? 0 : 0.6,
              ease: MOTION_EASING.graceful,
            }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4"
          >
            {/* Badge 1: Color Intelligence */}
            <div className="rounded-xl border-l-4 border-purple-600 bg-gradient-to-r from-purple-600/8 via-transparent to-transparent px-4 py-3 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <Palette className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/70 font-semibold">Color Intelligence</p>
                  <p className="mt-1 text-xs text-slate-200/80">Palette-led outfit decisions in seconds.</p>
                </div>
              </div>
            </div>

            {/* Badge 2: Wardrobe Precision */}
            <div className="rounded-xl border-l-4 border-purple-600 bg-gradient-to-r from-purple-600/8 via-transparent to-transparent px-4 py-3 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <Shirt className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/70 font-semibold">Wardrobe Precision</p>
                  <p className="mt-1 text-xs text-slate-200/80">Recommendations grounded in your closet.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* VERTICAL DIVIDER */}
      <div
        className="hidden md:block absolute left-[55%] top-0 h-full w-px z-20 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent, #7c3aed, transparent)',
        }}
      />

      {/* RIGHT PANEL (45% on desktop, full on mobile) */}
      <motion.section
        initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          ...cardTransition,
          delay: prefersReducedMotion ? 0 : 0.4,
        }}
        className="relative w-full md:w-[45%] flex items-center justify-center px-4 sm:px-6 py-10 sm:py-12 md:py-0 order-2 md:order-2 bg-[#0a0a0f]"
      >
        {/* Auth Card */}
        <div className="w-full max-w-md sm:max-w-sm">
          {/* Logo at top */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: prefersReducedMotion ? 0 : 0.5,
              ease: MOTION_EASING.graceful,
            }}
            className="flex justify-center mb-5 sm:mb-6"
          >
            <AnimatedLogo size={72} className="scale-90 sm:scale-100" />
          </motion.div>

          {/* Title and subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: prefersReducedMotion ? 0 : 0.55,
              ease: MOTION_EASING.graceful,
            }}
            className="text-center mb-8 sm:mb-10"
          >
            <h2 className="font-headline text-2xl font-semibold tracking-wide text-white">SmartStyle</h2>
            <p className="text-xs tracking-widest text-gray-500 uppercase mt-1.5">Your Personal Style Assistant</p>
          </motion.div>

          {/* Google Sign-In Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: prefersReducedMotion ? 0 : 0.6,
              ease: MOTION_EASING.graceful,
            }}
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="group relative w-full h-[52px] rounded-full bg-gradient-to-r from-purple-700 via-purple-600 to-purple-700 text-white font-medium text-base flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(147,51,234,0.5)] hover:translate-y-[-2px] active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
          >
            {/* Shimmer effect on hover */}
            <motion.div
              className="absolute inset-0 opacity-0 group-hover:opacity-100"
              initial={{ x: '-100%' }}
              whileHover={{
                x: '100%',
              }}
              transition={{
                duration: 0.6,
                ease: 'easeInOut',
              }}
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              }}
            />

            <span className="relative flex items-center gap-2 z-10">
              {googleLoading ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse" />
                  </span>
                  <span>Preparing workspace...</span>
                </>
              ) : (
                <>
                  <GoogleGlyph />
                  <span>Continue with Google</span>
                </>
              )}
            </span>
          </motion.button>

          {/* Legal text */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: prefersReducedMotion ? 0 : 0.65,
              ease: MOTION_EASING.graceful,
            }}
            className="mt-6 text-center text-[11px] leading-relaxed text-slate-400"
          >
            By signing in you agree to our{' '}
            <Link href="/terms" className="text-purple-400 underline underline-offset-1 hover:text-purple-300 transition-colors">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-purple-400 underline underline-offset-1 hover:text-purple-300 transition-colors">
              Privacy Policy
            </Link>
            . Learn more in the{' '}
            <Link href="/trust" className="text-purple-400 underline underline-offset-1 hover:text-purple-300 transition-colors">
              Trust Center
            </Link>
            .
          </motion.p>
        </div>
      </motion.section>

      {/* Footer branding */}
      <div className="hidden md:block absolute bottom-4 left-0 right-0 text-center text-[11px] uppercase tracking-[0.22em] text-slate-400/56 z-10">
        {BRAND.name} • AI Fashion Intelligence
      </div>

      <div className="md:hidden px-4 pb-6 text-center text-[10px] uppercase tracking-[0.18em] text-slate-400/56">
        {BRAND.name} • AI Fashion Intelligence
      </div>
    </div>
  );
}
