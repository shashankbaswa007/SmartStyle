
'use client';

import { lazy, Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { useStyleCheckUsage } from '@/hooks/useStyleCheckUsage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import UsageLimitMeter from '@/components/UsageLimitMeter';
import FirstTimeTip from '@/components/FirstTimeTip';
import PageStatusAlert from '@/components/PageStatusAlert';
import QuickStartEmptyState from '@/components/QuickStartEmptyState';
import { USAGE_LIMITS } from '@/lib/usage-limits';
import { Calendar, Shirt } from 'lucide-react';

// Lazy load heavy components for better performance
const StyleAdvisor = lazy(() => import('@/components/style-advisor').then(mod => ({ default: mod.StyleAdvisor })));
const ShinyText = lazy(() => import('@/components/ShinyText'));
const TextPressure = lazy(() => import('@/components/TextPressure'));
const Particles = lazy(() => import('@/components/Particles'));

export default function StyleCheckPage() {
  const isMounted = useMounted();
  const { usage, usageLoading, usageError, fetchUsage, isStyleCheckLimitReached } = useStyleCheckUsage();
  const [showParticles, setShowParticles] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [supportsWebGL, setSupportsWebGL] = useState(false);

  useEffect(() => {
    if (!isMounted) return;

    try {
      const canvas = document.createElement('canvas');
      const webglContext = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setSupportsWebGL(Boolean(webglContext));
    } catch {
      setSupportsWebGL(false);
    }
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) return;

    const particlesTimer = window.setTimeout(() => setShowParticles(true), 520);

    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsTabVisible(visible);

      if (!visible) {
        setShowParticles(false);
      } else {
        window.setTimeout(() => setShowParticles(true), 360);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(particlesTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isMounted]);

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10">
          {isMounted && (
            <>
              {isTabVisible && supportsWebGL && showParticles ? (
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
              ) : null}
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
          <div className="mx-auto mt-6 max-w-2xl text-left">
            <FirstTimeTip
              storageKey="tip:style-check:v1"
              title="First time here?"
              description="Use this flow for quick outfit feedback and personalized recommendations."
              bullets={[
                'Upload a clear full-body or outfit photo for best results.',
                'Try different occasions (work, date, casual) to compare advice.',
                'Save looks you like so your analytics and preferences improve faster.',
              ]}
            />
          </div>
          {usageError && (
            <PageStatusAlert
              className="mx-auto mt-4 max-w-2xl"
              title="Usage status unavailable"
              description={usageError}
              onRetry={() => {
                void fetchUsage();
              }}
              isRetrying={usageLoading}
            />
          )}
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

        {isStyleCheckLimitReached ? (
          <QuickStartEmptyState
            className="mx-auto max-w-2xl"
            icon={Calendar}
            title="Daily style-check limit reached"
            description="You have used today\'s analysis quota. Explore your wardrobe suggestions in the meantime and come back after reset."
            primaryAction={{
              label: 'Open Wardrobe',
              href: '/wardrobe',
              icon: Shirt,
            }}
          />
        ) : (
          <Suspense fallback={<div className="flex justify-center items-center min-h-[400px]"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div><p className="text-muted-foreground">Loading style advisor...</p></div></div>}>
            <StyleAdvisor isLimitReached={isStyleCheckLimitReached} />
          </Suspense>
        )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
