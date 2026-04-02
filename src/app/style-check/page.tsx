
'use client';

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useMounted } from '@/hooks/useMounted';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { auth } from '@/lib/firebase';
import UsageLimitMeter from '@/components/UsageLimitMeter';
import { USAGE_LIMITS } from '@/lib/usage-limits';

// Lazy load heavy components for better performance
const StyleAdvisor = lazy(() => import('@/components/style-advisor').then(mod => ({ default: mod.StyleAdvisor })));
const ShinyText = lazy(() => import('@/components/ShinyText'));
const TextPressure = lazy(() => import('@/components/TextPressure'));
const SplashCursor = lazy(() => import('@/components/SplashCursor'));
const Particles = lazy(() => import('@/components/Particles'));

export default function StyleCheckPage() {
  const isMounted = useMounted();
  const [usage, setUsage] = useState<{ remaining: number; limit: number; resetAt?: string } | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setUsage(null);
      setUsageLoading(false);
      return;
    }

    try {
      setUsageLoading(true);
      const fetchUsageStatus = async (forceRefreshToken = false) => {
        const idToken = await user.getIdToken(forceRefreshToken);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 6000);
        try {
          return await fetch('/api/usage-status', {
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${idToken}`,
              'Cache-Control': 'no-cache',
            },
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeoutId);
        }
      };

      let response = await fetchUsageStatus(false);
      if (response.status === 401) {
        response = await fetchUsageStatus(true);
      }

      if (!response.ok) {
        setUsage(null);
        return;
      }
      const data = await response.json();
      const recommendUsage = data?.usage?.recommend;
      if (recommendUsage) {
        setUsage({
          remaining: recommendUsage.remaining,
          limit: recommendUsage.limit,
          resetAt: recommendUsage.resetAt,
        });
      } else {
        setUsage(null);
      }
    } catch {
      setUsage(null);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUsage(null);
        setUsageLoading(false);
        return;
      }
      void fetchUsage();
    });

    return () => unsubscribe();
  }, [fetchUsage]);

  useEffect(() => {
    const onUsageConsumed = (event: Event) => {
      const customEvent = event as CustomEvent<{ scope?: string }>;
      if (customEvent.detail?.scope === 'recommend') {
        fetchUsage();
      }
    };

    window.addEventListener('usage:consumed', onUsageConsumed as EventListener);
    return () => window.removeEventListener('usage:consumed', onUsageConsumed as EventListener);
  }, [fetchUsage]);

  const isStyleCheckLimitReached = !usageLoading && !!usage && usage.remaining <= 0;

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10">
        {isMounted && (
          <>
            <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-indigo-500/10" />}>
              <SplashCursor SPLAT_RADIUS={0.10} SPLAT_FORCE={2000} COLOR_UPDATE_SPEED={6} SIM_RESOLUTION={64} DYE_RESOLUTION={512} PRESSURE_ITERATIONS={8} />
            </Suspense>
            <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-500/10" />}>
              <Particles
                className="absolute inset-0"
                particleColors={['#a855f7', '#c4b5fd']}
                particleCount={200}
                particleSpread={10}
                speed={0.5}
                particleBaseSize={120}
                moveParticlesOnHover={false}
                alphaParticles={false}
                disableRotation={true}
              />
            </Suspense>
          </>
        )}
      </div>
      <div className="relative z-10 max-w-4xl mx-auto animate-fade-in">
        <header className="text-center mb-8 sm:mb-12 md:mb-16">
          <div className="relative h-[180px] sm:h-[240px] md:h-[300px]">
            {isMounted && (
              <Suspense fallback={<h1 className="text-3xl sm:text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent pt-12 sm:pt-16 md:pt-24">Style-Check</h1>}>
                <TextPressure
                  text="Style-Check"
                  stroke={true}
                  width={true}
                  weight={false}
                  textColor="#c4b5fd"
                  strokeColor="#7c3aed"
                  minFontSize={32}
                />
              </Suspense>
            )}
          </div>
          <Suspense fallback={<p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">Get instant feedback on your outfit. Upload a photo and let our AI-powered style advisor give you personalized recommendations.</p>}>
            <ShinyText
              className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
              text="Get instant feedback on your outfit. Upload a photo and let our AI-powered style advisor give you personalized recommendations."
            />
          </Suspense>
          <div className="mx-auto mt-8 max-w-lg">
            <div className="rounded-lg p-1 bg-gradient-to-r from-purple-500/20 to-violet-500/20">
              <UsageLimitMeter
                variant="styleCheck"
                title="Daily Analysis Limit"
                subtitle="Analyses remaining today"
                remaining={usage?.remaining}
                limit={usage?.limit ?? USAGE_LIMITS.recommend}
                resetAt={usage?.resetAt}
                className="rounded-lg"
                isLoading={usageLoading}
              />
            </div>
          </div>
        </header>

        <Suspense fallback={<div className="flex justify-center items-center min-h-[400px]"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div><p className="text-muted-foreground">Loading style advisor...</p></div></div>}>
          <StyleAdvisor isLimitReached={isStyleCheckLimitReached} />
        </Suspense>
      </div>
    </div>
    </ProtectedRoute>
  );
}
