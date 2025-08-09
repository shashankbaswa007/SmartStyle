import { StyleAdvisor } from '@/components/style-advisor';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-secondary/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-headline font-extrabold text-foreground tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            StyleAI Advisor
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your outfit, and let our AI be your personal stylist. Get instant feedback and curated recommendations based on your look, occasion, and local weather.
          </p>
        </header>
        <StyleAdvisor />
      </div>
    </main>
  );
}
