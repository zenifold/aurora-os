import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, BulletList, FAQ, CTABand, SplitSection } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/features/docs-and-notes")({
  head: () => ({
    meta: [
      { title: "Docs & notes — connected to the work | Aurora" },
      { name: "description", content: "Pages, notes and SOPs that live next to the projects, deals and accounts they describe. Searchable across the whole workspace." },
      { property: "og:title", content: "Aurora docs & notes" },
      { property: "og:description", content: "Knowledge that finds you." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Feature deep dive"
        title="Docs that live next to the work"
        subtitle="Not a wiki off to the side. Pages, notes and SOPs scoped to a project, deal or account — and surfaced where you actually do the work."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "See all features", to: "/features" }}
      />
      <Section>
        <SplitSection
          left={<SectionHeader align="left" eyebrow="Why it's different" title="Knowledge in context, not in another tab" />}
          right={<BulletList items={[
            "Block-based editor with embeds and mentions",
            "Pages scoped to a project, deal or account",
            "AI summaries of long pages and meeting notes",
            "Templates for SOPs, runbooks and post-mortems",
            "Full-text + semantic search across everything",
            "Version history and granular sharing",
          ]} />}
        />
      </Section>
      <Section className="!py-12">
        <FAQ items={[
          { q: "Can we migrate from Notion?", a: "Yes — paste-from-Notion preserves structure and embeds." },
          { q: "Are docs versioned?", a: "Yes — full history with named restore points." },
          { q: "Is there AI writing assist?", a: "Yes, with /commands for summarize, rewrite, action-items and brief." },
        ]} />
      </Section>
      <CTABand title="Stop losing your knowledge in tabs" />
    </MarketingPage>
  );
}
