import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, FeatureGrid, BulletList, CTABand } from "@/components/marketing/MarketingPage";
import { Users, Briefcase, DollarSign, ClipboardList, Mic, Share2 } from "lucide-react";

export const Route = createFileRoute("/use-cases/professional-services")({
  head: () => ({
    meta: [
      { title: "Aurora for professional services teams in SaaS" },
      { name: "description", content: "Run ProServ inside your SaaS company without bolting on a second tool stack. Onboardings, implementations, expansions — tracked, billed, reported." },
      { property: "og:title", content: "Aurora for ProServ inside SaaS" },
      { property: "og:description", content: "Implementations and expansions on the same platform as your CRM and roadmap." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Professional services"
        title="ProServ that doesn't need a second tool stack"
        subtitle="Onboardings, implementations and expansion projects in the same workspace as your CRM and roadmap. No more reconciling between systems."
        primaryCta={{ label: "Start free", to: "/signup" }}
        secondaryCta={{ label: "Talk to us", to: "/contact" }}
      />
      <Section>
        <SectionHeader eyebrow="What it solves" title="Bridge the gap between sales and CS" />
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
          <BulletList items={[
            "Implementation templates seeded from the deal record",
            "Time, expense and milestone billing per engagement",
            "Visibility into ProServ margin alongside ARR",
            "Hand-off to CS that doesn't drop the ball",
          ]} />
          <BulletList items={[
            "Customer-facing portal scoped per account",
            "Cross-team RACI without spreadsheets",
            "Meeting AI captures kickoff and steering committees",
            "RBAC keeps sensitive deal data out of delivery views",
          ]} />
        </div>
      </Section>
      <Section>
        <SectionHeader title="Workflows that span sales → delivery" />
        <div className="mt-10">
          <FeatureGrid items={[
            { to: "/features/crm", icon: Users, title: "Linked accounts", description: "Project and account are one record, not two." },
            { to: "/features/projects", icon: Briefcase, title: "Implementation OS", description: "Templates for onboarding and expansion." },
            { to: "/features/finance", icon: DollarSign, title: "ProServ billing", description: "T&M, fixed-fee or milestone billing." },
            { to: "/features/client-portals", icon: Share2, title: "Customer portals", description: "A single shared workspace per account." },
            { to: "/features/meetings-ai", icon: Mic, title: "Meeting AI", description: "Every implementation call, summarized." },
            { to: "/features/permissions-rbac", icon: ClipboardList, title: "Permissions", description: "Sales sees pipeline, delivery sees work — no leakage." },
          ]} />
        </div>
      </Section>
      <CTABand title="Stop building ProServ from spare parts" subtitle="Aurora is the platform your services team already wishes you had." />
    </MarketingPage>
  );
}
