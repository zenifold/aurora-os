import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, BulletList, FAQ, CTABand, SplitSection } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/for/finance")({
  head: () => ({
    meta: [
      { title: "Aurora for finance — from signed deal to cash" },
      { name: "description", content: "Quote-to-cash without re-keying. Deals roll into projects, projects into invoices, invoices into your accounting tool." },
      { property: "og:title", content: "Aurora for finance" },
      { property: "og:description", content: "Quote-to-cash, finally connected." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="For finance"
        title="Quote-to-cash, finally connected"
        subtitle="No more CSV exports, no more 'did sales tell us about this deal?'. Aurora links the signed deal, the delivery work and the invoice — automatically."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "Finance feature", to: "/features/finance" }}
      />
      <Section>
        <SplitSection
          left={<SectionHeader align="left" eyebrow="What changes" title="The painful loops, removed" />}
          right={<BulletList items={[
            "Won deals auto-create invoice schedules",
            "Milestone completion triggers invoicing",
            "Expense capture with project allocation",
            "Revenue recognition by milestone or %",
            "Xero, QuickBooks and Netsuite sync",
            "Forecasted cash from pipeline and AR",
          ]} />}
        />
      </Section>
      <Section className="!py-12">
        <FAQ items={[
          { q: "Is Aurora your accounting system?", a: "No — we sync to your ledger. We own the operational layer." },
          { q: "Multi-currency?", a: "Yes — workspace-level base + per-deal currency with FX rates." },
        ]} />
      </Section>
      <CTABand title="End the re-keying era" />
    </MarketingPage>
  );
}
