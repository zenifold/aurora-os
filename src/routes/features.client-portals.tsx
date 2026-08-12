import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, BulletList, FAQ, CTABand, SplitSection } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/features/client-portals")({
  head: () => ({
    meta: [
      { title: "Client portals — branded, scoped, secure | Aurora" },
      { name: "description", content: "Give clients a branded portal that shows exactly what you choose — projects, files, invoices, requests. Scoped roles, audit log, SSO." },
      { property: "og:title", content: "Aurora client portals" },
      { property: "og:description", content: "Stop sending screenshots." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Feature deep dive"
        title="Client portals, without building a second product"
        subtitle="Branded, scoped, secure. Clients see live progress, approve work, sign off on changes and pay invoices — without ever touching your internal workspace."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "Portal use case", to: "/use-cases/client-portals" }}
      />
      <Section>
        <SplitSection
          left={<SectionHeader align="left" eyebrow="What clients get" title="A single calm place to work with you" subtitle="Replaces the email thread, shared Drive folder and ad-hoc Slack channel." />}
          right={<BulletList items={[
            "Project status, milestones and timeline",
            "Files, approvals and e-signature",
            "Requests + ticket-style intake",
            "Invoices, payments and statements",
            "Branded with your logo and domain",
            "Granular role-scoped permissions",
          ]} />}
        />
      </Section>
      <Section className="!py-12">
        <FAQ items={[
          { q: "Can portals be on our own domain?", a: "Yes — portal.youragency.com with full white-label." },
          { q: "Do clients pay extra seats?", a: "Guest viewers are free. Active collaborators are billed per portal." },
          { q: "Is SSO supported?", a: "Yes — Google, Microsoft and SAML for enterprise clients." },
        ]} />
      </Section>
      <CTABand title="Make clients feel taken care of" />
    </MarketingPage>
  );
}
