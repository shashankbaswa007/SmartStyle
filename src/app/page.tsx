import { StyleAdvisor } from '@/components/style-advisor';

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.3),hsl(var(--accent)/0.1),rgba(255,255,255,0))]"></div>
      <div className="max-w-4xl mx-auto animate-fade-in">
        <header className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-headline font-extrabold text-foreground tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            StyleAI Advisor
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
