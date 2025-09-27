"use client"
import { StyleAdvisor } from '@/components/style-advisor';
import TextPressure from '@/components/TextPressure';

export default function StyleCheckPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="relative z-10 max-w-4xl mx-auto animate-fade-in">
        <header className="text-center mb-16">
          <div style={{position: 'relative', height: '300px'}}>
            <TextPressure
              text="Style Check"
              flex={false}
              alpha={false}
              stroke={true}
              width={true}
              weight={true}
              italic={true}
              textColor="#A78BFA"
              strokeColor="#EDE9FE "
              minFontSize={36}
            />
          </div>
          <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
            Upload your outfit, and let our AI be your personal stylist. Get instant feedback and curated recommendations based on your look, occasion, and local weather.
          </p>
        </header>
        <StyleAdvisor />
      </div>
    </main>
  );
}
