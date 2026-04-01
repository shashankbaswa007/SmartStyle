import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout';

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      lastUpdated="April 2026"
      summary="These Terms govern your access to and use of SmartStyle. By creating an account, uploading content, or using recommendation features, you agree to these Terms. If you do not agree, do not use the Service."
    >
      <LegalSection id="introduction" title="1. Introduction">
        <p>
          SmartStyle is an AI-assisted personal styling platform. These Terms form a binding agreement
          between you and SmartStyle regarding your use of the website, application features, and related APIs.
        </p>
        <p>
          You must be legally capable of entering into this agreement and must comply with applicable laws in
          your jurisdiction when using the Service.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="2. Accounts and Access">
        <p>
          You are responsible for maintaining account credential confidentiality and for all activity under your
          account. You must provide accurate profile information and keep it current.
        </p>
        <p>
          We may suspend or terminate access where there is suspected abuse, unauthorized access, legal risk,
          or material breach of these Terms.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="3. Acceptable Use and Restrictions">
        <ul className="list-disc pl-6 space-y-2">
          <li>Do not upload content that is unlawful, infringing, harmful, or deceptive.</li>
          <li>Do not attempt to bypass usage limits, security controls, or authentication requirements.</li>
          <li>Do not use automated means to scrape, overload, or reverse engineer core service logic.</li>
          <li>Do not misuse recommendation outputs for fraudulent or malicious activities.</li>
        </ul>
      </LegalSection>

      <LegalSection id="ai-output" title="4. AI Outputs and Service Scope">
        <p>
          Recommendations and generated styling outputs are informational and may not reflect all personal,
          medical, cultural, or situational factors. You are solely responsible for your final wardrobe decisions.
        </p>
        <p>
          Feature availability may change over time, including third-party provider integrations used for
          recommendation and enrichment workflows.
        </p>
      </LegalSection>

      <LegalSection id="limitation-liability" title="5. Disclaimer and Limitation of Liability">
        <p>
          The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of uninterrupted
          availability, merchantability, fitness for a particular purpose, or non-infringement.
        </p>
        <p>
          To the maximum extent permitted by law, SmartStyle will not be liable for indirect, incidental,
          consequential, or special damages arising from your use of or inability to use the Service.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="6. Changes to Terms">
        <p>
          We may revise these Terms from time to time. Material changes will be reflected by an updated date.
          Continued use of the Service after updates constitutes acceptance of the revised Terms.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
