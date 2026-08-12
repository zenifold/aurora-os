import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, FeatureGrid, CTABand } from "@/components/marketing/MarketingPage";
import { ROLES } from "@/components/marketing/marketing-data";

export const Route = createFileRoute("/for")({
  head: () => ({
    meta: [
      { title: "Aurora by role — founders, ops, PMs, finance, CS" },
      { name: "description", content: "How Aurora fits into each role. Pick yours and see the workflow built for it." },
      { property: "og:title", content: "Aurora — built for every role" },
      { property: "og:description", content: "One workspace, five sharp workflows." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="By role"
        title="Built for the role you actually have"
        subtitle="Same workspace, a sharp workflow per role. Pick yours."
      />
      <Section>
        <FeatureGrid items={ROLES.map(r => ({ icon: r.icon, title: r.title, description: r.description, to: r.to }))} />
      </Section>
      <CTABand title="Find your fit" />
    </MarketingPage>
  );
}
