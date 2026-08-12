import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, FeatureGrid, FAQ, CTABand } from "@/components/marketing/MarketingPage";
import { Table2, Kanban, GanttChart, Calendar, Map, LayoutGrid } from "lucide-react";

export const Route = createFileRoute("/features/views")({
  head: () => ({
    meta: [
      { title: "Views — table, kanban, timeline, canvas | Aurora" },
      { name: "description", content: "Same data, every shape. Aurora views let every team see the work in the format that matches how they think." },
      { property: "og:title", content: "Aurora views" },
      { property: "og:description", content: "Same data, every shape." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Feature deep dive"
        title="Same data. Every shape."
        subtitle="Tables for analysts. Boards for makers. Timelines for PMs. Canvases for design. One source of truth, six ways to look at it."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "See all features", to: "/features" }}
      />
      <Section>
        <SectionHeader title="A view for every kind of brain" />
        <div className="mt-10">
          <FeatureGrid items={[
            { icon: Table2, title: "Table", description: "Spreadsheet power with relations, formulas and rollups." },
            { icon: Kanban, title: "Kanban", description: "Drag-and-drop across statuses, WIP limits and swimlanes." },
            { icon: GanttChart, title: "Timeline", description: "Dependencies, baselines and critical path." },
            { icon: Calendar, title: "Calendar", description: "Schedule by start, due, custom or rolling dates." },
            { icon: Map, title: "Canvas", description: "Whiteboard for stories, journeys and architecture." },
            { icon: LayoutGrid, title: "Gallery", description: "Card-based view for assets, briefs and pitches." },
          ]} />
        </div>
      </Section>
      <CTABand title="One workspace. Every view." />
    </MarketingPage>
  );
}
