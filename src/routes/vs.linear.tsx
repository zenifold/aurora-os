import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, ComparisonTable, CTABand } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/vs/linear")({
  head: () => ({
    meta: [
      { title: "Aurora vs Linear — for the whole company" },
      { name: "description", content: "Linear is the gold standard for engineering issue tracking. Aurora brings Linear-grade speed to delivery, CRM and finance." },
      { property: "og:title", content: "Aurora vs Linear" },
      { property: "og:description", content: "Linear-grade speed for the whole company." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="vs Linear"
        title="Linear-grade speed for the whole company"
        subtitle="We love Linear. It's perfect for engineering. Aurora extends that craft to sales, delivery, finance and client-facing teams."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
      />
      <Section>
        <SectionHeader title="Side by side" />
        <div className="mt-10">
          <ComparisonTable otherName="Linear" rows={[
            { label: "Issue tracking for engineering", aurora: "Great", other: "Best-in-class" },
            { label: "CRM, deals, accounts", aurora: true, other: false },
            { label: "Client-facing project workflows", aurora: true, other: false },
            { label: "Invoicing and finance", aurora: true, other: false },
            { label: "Keyboard-first UX", aurora: true, other: true },
            { label: "Roadmaps", aurora: true, other: true },
            { label: "Meeting AI", aurora: true, other: false },
          ]} />
        </div>
      </Section>
      <CTABand title="Keep Linear or replace it — your call" />
    </MarketingPage>
  );
}
