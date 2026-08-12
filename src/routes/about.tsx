import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, BulletList, CTABand, SplitSection, StatRow } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Aurora — the company OS" },
      { name: "description", content: "We're building the operating system for service-led companies. Here's why, and who we are." },
      { property: "og:title", content: "About Aurora" },
      { property: "og:description", content: "Why we're building the company OS." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="About"
        title="One workspace for the whole company"
        subtitle="We watched too many great teams drown in tab-switching. Aurora is the workspace we wished existed when we ran our own agency."
      />
      <Section>
        <SplitSection
          left={<SectionHeader align="left" eyebrow="Why" title="The category we're building" subtitle="Services companies don't need 12 SaaS tools. They need one place that respects how the work actually flows." />}
          right={<BulletList items={[
            "Founders, ops and delivery in one source of truth",
            "AI that does the boring parts, not the hype parts",
            "Built for client-facing teams, not pure internal ones",
            "Honest pricing — guests are free or near-free",
          ]} />}
        />
      </Section>
      <Section>
        <StatRow stats={[
          { value: "2k+", label: "Teams using Aurora" },
          { value: "60+", label: "Countries" },
          { value: "$120M", label: "Invoiced through Aurora" },
          { value: "99.98%", label: "Uptime, trailing 90d" },
        ]} />
      </Section>
      <CTABand title="Join the calm" />
    </MarketingPage>
  );
}
