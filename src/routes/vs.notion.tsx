import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, ComparisonTable, CTABand } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/vs/notion")({
  head: () => ({
    meta: [
      { title: "Aurora vs Notion — docs with real data" },
      { name: "description", content: "Notion is a great wiki. Aurora is what you reach for when the company is also the data." },
      { property: "og:title", content: "Aurora vs Notion" },
      { property: "og:description", content: "Real schemas, real ownership." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="vs Notion"
        title="When the company is also the data"
        subtitle="Notion is brilliant at pages. Aurora is brilliant at pages plus pipelines, projects, invoices and the audit trail finance asks for."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
      />
      <Section>
        <SectionHeader title="Side by side" />
        <div className="mt-10">
          <ComparisonTable otherName="Notion" rows={[
            { label: "Pages and docs", aurora: true, other: true },
            { label: "Real CRM with stages and forecasting", aurora: true, other: false },
            { label: "Sprints and delivery model", aurora: true, other: "DIY" },
            { label: "Invoicing and revenue recognition", aurora: true, other: false },
            { label: "Audit log + RBAC", aurora: true, other: "Limited" },
            { label: "Database relations", aurora: true, other: true },
            { label: "Best-in-class block editor", aurora: "Great", other: "Best-in-class" },
            { label: "Public sharing of pages", aurora: true, other: true },
          ]} />
        </div>
      </Section>
      <CTABand title="Keep Notion for personal. Use Aurora for the company." />
    </MarketingPage>
  );
}
