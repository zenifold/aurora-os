import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, FeatureGrid, FAQ, CTABand } from "@/components/marketing/MarketingPage";
import { ShieldCheck, Lock, KeyRound, FileSearch, Globe2, ServerCog } from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security at Aurora — SOC 2, SSO, audit log" },
      { name: "description", content: "How Aurora protects your data. Encryption, SSO, RBAC, audit log, regional hosting and SOC 2 Type II." },
      { property: "og:title", content: "Security at Aurora" },
      { property: "og:description", content: "How we protect your data." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Security"
        title="Trust, by design"
        subtitle="Encryption everywhere, least-privilege access, a full audit log and a security team that answers your questionnaire quickly."
        secondaryCta={{ label: "Talk to security", to: "/contact" }}
      />
      <Section>
        <SectionHeader title="The fundamentals" />
        <div className="mt-10">
          <FeatureGrid items={[
            { icon: Lock, title: "Encryption", description: "TLS 1.3 in transit. AES-256 at rest. KMS-managed keys." },
            { icon: KeyRound, title: "SSO + SCIM", description: "Google, Microsoft and SAML 2.0. SCIM on enterprise." },
            { icon: ShieldCheck, title: "RBAC", description: "Built-in and custom roles, field-level controls, scoped sharing." },
            { icon: FileSearch, title: "Audit log", description: "Tamper-evident, exportable, retained per your plan." },
            { icon: Globe2, title: "Regional hosting", description: "US, EU and APAC residency options." },
            { icon: ServerCog, title: "Compliance", description: "SOC 2 Type II, ISO 27001, GDPR & CCPA aligned." },
          ]} />
        </div>
      </Section>
      <Section className="!py-12">
        <FAQ items={[
          { q: "Do you sign DPAs?", a: "Yes — standard DPA available on every paid plan." },
          { q: "Do you have a status page?", a: "Yes — status.aurora.app with subscribe-to-incident." },
          { q: "Can we get a pentest report?", a: "Yes, on request and under NDA." },
        ]} />
      </Section>
      <CTABand title="Security questionnaire? We'll respond fast." secondaryCta={{ label: "Contact us", to: "/contact" }} />
    </MarketingPage>
  );
}
