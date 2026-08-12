import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, ComparisonTable, CTABand } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/vs/monday")({
  head: () => ({
    meta: [
      { title: "Aurora vs Monday — real project work" },
      { name: "description", content: "Monday is a flexible board. Aurora is an opinionated company OS — sprints, RAID, CRM, finance, portals." },
      { property: "og:title", content: "Aurora vs Monday" },
      { property: "og:description", content: "Real project work without the dashboard sprawl." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="vs Monday"
        title="Real project work without the dashboard sprawl"
        subtitle="Monday is a flexible board you have to shape. Aurora opens with a real delivery model and grows from there."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
      />
      <Section>
        <SectionHeader title="Side by side" />
        <div className="mt-10">
          <ComparisonTable otherName="Monday" rows={[
            { label: "Board / kanban", aurora: true, other: true },
            { label: "Sprints with velocity and burndown", aurora: true, other: false },
            { label: "RAID log and change orders", aurora: true, other: false },
            { label: "Built-in CRM", aurora: true, other: "Separate product" },
            { label: "Invoicing", aurora: true, other: "Add-on" },
            { label: "Client portal", aurora: true, other: "Add-on" },
            { label: "Custom boards and views", aurora: true, other: true },
          ]} />
        </div>
      </Section>
      <CTABand title="Trade dashboards for a workflow" />
    </MarketingPage>
  );
}
