import type { ReactNode } from 'react';
import Link from 'next/link';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  summary: string;
  children: ReactNode;
}

export function LegalPageLayout({ title, lastUpdated, summary, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="space-y-4 border-b border-border/50 pb-8">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          <p className="text-base leading-7 text-foreground/90 max-w-3xl">{summary}</p>
        </header>

        <main className="space-y-6 py-8">{children}</main>

        <footer className="pt-6 border-t border-border/50 text-sm text-muted-foreground">
          <p>
            Related documents: <Link href="/terms" className="underline underline-offset-2">Terms</Link>,{' '}
            <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>,{' '}
            <Link href="/trust" className="underline underline-offset-2">Trust Center</Link>.
          </p>
        </footer>
      </div>
    </div>
  );
}

interface LegalSectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section id={id} className="rounded-2xl border border-border/50 bg-card/40 p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-4">{title}</h2>
      <div className="space-y-3 text-sm sm:text-base leading-7 text-foreground/85">{children}</div>
    </section>
  );
}