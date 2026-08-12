import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, FeatureGrid, BulletList, Quote, CTABand, StatRow } from "@/components/marketing/MarketingPage";
import { Briefcase, GitBranch, DollarSign, FileText, Mic, Share2 } from "lucide-react";

export const Route = createFileRoute("/use-cases/agencies")({
  head: () => ({
    meta: [
      { title: "Aurora for digital agencies — one OS from sale to invoice" },
      { name: "description", content: "Replace Jira, HubSpot, Notion and a spreadsheet with one workspace. Aurora runs new business, delivery, retainers and reporting for digital agencies." },
      { property: "og:title", content: "Aurora for agencies — sales, delivery and ops in one place" },
      { property: "og:description", content: "Pipeline, projects, sprints, time, invoices and client portals for digital and creative agencies." },
    ],
  }),
  component: AgenciesPage,
});

function AgenciesPage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="For agencies"
        title="Stop running your agency from seven tools"
        subtitle="Aurora unifies pipeline, delivery, time, billing and client communication into one place — so every team sees the same project and the same margin."
        primaryCta={{ label: "Start free", to: "/signup" }}
        secondaryCta={{ label: "See pricing", to: "/pricing" }}
      />
      <Section>
        <StatRow stats={[
          { value: "1×", label: "tool, not seven" },
          { value: "0", label: "duplicate data entry" },
          { value: "100%", label: "of margin visible" },
          { value: "<1d", label: "to onboard the team" },
        ]} />
      </Section>
      <Section className="!py-12">
        <SectionHeader eyebrow="A day in Aurora" title="One workspace, one source of truth" subtitle="Sales books a deal, delivery spins up a project, finance invoices off the same record." />
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
          <BulletList items={[
            "New business pipeline with forecasting and weighted value",
            "Won deals auto-create projects with the right template",
            "Sprints, milestones and RAID for delivery teams",
            "Time tracking that rolls into project budgets and invoices",
          ]} />
          <BulletList items={[
            "Retainer tracking with monthly draw-down visibility",
            "Client portals — clients see only what you decide",
            "Meeting AI captures every kickoff and weekly status",
            "Custom roles for account, delivery, finance and exec",
          ]} />
        </div>
      </Section>
      <Section>
        <SectionHeader title="The features that matter most" />
        <div className="mt-10">
          <FeatureGrid items={[
            { to: "/features/crm", icon: GitBranch, title: "Pipeline & forecasting", description: "Predict next quarter's cash, not just next month's deals." },
            { to: "/features/projects", icon: Briefcase, title: "Projects & sprints", description: "Real delivery — milestones, change orders, status reports." },
            { to: "/features/finance", icon: DollarSign, title: "Invoices & margin", description: "Bill on time + materials, fixed fee or retainer. See margin live." },
            { to: "/features/meetings-ai", icon: Mic, title: "Meeting AI", description: "Auto-summaries and follow-ups that show up in the project." },
            { to: "/features/client-portals", icon: Share2, title: "Client portals", description: "Branded portals that make clients feel in the loop." },
            { to: "/features/docs-and-notes", icon: FileText, title: "Docs & SOPs", description: "Keep the playbook next to the projects that use it." },
          ]} />
        </div>
      </Section>
      <Section className="!py-12">
        <Quote
          quote="We killed Jira, Notion and HubSpot in one afternoon. The team finally sees the same project."
          author="Operations Director"
          role="40-person digital agency"
        />
      </Section>
      <CTABand title="Run your agency on one platform" subtitle="Free to start. Invite the whole team. No setup call required." />
    </MarketingPage>
  );
}
