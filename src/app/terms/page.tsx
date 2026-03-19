import Link from 'next/link';
import { Scale, ShieldAlert, Ban, RefreshCw } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-3">
          <h1 className="text-4xl font-bold">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: March 2026</p>
          <p className="text-muted-foreground">
            By using SmartStyle, you agree to these terms covering account use, acceptable behavior,
            and service limitations.
          </p>
        </header>

        <section className="space-y-3 rounded-xl border border-border/40 bg-card/40 p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Scale className="h-5 w-5" /> Service Scope</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
            <li>SmartStyle provides AI-assisted fashion recommendations and shopping discovery links.</li>
            <li>Recommendations are informational and may not be accurate for all body types or contexts.</li>
            <li>The service may change, pause, or discontinue features without prior notice.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-xl border border-border/40 bg-card/40 p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Ban className="h-5 w-5" /> Acceptable Use</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
            <li>Do not upload unlawful, harmful, or rights-infringing content.</li>
            <li>Do not abuse APIs, bypass rate limits, or attempt unauthorized access.</li>
            <li>Do not use the service to generate deceptive or malicious material.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-xl border border-border/40 bg-card/40 p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Warranty Disclaimer</h2>
          <p className="text-sm text-muted-foreground">
            SmartStyle is provided on an “as is” and “as available” basis. We do not guarantee uninterrupted
            service, perfect recommendation quality, or third-party provider availability.
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-border/40 bg-card/40 p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Changes to Terms</h2>
          <p className="text-sm text-muted-foreground">
            We may update these terms as the product evolves. Continued use after updates indicates acceptance.
          </p>
        </section>

        <footer className="pt-4 text-sm text-muted-foreground">
          Read our <Link href="/privacy" className="underline">Privacy Policy</Link> and <Link href="/trust" className="underline">Trust Center</Link> for data and security details.
        </footer>
      </div>
    </div>
  );
}
