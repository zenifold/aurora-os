import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, FeatureGrid, BulletList, Quote, CTABand } from "@/components/marketing/MarketingPage";
import { Code2, GitBranch, Kanban, Bot, FileText, Shield } from "lucide-react";

export const Route = createFileRoute("/use-cases/software-delivery")({
  head: () => ({
    meta: [
      { title: "Aurora for software delivery — sprints, RAID, releases" },
      { name: "description", content: "Run sprints, manage risks and ship releases with client-ready status reports. Aurora replaces Jira + Notion for software delivery teams." },
      { property: "og:title", content: "Aurora for software delivery teams" },
      { property: "og:description", content: "Sprints, RAID, releases and client visibility — without the Jira tax." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="For software delivery"
        title="Sprints and roadmaps without the Jira tax"
        subtitle="Aurora gives dev shops, product studios and in-house delivery teams a calm, fast workspace — and a client view that doesn't need translation."
        primaryCta={{ label: "Try Aurora free", to: "/signup" }}
        secondaryCta={{ label: "Compare to Jira", to: "/vs/jira" }}
      />
      <Section>
        <SectionHeader eyebrow="What you get" title="Real delivery, not ticket choreography" />
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
          <BulletList items={[
            "Sprints with capacity, velocity and burndown",
            "Milestones tied to commercial deliverables",
            "RAID log connected to status reports",
            "Change orders that update the budget automatically",
          ]} />
          <BulletList items={[
            "Per-engineer time + cost rolled into project margin",
            "Public, branded status pages for clients",
            "Standups and retros captured by meeting AI",
            "Roadmaps that exec, sales and delivery can all read",
          ]} />
        </div>
      </Section>
      <Section>
        <SectionHeader title="Built for shipping" />
        <div className="mt-10">
          <FeatureGrid items={[
            { to: "/features/projects", icon: Kanban, title: "Sprints & boards", description: "Plan, ship and review — keyboard-first, opinionated." },
            { to: "/features/views", icon: Code2, title: "Every view", description: "Timeline for roadmap, board for sprint, table for backlog." },
            { to: "/features/agents", icon: Bot, title: "Aurora agents", description: "Background workers that triage, label and nudge." },
            { to: "/features/docs-and-notes", icon: FileText, title: "Tech docs", description: "Specs and ADRs next to the tickets that implement them." },
            { to: "/features/permissions-rbac", icon: Shield, title: "Granular access", description: "Engineers, contractors, clients — each see only what they need." },
            { to: "/features/crm", icon: GitBranch, title: "From sale to sprint", description: "Won deals turn into projects pre-loaded with sprint cadence." },
          ]} />
        </div>
      </Section>
      <Section className="!py-12">
        <Quote quote="Linear-grade velocity for the whole company, not just engineering." author="Head of Delivery" role="Product studio" />
      </Section>
      <CTABand title="Ship faster, explain less" subtitle="Aurora keeps delivery, exec and client teams reading the same screen." />
    </MarketingPage>
  );
}
