
'use client';

import { lazy, Suspense } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Lazy load heavy components for better performance
const StyleAdvisor = lazy(() => import('@/components/style-advisor').then(mod => ({ default: mod.StyleAdvisor })));
const ShinyText = lazy(() => import('@/components/ShinyText'));
const TextPressure = lazy(() => import('@/components/TextPressure'));
const SplashCursor = lazy(() => import('@/components/SplashCursor'));
const Particles = lazy(() => import('@/components/Particles'));

export default function StyleCheckPage() {
  const isMounted = useMounted();

  return (
    <ProtectedRoute>
      <main className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
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
                particleCount={150}
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
        <header className="text-center mb-16">
          <div style={{ position: 'relative', height: '300px' }}>
            {isMounted && (
              <Suspense fallback={<h1 className="text-6xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent pt-24">Style-Check</h1>}>
                <TextPressure
                  text="Style-Check"
                  stroke={true}
                  width={false}
                  weight={true}
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
        </header>

        <Suspense fallback={<div className="flex justify-center items-center min-h-[400px]"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div><p className="text-muted-foreground">Loading style advisor...</p></div></div>}>
          <StyleAdvisor />
        </Suspense>
      </div>
    </main>
    </ProtectedRoute>
  );
}
