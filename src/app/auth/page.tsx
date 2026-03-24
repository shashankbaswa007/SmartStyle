'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/components/auth/AuthProvider';
import { signInWithGoogle } from '@/lib/auth';
import { createUserDocument } from '@/lib/userService';

import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import DarkVeil from '@/components/DarkVeil';
import { BRAND } from '@/lib/branding';
import { MOTION_DURATION, MOTION_EASING } from '@/lib/premium-motion';
import { useMotionSettings } from '@/components/MotionProvider';
import { BrandedLogo } from '@/components/auth/BrandedLogo';
import { PremiumAuthLoader } from '@/components/auth/PremiumAuthLoader';

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.3s2.7-6.3 6-6.3c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 2.8 14.6 2 12 2 6.9 2 2.8 6.4 2.8 11.7S6.9 21.4 12 21.4c6.1 0 9.2-4.4 9.2-6.7 0-.5-.1-.9-.1-1.2H12Z" />
      <path fill="#4285F4" d="M21.1 13.5c.1.3.1.7.1 1.2 0 2.3-3.1 6.7-9.2 6.7-5.1 0-9.2-4.4-9.2-9.7S6.9 2 12 2c2.6 0 4.7.8 6.4 2.4l-2.6 2.5C15.1 6.2 13.9 5.4 12 5.4c-3.3 0-6 2.8-6 6.3s2.7 6.3 6 6.3c4 0 5.3-2.6 5.5-3.9h-5.5v-3.9h9.1Z" opacity=".18" />
      <path fill="#FBBC05" d="M4.8 7.3 8 9.6c.9-2.1 2.7-3.5 5-3.5 1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 2.8 14.6 2 12 2 8 2 4.6 4.2 2.9 7.3l1.9 0Z" />
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
  const [portalLight, setPortalLight] = useState({ x: 50, y: 24 });
  const [leftGlowVisible, setLeftGlowVisible] = useState(false);
  const [leftIntroReady, setLeftIntroReady] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const leftGlowPoint = useRef({ x: 50, y: 50 });

  const cardTransition = useMemo(
    () => ({
      duration: duration(MOTION_DURATION.cinematic, 'primary'),
      ease: MOTION_EASING.smooth,
    }),
    [duration]
  );

  useEffect(() => {
    setLeftIntroReady(true);
  }, []);

  const handlePortalPointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPortalLight({ x, y });
  };

  const handlePortalPointerLeave = () => {
    setPortalLight({ x: 50, y: 24 });
  };

  const handleScenePointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !sceneRef.current) {
      return;
    }

    const rect = sceneRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    sceneRef.current.style.setProperty('--scene-x', x.toFixed(3));
    sceneRef.current.style.setProperty('--scene-y', y.toFixed(3));
  };

  const handleScenePointerLeave = () => {
    if (!sceneRef.current) {
      return;
    }

    sceneRef.current.style.setProperty('--scene-x', '0');
    sceneRef.current.style.setProperty('--scene-y', '0');
  };

  const handleLeftPanelPointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !leftPanelRef.current) {
      return;
    }

    const rect = leftPanelRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    leftGlowPoint.current = { x, y };
    leftPanelRef.current.style.setProperty('--gx', `${x.toFixed(2)}%`);
    leftPanelRef.current.style.setProperty('--gy', `${y.toFixed(2)}%`);
    setLeftGlowVisible(true);
  };

  const handleLeftPanelPointerLeave = () => {
    if (prefersReducedMotion) {
      return;
    }

    setLeftGlowVisible(false);
  };

  useEffect(() => {
    if (!authLoading && user) {
      router.push(nextPath);
    }
  }, [user, authLoading, nextPath, router]);

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
    <div
      ref={sceneRef}
      onMouseMove={handleScenePointerMove}
      onMouseLeave={handleScenePointerLeave}
      className="relative h-[calc(100dvh-5rem)] min-h-[calc(100svh-5rem)] overflow-hidden bg-[#050813]"
      style={{
        '--scene-x': 0,
        '--scene-y': 0,
      } as React.CSSProperties}
    >
      <div className="absolute inset-0">
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
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle_at_10%_16%,rgba(14,165,233,0.18),transparent_33%),radial-gradient(circle_at_92%_24%,rgba(59,130,246,0.2),transparent_43%),radial-gradient(circle_at_74%_82%,rgba(6,182,212,0.12),transparent_42%),linear-gradient(138deg,rgba(2,6,23,0.78)_0%,rgba(7,12,28,0.85)_46%,rgba(2,6,23,0.84)_100%)',
          transform: 'translate3d(calc(var(--scene-x) * 8px), calc(var(--scene-y) * 6px), 0)',
          transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.2]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)',
          backgroundSize: '62px 62px',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_110%_at_50%_115%,rgba(0,0,0,0.68),transparent_72%)]"
        style={{
          transform: 'translate3d(calc(var(--scene-x) * -3px), calc(var(--scene-y) * -2px), 0)',
          transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      {!prefersReducedMotion ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 top-16 h-[28rem] w-[28rem] rounded-full bg-teal-300/8 blur-[150px]"
          animate={{ opacity: [0.12, 0.18, 0.13], x: [0, 10, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}

      {!prefersReducedMotion ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 bottom-0 h-[32rem] w-[32rem] rounded-full bg-indigo-500/10 blur-[165px]"
          animate={{ opacity: [0.11, 0.2, 0.12], x: [0, -8, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}

      <div className="relative z-10 flex h-full min-h-0 flex-col px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5 lg:px-8">
        <div className="mx-auto grid w-full max-w-[86rem] flex-1 min-h-0 items-stretch gap-5 lg:grid-cols-[1.25fr_0.75fr] lg:gap-7 xl:gap-8">
          <motion.section
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={cardTransition}
            className="relative order-2 min-h-0 lg:order-1 lg:flex lg:items-center lg:pr-4"
          >
            <motion.div
              ref={leftPanelRef}
              onMouseMove={handleLeftPanelPointerMove}
              onMouseLeave={handleLeftPanelPointerLeave}
              className="relative mx-auto w-full max-w-[42rem] overflow-hidden rounded-[2.2rem] border border-white/[0.1] backdrop-blur-2xl"
              style={{
                '--gx': '50%',
                '--gy': '50%',
                transform: 'translate3d(calc(var(--scene-x) * -4px), calc(var(--scene-y) * -3px), 0)',
                transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
              } as React.CSSProperties}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 60%, #10101a 100%)',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[2.2rem]"
                style={{
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -24px 36px rgba(0,0,0,0.28)',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-[60px] -top-[60px] h-80 w-80 rounded-full blur-[50px]"
                style={{
                  background: 'radial-gradient(circle, rgba(109,40,217,0.14) 0%, transparent 70%)',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-10 bottom-10 h-[260px] w-[260px] rounded-full blur-[45px]"
                style={{
                  background: 'radial-gradient(circle, rgba(124,58,237,0.11) 0%, transparent 70%)',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-5 top-[45%] h-[160px] w-[160px] rounded-full blur-[35px]"
                style={{
                  background: 'radial-gradient(circle, rgba(79,70,229,0.06) 0%, transparent 70%)',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle 220px at var(--gx) var(--gy), rgba(124,58,237,0.16) 0%, transparent 70%)',
                  opacity: prefersReducedMotion ? 0 : leftGlowVisible ? 1 : 0,
                  transition: leftGlowVisible ? 'none' : 'opacity 1.5s ease',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                  opacity: 0.18,
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-1/2 h-[180px] -translate-y-1/2"
                style={{
                  background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.018) 50%, transparent 100%)',
                }}
              />

              <div className="relative z-20 px-6 py-8 sm:px-8 sm:py-10 lg:px-8 xl:px-9">
                <div>
                  <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={leftIntroReady ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      delay: prefersReducedMotion ? 0 : 0.15,
                      duration: duration(0.6, 'primary'),
                      ease: MOTION_EASING.graceful,
                    }}
                    className="h-px w-24"
                    style={{
                      background: 'linear-gradient(90deg, rgba(56,189,248,0.25), transparent)',
                    }}
                  />
                  <motion.p
                    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                    animate={leftIntroReady ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      delay: prefersReducedMotion ? 0 : 0.2,
                      duration: duration(0.6, 'primary'),
                      ease: MOTION_EASING.graceful,
                    }}
                    className="mt-4 text-[11px] uppercase tracking-[0.18em] text-cyan-100/72"
                  >
                    SmartStyle Studio Access
                  </motion.p>
                </div>

                <div className="mt-7 max-w-[32rem]">
                    <motion.div
                      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
                      animate={leftIntroReady ? { opacity: 1, y: 0 } : {}}
                      transition={{
                        delay: prefersReducedMotion ? 0 : 0.3,
                        duration: duration(0.7, 'primary'),
                        ease: MOTION_EASING.graceful,
                      }}
                      className="h-px w-[100px]"
                      style={{
                        background: 'linear-gradient(90deg, rgba(167,139,250,0.4), transparent)',
                      }}
                    />

                    <motion.h1
                      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
                      animate={leftIntroReady ? { opacity: 1, y: 0 } : {}}
                      transition={{
                        delay: prefersReducedMotion ? 0 : 0.6,
                        duration: duration(0.7, 'primary'),
                        ease: MOTION_EASING.graceful,
                      }}
                      className="mt-5 font-headline text-[2.1rem] font-medium leading-[1.06] tracking-[-0.018em] text-white sm:text-[2.6rem] lg:text-[2.95rem]"
                    >
                      Dress with clarity, not guesswork.
                    </motion.h1>

                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={leftIntroReady ? { opacity: 1 } : {}}
                      transition={{
                        delay: prefersReducedMotion ? 0 : 1.1,
                        duration: duration(0.7, 'primary'),
                        ease: MOTION_EASING.graceful,
                      }}
                      className="mt-4 max-w-[28rem] text-sm leading-relaxed text-slate-200/74"
                    >
                      Build a sharper wardrobe identity with AI guidance tuned for tone, silhouette, and daily confidence.
                    </motion.p>

                    <motion.div
                      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                      animate={leftIntroReady ? { opacity: 1, y: 0 } : {}}
                      transition={{
                        delay: prefersReducedMotion ? 0 : 1.25,
                        duration: duration(0.65, 'primary'),
                        ease: MOTION_EASING.graceful,
                      }}
                      className="mt-6 grid max-w-[28rem] grid-cols-2 gap-3"
                    >
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/70">Color Intelligence</p>
                        <p className="mt-1 text-xs text-slate-200/80">Palette-led outfit decisions in seconds.</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/70">Wardrobe Precision</p>
                        <p className="mt-1 text-xs text-slate-200/80">Recommendations grounded in your closet.</p>
                      </div>
                    </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24, scale: prefersReducedMotion ? 1 : 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={cardTransition}
            className="order-1 flex min-h-0 w-full items-center justify-center lg:order-2 lg:items-center lg:justify-end"
          >
            <div
              className="relative w-full max-w-[27.5rem] rounded-[2.2rem] border border-white/12 bg-slate-950/72 p-1 shadow-[0_24px_56px_rgba(8,12,24,0.52)] backdrop-blur-2xl"
              onMouseMove={handlePortalPointerMove}
              onMouseLeave={handlePortalPointerLeave}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[2.2rem]"
                style={{
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -28px 44px rgba(0,0,0,0.36)',
                }}
              />

              {!prefersReducedMotion ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[2.2rem] transition-opacity duration-300"
                  style={{
                    opacity: 0.38,
                    background: `radial-gradient(circle at ${portalLight.x}% ${portalLight.y}%, rgba(226,232,240,0.18) 0%, rgba(226,232,240,0.08) 20%, transparent 56%)`,
                  }}
                />
              ) : null}

              {!prefersReducedMotion ? (
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0, x: '-110%' }}
                  animate={{ opacity: [0, 0.35, 0], x: ['-110%', '22%', '120%'] }}
                  transition={{
                    delay: 0.34,
                    duration: duration(MOTION_DURATION.cinematic + 0.55, 'secondary'),
                    ease: MOTION_EASING.smooth,
                  }}
                  className="pointer-events-none absolute inset-y-4 left-[-35%] right-[-35%] rounded-[1.8rem]"
                  style={{
                    background:
                      'linear-gradient(102deg, transparent 24%, rgba(226,232,240,0.22) 48%, rgba(226,232,240,0.08) 55%, transparent 74%)',
                    filter: 'blur(7px)',
                  }}
                />
              ) : null}

              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-[1px] rounded-[2.2rem]"
                style={{
                  background:
                    'linear-gradient(145deg, rgba(226,232,240,0.36) 0%, rgba(99,102,241,0.19) 36%, rgba(20,184,166,0.16) 100%)',
                  filter: 'blur(1.2px)',
                  opacity: 0.35,
                }}
              />

              <div className="relative overflow-hidden rounded-[1.9rem] border border-white/12 bg-gradient-to-b from-slate-900/94 via-slate-950/97 to-slate-950 p-6 sm:p-9">
                <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
                <div className="pointer-events-none absolute -right-24 -top-24 h-52 w-52 rounded-full bg-indigo-400/20 blur-3xl" />
                <div className="pointer-events-none absolute -left-28 bottom-0 h-44 w-44 rounded-full bg-teal-300/12 blur-3xl" />

                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.05,
                    duration: duration(MOTION_DURATION.normal, 'primary'),
                    ease: MOTION_EASING.graceful,
                  }}
                  className="text-center"
                >
                  <BrandedLogo animatedRings={true} showWordmark showTagline className="justify-center scale-[1.06] sm:scale-[1.1]" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.14, duration: duration(MOTION_DURATION.normal, 'primary') }}
                  className="mt-6"
                >
                  <Button
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                    className="group relative h-12 w-full rounded-xl border border-white/14 bg-gradient-to-r from-violet-600 via-indigo-500 to-blue-500 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(67,56,202,0.5)] transition-all duration-300 hover:translate-y-[-1px] hover:brightness-105 hover:shadow-[0_18px_34px_rgba(67,56,202,0.62)] focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b16] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-70"
                    size="lg"
                  >
                    {googleLoading ? (
                      <>
                        <span className="mr-2.5 inline-flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse" />
                        </span>
                        Preparing your workspace...
                      </>
                    ) : (
                      <>
                        <GoogleGlyph />
                        <span className="ml-2">Continue with Google</span>
                      </>
                    )}
                  </Button>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: duration(MOTION_DURATION.normal, 'primary') }}
                  className="mt-6 text-center text-[12px] leading-relaxed text-slate-300/76"
                >
                  By signing in you agree to our{' '}
                  <Link href="/terms" className="underline underline-offset-2 transition-colors hover:text-white">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="underline underline-offset-2 transition-colors hover:text-white">
                    Privacy Policy
                  </Link>
                  . Learn more in the{' '}
                  <Link href="/trust" className="underline underline-offset-2 transition-colors hover:text-white">
                    Trust Center
                  </Link>
                  .
                </motion.p>
              </div>
            </div>
          </motion.section>
        </div>

        <div className="pointer-events-none mt-3 shrink-0 text-center text-[11px] uppercase tracking-[0.22em] text-slate-400/56">
          {BRAND.name} • AI Fashion Intelligence
        </div>
      </div>
    </div>
  );
}
