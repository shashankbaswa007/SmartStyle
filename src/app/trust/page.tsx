import Link from 'next/link';
import { ShieldCheck, FileText, Activity, Lock } from 'lucide-react';

export default function TrustCenterPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-3">
          <h1 className="text-4xl font-bold">Trust Center</h1>
          <p className="text-muted-foreground">
            Central place for SmartStyle privacy, security, reliability, and operational transparency.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/40 bg-card/40 p-6">
            <h2 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Policy Docs</h2>
            <p className="mt-2 text-sm text-muted-foreground">Review legal and data policies that govern your account.</p>
            <div className="mt-3 flex gap-3 text-sm">
              <Link href="/privacy" className="underline">Privacy</Link>
              <Link href="/terms" className="underline">Terms</Link>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/40 p-6">
            <h2 className="font-semibold flex items-center gap-2"><Lock className="h-4 w-4" /> Account Controls</h2>
            <p className="mt-2 text-sm text-muted-foreground">Export preference data and delete account from in-app settings.</p>
            <div className="mt-3 flex gap-3 text-sm">
              <Link href="/preferences" className="underline">Preferences</Link>
              <Link href="/account-settings" className="underline">Account Settings</Link>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/40 p-6">
            <h2 className="font-semibold flex items-center gap-2"><Activity className="h-4 w-4" /> Reliability</h2>
            <p className="mt-2 text-sm text-muted-foreground">Operational logging and request IDs support issue triage and incident response.</p>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/40 p-6">
            <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Security</h2>
            <p className="mt-2 text-sm text-muted-foreground">Security headers, route access checks, and authenticated APIs protect user flows.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
