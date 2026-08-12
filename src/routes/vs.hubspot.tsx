import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, ComparisonTable, CTABand } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/vs/hubspot")({
  head: () => ({
    meta: [
      { title: "Aurora vs HubSpot — CRM that lives next to delivery" },
      { name: "description", content: "HubSpot is a CRM. Aurora is a CRM that already knows what your delivery team is doing." },
      { property: "og:title", content: "Aurora vs HubSpot" },
      { property: "og:description", content: "CRM that doesn't live in a silo." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="vs HubSpot"
        title="CRM that doesn't live in a silo"
        subtitle="HubSpot is great at marketing automation. Aurora is what services companies reach for — sales, delivery, finance and client portal all connected."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
      />
      <Section>
        <SectionHeader title="Side by side" />
        <div className="mt-10">
          <ComparisonTable otherName="HubSpot" rows={[
            { label: "Pipeline and deal forecasting", aurora: true, other: true },
            { label: "Marketing automation", aurora: "Light", other: "Best-in-class" },
            { label: "Project delivery (sprints, RAID)", aurora: true, other: false },
            { label: "Invoicing and revenue recognition", aurora: true, other: "Add-on" },
            { label: "Client portal with delivery view", aurora: true, other: false },
            { label: "Meeting AI", aurora: true, other: "Add-on" },
            { label: "Free tier", aurora: true, other: true },
          ]} />
        </div>
      </Section>
      <CTABand title="See if Aurora replaces your CRM stack" />
    </MarketingPage>
  );
}
