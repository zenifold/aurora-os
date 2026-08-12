import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, BulletList, FAQ, CTABand, SplitSection } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/for/operations")({
  head: () => ({
    meta: [
      { title: "Aurora for operations — SOPs that get followed" },
      { name: "description", content: "Standard operating processes that actually run. Templated projects, automations, checklists and a real audit trail." },
      { property: "og:title", content: "Aurora for operations" },
      { property: "og:description", content: "Processes that survive contact with reality." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="For operations"
        title="Processes that survive contact with reality"
        subtitle="Templates, automations, checklists and audit. The boring stuff done well so everything else gets faster."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "See features", to: "/features" }}
      />
      <Section>
        <SplitSection
          left={<SectionHeader align="left" eyebrow="What it solves" title="The gap between your SOP doc and what actually happens" />}
          right={<BulletList items={[
            "Project templates with embedded SOPs",
            "Automations on status, fields and dates",
            "Required checklists on stage transitions",
            "Approvals with audit log",
            "Cycle-time analytics by stage",
            "Onboarding playbooks for new hires and clients",
          ]} />}
        />
      </Section>
      <Section className="!py-12">
        <FAQ items={[
          { q: "Can we enforce a stage gate?", a: "Yes — block transitions until required fields and checklist items are done." },
          { q: "Do automations run server-side?", a: "Yes, with retry and a full event log." },
        ]} />
      </Section>
      <CTABand title="Make the right way the easy way" />
    </MarketingPage>
  );
}
