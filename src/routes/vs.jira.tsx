import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, ComparisonTable, CTABand } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/vs/jira")({
  head: () => ({
    meta: [
      { title: "Aurora vs Jira — sprints without the config tax" },
      { name: "description", content: "An honest comparison of Aurora vs Jira for sprints, roadmaps, RAID and client visibility." },
      { property: "og:title", content: "Aurora vs Jira" },
      { property: "og:description", content: "Sprints without the configuration tax." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="vs Jira"
        title="Sprints without the configuration tax"
        subtitle="Jira gives you infinite configurability and demands you use all of it. Aurora opens with a sensible delivery model and lets you change what matters."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
      />
      <Section>
        <SectionHeader title="Side by side" />
        <div className="mt-10">
          <ComparisonTable otherName="Jira" rows={[
            { label: "Time to first useful sprint", aurora: "Under 10 min", other: "Hours to days" },
            { label: "Built-in CRM", aurora: true, other: false },
            { label: "Built-in invoicing & finance", aurora: true, other: false },
            { label: "Client portal", aurora: true, other: "Add-on" },
            { label: "Meeting AI", aurora: true, other: false },
            { label: "Roadmaps + sprints in one place", aurora: true, other: "Premium tier" },
            { label: "Configurable workflows", aurora: true, other: true },
            { label: "Deep dev integrations (GitHub, GitLab)", aurora: true, other: true },
            { label: "Per-user pricing for guests", aurora: false, other: true },
          ]} />
        </div>
      </Section>
      <CTABand title="Try the Jira escape" />
    </MarketingPage>
  );
}
