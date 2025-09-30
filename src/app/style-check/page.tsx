
'use client';
import { StyleAdvisor } from '@/components/style-advisor';
import TextPressure from '@/components/TextPressure';
import SplashCursor from '@/components/SplashCursor';
import ShinyText from '@/components/ShinyText';
import Silk from '@/components/Silk';

export default function StyleCheckPage() {
  return (
    <main className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10">
      <SplashCursor />
      <Silk
        speed={5}
        scale={1}
        color="#A78BFA"
        noiseIntensity={1.5}
        rotation={0}
      />
      </div>
      <div className="relative z-10 max-w-4xl mx-auto animate-fade-in">
        <header className="text-center mb-16">
          <div style={{ position: 'relative', height: '300px' }}>
          <TextPressure
            text="Style-Check"
            flex={false}
            alpha={false}
            stroke={true}
            width={false}
            weight={true}
            italic={false}
            textColor="#C4B5FD"
            strokeColor="#5B21B6"
            minFontSize={36}
          />
          </div>
          <ShinyText className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto" text="Get instant feedback on your outfit. Upload a photo and let our AI-powered style advisor give you personalized recommendations." />
        </header>

        <StyleAdvisor />
      </div>
    </main>
  );
}
