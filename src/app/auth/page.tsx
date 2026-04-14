'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Palette, Shirt } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { consumeGoogleRedirectResult, signInWithGoogle } from '@/lib/auth';
import { getCurrentUser } from '@/lib/auth';
import { createUserDocument } from '@/lib/userService';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import DarkVeil from '@/components/DarkVeil';
import { BRAND } from '@/lib/branding';
import { MOTION_DURATION, MOTION_EASING } from '@/lib/premium-motion';
import { useMotionSettings } from '@/components/MotionProvider';
import AnimatedLogo from '@/components/AnimatedLogo';
import { PremiumAuthLoader } from '@/components/auth/PremiumAuthLoader';
import { publicRolloutFlags } from '@/lib/public-rollout-flags';

const LOGIN_GRACE_KEY = 'smartstyle_login_grace_ts';

function markLoginGraceWindow() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(LOGIN_GRACE_KEY, Date.now().toString());
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden="true" shapeRendering="geometricPrecision">
      <path fill="#EA4335" d="M24 9.5c3.2 0 6.1 1.1 8.4 3.2l6.3-6.3C34.8 2.8 29.8 1 24 1 14.7 1 6.7 6.3 2.7 14l7.8 6.1C12.3 13.8 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.7-.2-3.4-.6-5H24v9.2h12.5c-.5 3-2.2 5.6-4.7 7.3l7.3 5.7c4.3-4 6.8-9.9 6.8-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.3-.8-2.8-.8-4.3s.3-3 .8-4.3L2.7 14C1.6 17.1 1 20.5 1 24.3c0 3.8.6 7.2 1.7 10.3l7.8-6z" />
      <path fill="#34A853" d="M24 47.5c5.8 0 10.7-1.9 14.3-5.1L31 36.7c-2 1.3-4.4 2.1-7 2.1-6.3 0-11.7-4.2-13.6-10.1l-7.8 6c4 7.8 12 12.8 21.4 12.8z" />
    </svg>
  );
}

function AuthLoadingSplash() {
  return (
    <PremiumAuthLoader
      premium={publicRolloutFlags.premiumAuthLoader}
      statusText="Composing your style atmosphere"
    />
  );
}

export default function AuthPage() {
  const { user, loading: authLoading } = useAuth();
  const { prefersReducedMotion, duration } = useMotionSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';
  const [googleLoading, setGoogleLoading] = useState(false);
  const [finalizingSession, setFinalizingSession] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const hasRedirectedRef = useRef(false);
  const handledRedirectResultRef = useRef(false);

  const resolveNextPath = (rawPath: string): string => {
    if (!rawPath || rawPath === '/auth') return '/';
    return rawPath;
  };

  const navigateAfterAuth = useCallback((rawPath: string) => {
    const destination = resolveNextPath(rawPath);
    if (typeof window !== 'undefined') {
      window.location.assign(destination);
      return;
    }
    router.replace(destination);
  }, [router]);

  const establishSessionCookie = async (idToken: string): Promise<boolean> => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
          body: JSON.stringify({ idToken }),
          credentials: 'include',
        });

        if (response.ok) {
          return true;
        }
      } catch {
        // Retry transient network/session route failures.
      }

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }

    return false;
  };

  const ensureUserDocument = async (uid: string, profile: {
    displayName: string;
    email: string;
    photoURL: string;
    provider: 'google';
    createdAt: string;
    lastLoginAt: string;
  }): Promise<void> => {
    try {
      await createUserDocument(uid, profile);
    } catch (error) {
      // Database write should not block sign-in completion.
      logger.warn('User document sync failed during sign-in; continuing', error);
    }
  };

  const cardTransition = useMemo(
    () => ({
      duration: duration(MOTION_DURATION.cinematic, 'primary'),
      ease: MOTION_EASING.smooth,
    }),
    [duration]
  );

  useEffect(() => {
    const handleRedirectResult = async () => {
      if (handledRedirectResultRef.current) return;
      handledRedirectResultRef.current = true;

      logger.info('Auth page: checking redirect result', { nextPath });

      const { user: redirectUser, error } = await consumeGoogleRedirectResult();
      if (error) {
        logger.warn('Auth page: redirect result returned error', { error });
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: error,
        });
      }

      if (!redirectUser) {
        logger.info('Auth page: no redirect user resolved');
        return;
      }

      logger.info('Auth page: redirect user resolved, establishing session', {
        userId: redirectUser.uid,
      });

      setFinalizingSession(true);
      try {
        const idToken = await redirectUser.getIdToken();
        const ok = await establishSessionCookie(idToken);
        if (!ok) {
          logger.warn('Auth page: failed to establish session cookie for redirect user');
          toast({
            variant: 'destructive',
            title: 'Sign-in incomplete',
            description: 'Could not establish a secure session. Please try again.',
          });
          return;
        }

        await ensureUserDocument(redirectUser.uid, {
          displayName: redirectUser.displayName || 'Anonymous User',
          email: redirectUser.email || '',
          photoURL: redirectUser.photoURL || '',
          provider: 'google',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        });

        logger.info('Auth page: redirect session established, navigating', { nextPath });
        markLoginGraceWindow();
        navigateAfterAuth(nextPath);
      } finally {
        setFinalizingSession(false);
      }
    };

    void handleRedirectResult();
  }, [navigateAfterAuth, nextPath]);

  useEffect(() => {
    const finalizeRedirect = async () => {
      if (authLoading || !user || hasRedirectedRef.current) {
        return;
      }

      hasRedirectedRef.current = true;
      setFinalizingSession(true);

      try {
        const idToken = await user.getIdToken();
        const ok = await establishSessionCookie(idToken);
        if (!ok) {
          hasRedirectedRef.current = false;
          toast({
            variant: 'destructive',
            title: 'Sign-in incomplete',
            description: 'Could not establish a secure session. Please try signing in again.',
          });
          return;
        }

        navigateAfterAuth(nextPath);
      } catch {
        hasRedirectedRef.current = false;
        toast({
          variant: 'destructive',
          title: 'Sign-in incomplete',
          description: 'Could not complete login. Please try again.',
        });
      } finally {
        setFinalizingSession(false);
      }
    };

    void finalizeRedirect();
  }, [user, authLoading, nextPath, navigateAfterAuth]);

  useEffect(() => {
    let cancelled = false;

    const recoverMissedRedirectSession = async () => {
      if (authLoading || finalizingSession || user) {
        return;
      }

      const fallbackUser = getCurrentUser();
      if (!fallbackUser || hasRedirectedRef.current) {
        return;
      }

      logger.info('Auth page: recovering session from currentUser fallback', {
        userId: fallbackUser.uid,
      });

      hasRedirectedRef.current = true;
      setFinalizingSession(true);

      try {
        const idToken = await fallbackUser.getIdToken();
        const ok = await establishSessionCookie(idToken);
        if (!ok) {
          hasRedirectedRef.current = false;
          logger.warn('Auth page: fallback currentUser session establishment failed');
          return;
        }

        await ensureUserDocument(fallbackUser.uid, {
          displayName: fallbackUser.displayName || 'Anonymous User',
          email: fallbackUser.email || '',
          photoURL: fallbackUser.photoURL || '',
          provider: 'google',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        });

        if (cancelled) return;
        markLoginGraceWindow();
        navigateAfterAuth(nextPath);
      } finally {
        if (!cancelled) {
          setFinalizingSession(false);
        }
      }
    };

    void recoverMissedRedirectSession();

    return () => {
      cancelled = true;
    };
  }, [authLoading, finalizingSession, user, navigateAfterAuth, nextPath]);

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
        const ok = await establishSessionCookie(idToken);
        if (!ok) {
          toast({
            variant: 'destructive',
            title: 'Sign-in incomplete',
            description: 'Could not establish a secure session. Please try again.',
          });
          setGoogleLoading(false);
          return;
        }

        await ensureUserDocument(user.uid, {
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

        markLoginGraceWindow();
        navigateAfterAuth(nextPath);
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

  if (authLoading || finalizingSession) {
    return <AuthLoadingSplash />;
  }

  if (user) {
    return null;
  }

  return (
    <div ref={sceneRef} className="relative min-h-[100svh] md:min-h-screen flex flex-col md:flex-row overflow-x-hidden bg-[#050813]">
      {/* LEFT PANEL (55% on desktop, full on mobile) */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={cardTransition}
        className="relative w-full md:w-[55%] flex items-center justify-center px-4 sm:px-6 py-6 sm:py-8 md:py-0 order-1"
      >
        {/* Background layers */}
        <div className="absolute inset-0 z-0">
          <DarkVeil
            hueShift={10}
            noiseIntensity={0.014}
            scanlineIntensity={0.02}
            speed={0.3}
            scanlineFrequency={0.001}
            warpAmount={0.03}
            resolutionScale={1}
          />
        </div>


        {/* Content */}
        <div className="relative z-10 max-w-2xl w-full space-y-6 sm:space-y-7">
          {/* Logo and branding header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: prefersReducedMotion ? 0 : 0.15,
              ease: MOTION_EASING.graceful,
            }}
            className="flex flex-col items-center gap-2 mb-6 sm:mb-8"
          >
            <AnimatedLogo size={64} className="scale-90 sm:scale-100" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-100/80">Your Personal Style Assistant</p>
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
            className="font-headline text-2xl sm:text-4xl md:text-5xl xl:text-6xl font-medium leading-[1.15] tracking-[-0.02em] text-white text-center mb-3 sm:mb-4 text-balance"
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
            className="text-center text-sm sm:text-base md:text-lg text-slate-200/74 mb-6 sm:mb-8 leading-relaxed break-words"
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
            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4"
          >
            {/* Badge 1: Color Intelligence */}
            <div className="rounded-xl border-l-4 border-purple-600 bg-gradient-to-r from-purple-600/8 via-transparent to-transparent px-3.5 py-3 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <Palette className="h-5 w-5 text-slate-200 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-100/85 font-semibold">Color Intelligence</p>
                  <p className="mt-1 text-xs text-slate-200/80">Palette-led outfit decisions in seconds.</p>
                </div>
              </div>
            </div>

            {/* Badge 2: Wardrobe Precision */}
            <div className="rounded-xl border-l-4 border-purple-600 bg-gradient-to-r from-purple-600/8 via-transparent to-transparent px-3.5 py-3 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <Shirt className="h-5 w-5 text-slate-200 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-100/85 font-semibold">Wardrobe Precision</p>
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
        className="relative w-full md:w-[45%] flex items-center justify-center px-4 sm:px-6 py-6 sm:py-8 md:py-0 order-2 md:order-2 bg-[#0a0a0f]"
      >
        {/* Auth Card */}
        <div className="w-full max-w-md sm:max-w-sm">
          <div className="auth-matte-card relative overflow-hidden rounded-[26px] border border-slate-200/10 px-6 py-7 sm:px-7 sm:py-8">
            <div className="auth-matte-grain pointer-events-none absolute inset-0" aria-hidden="true" />
            <div className="relative z-10">
              {/* Logo at top */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: prefersReducedMotion ? 0 : 0.5,
                  ease: MOTION_EASING.graceful,
                }}
                className="flex justify-center mb-4 sm:mb-6"
              >
                <AnimatedLogo size={64} className="scale-90 sm:scale-100" />
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
                className="text-center mb-6 sm:mb-10"
              >
                <h2 className="font-headline text-2xl font-semibold tracking-wide text-white">SmartStyle</h2>
                <p className="text-xs tracking-widest text-slate-400 uppercase mt-1.5">Your Personal Style Assistant</p>
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
                className="group relative w-full h-[48px] sm:h-[52px] rounded-full bg-gradient-to-r from-purple-700 via-purple-600 to-purple-700 text-white font-medium text-sm sm:text-base flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(147,51,234,0.5)] hover:translate-y-[-2px] active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
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

                <span className="relative flex items-center gap-2 z-10 whitespace-nowrap">
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
                className="mt-5 sm:mt-6 text-center text-[11px] leading-relaxed text-slate-400 break-words"
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
          </div>
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
