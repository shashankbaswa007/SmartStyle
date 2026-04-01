import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout';

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      lastUpdated="April 2026"
      summary="This Privacy Policy explains how SmartStyle collects, uses, discloses, and retains personal information when you use our services, including account, wardrobe, and recommendation features."
    >
      <LegalSection id="collection" title="1. Information We Collect">
        <p>We collect information you provide directly, including account profile details and wardrobe-related uploads.</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Account data: name, email address, profile image, and authentication metadata.</li>
          <li>User content: outfit photos, wardrobe item details, and preference inputs.</li>
          <li>Interaction data: likes, usage actions, recommendation feedback, and feature engagement signals.</li>
        </ul>
      </LegalSection>

      <LegalSection id="usage" title="2. How We Use Information">
        <p>We use collected information to operate and improve SmartStyle, including:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Generating personalized recommendations and wardrobe insights.</li>
          <li>Preventing abuse, enforcing limits, and maintaining platform security.</li>
          <li>Monitoring reliability, debugging incidents, and improving product performance.</li>
        </ul>
      </LegalSection>

      <LegalSection id="ai-providers" title="3. Third-Party and AI Processing">
        <p>
          SmartStyle may use third-party providers, including AI and infrastructure services, to process requests.
          Data shared is limited to what is necessary to deliver requested functionality and maintain operations.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="4. Retention and Security">
        <p>
          We retain information for as long as needed to provide the Service, comply with legal obligations,
          resolve disputes, and enforce agreements. We implement administrative and technical safeguards to
          reduce unauthorized access, disclosure, and misuse.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="5. Your Choices and Rights">
        <p>You can manage account-level data from in-app settings, including preference updates and account actions.</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Export available preference data where supported.</li>
          <li>Request account deletion and associated data cleanup through account settings.</li>
          <li>Stop using the Service at any time.</li>
        </ul>
      </LegalSection>

      <LegalSection id="updates" title="6. Policy Updates">
        <p>
          We may update this Privacy Policy periodically. Material changes will be reflected by the updated date.
          Continued use of SmartStyle after updates indicates acceptance of the revised policy.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
