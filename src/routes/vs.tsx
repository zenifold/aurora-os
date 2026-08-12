import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, FeatureGrid, CTABand } from "@/components/marketing/MarketingPage";
import { COMPARISONS } from "@/components/marketing/marketing-data";

export const Route = createFileRoute("/vs")({
  head: () => ({
    meta: [
      { title: "Aurora vs Jira, Notion, Linear, HubSpot, Monday" },
      { name: "description", content: "Honest comparisons of Aurora vs the tools you might be replacing." },
      { property: "og:title", content: "Aurora vs the rest" },
      { property: "og:description", content: "Honest comparisons, no sales fluff." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Comparisons"
        title="Aurora vs the tool you're paying for now"
        subtitle="Honest side-by-side. Where we win, where we don't."
      />
      <Section>
        <FeatureGrid items={COMPARISONS.map(c => ({ icon: c.icon, title: c.title, description: c.description, to: c.to }))} />
      </Section>
      <CTABand title="See where you'd land" />
    </MarketingPage>
  );
}
