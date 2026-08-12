import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, FeatureGrid, BulletList, CTABand } from "@/components/marketing/MarketingPage";
import { Building2, DollarSign, FileText, ClipboardList, Mic, Share2 } from "lucide-react";

export const Route = createFileRoute("/use-cases/consulting")({
  head: () => ({
    meta: [
      { title: "Aurora for consulting firms — engagements, deliverables, margin" },
      { name: "description", content: "Aurora gives consulting firms a single workspace for engagements, deliverables, time, billing and client communication — with the controls firms expect." },
      { property: "og:title", content: "Aurora for consulting firms" },
      { property: "og:description", content: "Run engagements, track utilization, protect margin and keep partners in the loop." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="For consulting"
        title="Run every engagement like your best partner would"
        subtitle="Aurora replaces the patchwork of decks, spreadsheets and ticketing tools with one workspace for engagements, deliverables, time, billing and client comms."
        primaryCta={{ label: "Start free", to: "/signup" }}
        secondaryCta={{ label: "See pricing", to: "/pricing" }}
      />
      <Section>
        <SectionHeader eyebrow="A consulting workspace" title="Engagements that don't slip" />
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
          <BulletList items={[
            "Engagement templates with deliverables and acceptance criteria",
            "Utilization, burn rate and realization per consultant",
            "Time entry that feeds invoices and weekly client reports",
            "Change requests with sign-off baked into the workflow",
          ]} />
          <BulletList items={[
            "Branded client portals — exactly what to share, no more",
            "Document workspace for proposals, SOWs and deliverables",
            "Meeting AI captures every client call and steering committee",
            "Custom roles for partners, principals, managers and analysts",
          ]} />
        </div>
      </Section>
      <Section>
        <SectionHeader title="Built for senior teams" />
        <div className="mt-10">
          <FeatureGrid items={[
            { to: "/features/projects", icon: Building2, title: "Engagement OS", description: "Structured engagements with milestones and deliverables." },
            { to: "/features/finance", icon: DollarSign, title: "Revenue + margin", description: "Live margin, WIP and realization — by engagement and consultant." },
            { to: "/features/docs-and-notes", icon: FileText, title: "Deliverable workspace", description: "Write proposals, decks and reports inside the engagement." },
            { to: "/features/client-portals", icon: Share2, title: "Client portals", description: "Steering committee view without sending another deck." },
            { to: "/features/meetings-ai", icon: Mic, title: "Meeting AI", description: "Every workshop captured and actioned." },
            { to: "/features/permissions-rbac", icon: ClipboardList, title: "Permissions", description: "Partner-grade controls and audit trail." },
          ]} />
        </div>
      </Section>
      <CTABand title="Make every engagement repeatable" subtitle="Templates and SOPs that scale your best partner." />
    </MarketingPage>
  );
}
