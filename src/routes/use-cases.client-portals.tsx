import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, FeatureGrid, BulletList, CTABand } from "@/components/marketing/MarketingPage";
import { Globe2, Share2, Shield, FileText, MessageSquare, Eye } from "lucide-react";

export const Route = createFileRoute("/use-cases/client-portals")({
  head: () => ({
    meta: [
      { title: "Aurora client portals — share work, not chaos" },
      { name: "description", content: "Branded portals and scoped guest access so clients see the work they care about — and nothing they don't. Built into Aurora." },
      { property: "og:title", content: "Aurora client portals" },
      { property: "og:description", content: "Branded views, guest access, external sharing — clients in the loop without giving them the keys." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Client portals"
        title="Make clients feel like insiders, safely"
        subtitle="Aurora turns any project, view or document into a branded portal — with scoped guest access, expiring share links, and full audit."
        primaryCta={{ label: "Start free", to: "/signup" }}
        secondaryCta={{ label: "See permissions", to: "/features/permissions-rbac" }}
      />
      <Section>
        <SectionHeader eyebrow="The two modes" title="Portals or pure shares — your call" />
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
          <BulletList items={[
            "Branded portals with your logo, palette and copy",
            "Guest users with named roles and email auth",
            "Scoped to specific projects, views or documents",
            "Comment without seeing private channels",
          ]} />
          <BulletList items={[
            "Public share links with optional password",
            "Expiring or view-capped tokens for sensitive shares",
            "Revoke any time, audit every view",
            "No new tool for clients to learn",
          ]} />
        </div>
      </Section>
      <Section>
        <SectionHeader title="Built for trust" />
        <div className="mt-10">
          <FeatureGrid items={[
            { to: "/features/client-portals", icon: Globe2, title: "Branded portals", description: "Your colors, your logo, your domain (Pro)." },
            { to: "/features/permissions-rbac", icon: Shield, title: "Granular access", description: "Per-resource permissions and a guest role." },
            { to: "/features/views", icon: Eye, title: "Shareable views", description: "Filter once, share to the client as a single screen." },
            { to: "/features/docs-and-notes", icon: FileText, title: "Shared docs", description: "Status reports and deliverables they can comment on." },
            { to: "/features/agents", icon: MessageSquare, title: "Auto-updates", description: "Aurora posts weekly status to the portal for you." },
            { to: "/security", icon: Share2, title: "Audit log", description: "Every view, comment and download — recorded." },
          ]} />
        </div>
      </Section>
      <CTABand title="Stop emailing PDFs. Share live." subtitle="Aurora client portals are included in every plan." />
    </MarketingPage>
  );
}
