import Link from 'next/link';
import { Shield, Database, Camera, Trash2, Download, Bot } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-3">
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: March 2026</p>
          <p className="text-muted-foreground">
            SmartStyle processes photos and personalization data to generate outfit recommendations.
            This page explains what we collect, why we collect it, and how you can control it.
          </p>
        </header>

        <section className="space-y-3 rounded-xl border border-border/40 bg-card/40 p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Camera className="h-5 w-5" /> Photo Handling</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
            <li>Uploaded outfit photos are used to analyze color and style features and generate recommendations.</li>
            <li>We avoid storing raw photos longer than necessary for recommendation workflows and caching.</li>
            <li>Generated recommendations may include derived metadata such as palette, style type, and shopping links.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-xl border border-border/40 bg-card/40 p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Database className="h-5 w-5" /> Data We Store</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
            <li>Account profile fields: display name, email, and authentication provider metadata.</li>
            <li>User preference signals: liked outfits, worn outfits, and interaction trends used for personalization.</li>
            <li>Shopping interaction data: click-through events used to improve recommendations.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-xl border border-border/40 bg-card/40 p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Bot className="h-5 w-5" /> AI Provider Disclosure</h2>
          <p className="text-sm text-muted-foreground">
            SmartStyle uses third-party AI providers for recommendation analysis and enrichment workflows. Provider
            availability may vary, and fallback behavior may be used when external services are unavailable.
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-border/40 bg-card/40 p-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Shield className="h-5 w-5" /> Security & Retention</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
            <li>Access control is enforced through authenticated API routes and backend security rules.</li>
            <li>We retain data only as needed for product functionality, fraud prevention, and reliability operations.</li>
            <li>Logs and operational telemetry are used to detect failures and improve service quality.</li>
          </ul>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/40 bg-card/40 p-6">
            <h3 className="font-semibold flex items-center gap-2"><Download className="h-4 w-4" /> Data Export</h3>
            <p className="mt-2 text-sm text-muted-foreground">You can export preference data from the Preferences page.</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/40 p-6">
            <h3 className="font-semibold flex items-center gap-2"><Trash2 className="h-4 w-4" /> Data Deletion</h3>
            <p className="mt-2 text-sm text-muted-foreground">You can request account deletion from Account Settings.</p>
          </div>
        </section>

        <footer className="pt-4 text-sm text-muted-foreground">
          Questions about privacy? Review our <Link href="/terms" className="underline">Terms of Service</Link> or visit the <Link href="/trust" className="underline">Trust Center</Link>.
        </footer>
      </div>
    </div>
  );
}
