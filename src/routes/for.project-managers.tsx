import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, BulletList, FAQ, CTABand, SplitSection } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/for/project-managers")({
  head: () => ({
    meta: [
      { title: "Aurora for project managers — ship on margin" },
      { name: "description", content: "Run delivery, watch margin, keep clients honest. Sprints, RAID, change orders and exec-ready status reports." },
      { property: "og:title", content: "Aurora for PMs" },
      { property: "og:description", content: "Delivery without the babysitting." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="For project managers"
        title="Delivery without the babysitting"
        subtitle="Sprints, milestones, RAID, change orders and weekly status reports — drafted for you, ready to send."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "Projects feature", to: "/features/projects" }}
      />
      <Section>
        <SplitSection
          left={<SectionHeader align="left" eyebrow="What you stop doing" title="The PM tax, deleted" />}
          right={<BulletList items={[
            "Hand-writing weekly status emails",
            "Chasing teammates for updates in Slack",
            "Rebuilding the same Gantt in a new tool",
            "Spreadsheet-ing change orders into the budget",
            "Re-explaining the RAID log to execs",
          ]} />}
        />
      </Section>
      <Section className="!py-12">
        <FAQ items={[
          { q: "Does it work for non-software projects?", a: "Yes — events, construction, marketing campaigns, ProServ." },
          { q: "Can we run waterfall and agile side by side?", a: "Yes, methodology is per-project." },
        ]} />
      </Section>
      <CTABand title="Be the calm in the project" />
    </MarketingPage>
  );
}
