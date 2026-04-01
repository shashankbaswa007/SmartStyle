import Link from 'next/link';
import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout';

export default function TrustCenterPage() {
  return (
    <LegalPageLayout
      title="Trust Center"
      lastUpdated="April 2026"
      summary="This Trust Center outlines how SmartStyle approaches security, privacy, service reliability, and user controls. It is intended to provide a transparent operational baseline for users and stakeholders."
    >
      <LegalSection id="security" title="1. Security Program">
        <p>
          SmartStyle applies layered security controls across authentication, request handling, and data access.
          We maintain route protections, authenticated APIs, scoped access checks, and security headers to mitigate
          common web threats.
        </p>
      </LegalSection>

      <LegalSection id="privacy" title="2. Privacy and Data Governance">
        <p>
          We apply data minimization and purpose-limited processing across core recommendation and wardrobe
          workflows. Data handling practices are documented in our privacy policy and enforced in service logic.
        </p>
        <p>
          Review: <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
        </p>
      </LegalSection>

      <LegalSection id="reliability" title="3. Reliability and Resilience">
        <p>
          We use observability and operational safeguards to improve uptime and recovery behavior, including
          structured logging, request tracing, rate controls, and fallback handling for external dependencies.
        </p>
      </LegalSection>

      <LegalSection id="user-controls" title="4. User Controls and Transparency">
        <p>
          Users can manage key account settings, privacy preferences, and profile actions directly in the app.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <Link href="/preferences" className="underline underline-offset-2">Preferences</Link> for personalization controls.
          </li>
          <li>
            <Link href="/account-settings" className="underline underline-offset-2">Account Settings</Link> for account-level actions.
          </li>
          <li>
            <Link href="/terms" className="underline underline-offset-2">Terms of Service</Link> for legal terms of use.
          </li>
        </ul>
      </LegalSection>
    </LegalPageLayout>
  );
}
