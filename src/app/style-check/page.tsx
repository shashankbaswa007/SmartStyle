
'use client';

import { StyleAdvisor } from '@/components/style-advisor';
import ShinyText from '@/components/ShinyText';
import TextPressure from '@/components/TextPressure';
import SplashCursor from '@/components/SplashCursor';
import { useMounted } from '@/hooks/useMounted';
import Particles from '@/components/Particles';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function StyleCheckPage() {
  const isMounted = useMounted();

  return (
    <ProtectedRoute>
      <main className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10">
        {isMounted && (
          <>
            <SplashCursor SPLAT_RADIUS={0.12} SPLAT_FORCE={2000} COLOR_UPDATE_SPEED={6} SIM_RESOLUTION={64} DYE_RESOLUTION={512} PRESSURE_ITERATIONS={8} />
            <Particles
              className="absolute inset-0"
              particleColors={['#7B68EE', '#EEBB68']}
              particleCount={500}
              particleSpread={10}
              speed={0.3}
              particleBaseSize={150}
              moveParticlesOnHover={true}
              alphaParticles={false}
              disableRotation={false}
            />
          </>
        )}
      </div>
      <div className="relative z-10 max-w-4xl mx-auto animate-fade-in">
        <header className="text-center mb-16">
          <div style={{ position: 'relative', height: '300px' }}>
            {isMounted && (
              <TextPressure
                text="Style-Check"
                stroke={true}
                width={false}
                weight={true}
                textColor="#C4B5FD"
                strokeColor="#5B21B6"
                minFontSize={32}
              />
            )}
          </div>
          <ShinyText
            className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
            text="Get instant feedback on your outfit. Upload a photo and let our AI-powered style advisor give you personalized recommendations."
          />
        </header>

        <StyleAdvisor />
      </div>
    </main>
    </ProtectedRoute>
  );
}
