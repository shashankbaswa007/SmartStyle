import { StyleAdvisor } from '@/components/style-advisor';
import { InteractiveBackground } from '@/components/interactive-background';

export default function StyleCheckPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background py-12 px-4 sm:px-6 lg:px-8">
      <InteractiveBackground />
      <div className="relative z-10 max-w-4xl mx-auto animate-fade-in">
        <header className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-headline font-extrabold text-foreground tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            Style Check
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
            Upload your outfit, and let our AI be your personal stylist. Get instant feedback and curated recommendations based on your look, occasion, and local weather.
          </p>
        </header>
        <StyleAdvisor />
      </div>
    </main>
  );
}
