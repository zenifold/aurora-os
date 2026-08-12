import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, FeatureGrid, BulletList, CTABand } from "@/components/marketing/MarketingPage";
import { User, DollarSign, FileText, Receipt, Mic, GitBranch } from "lucide-react";

export const Route = createFileRoute("/use-cases/freelancers")({
  head: () => ({
    meta: [
      { title: "Aurora for freelancers & small studios" },
      { name: "description", content: "Proposals, projects, time and invoices in one workspace — without the spreadsheet sprawl. Aurora is the calm OS for solo operators and tiny teams." },
      { property: "og:title", content: "Aurora for freelancers" },
      { property: "og:description", content: "Run client work end-to-end without six tabs open." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="For freelancers"
        title="The OS that grows with you"
        subtitle="Start with one project, end up running a studio. Aurora keeps proposals, work and invoices in one place from day one."
        primaryCta={{ label: "Start free", to: "/signup" }}
        secondaryCta={{ label: "See pricing", to: "/pricing" }}
      />
      <Section>
        <SectionHeader eyebrow="What it replaces" title="One workspace, fewer tabs" />
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
          <BulletList items={[
            "Proposals and SOWs that turn into projects on a click",
            "Time and expense tracking that flows into invoices",
            "Client portals so updates don't live in email",
            "Notes, docs and references next to the work",
          ]} />
          <BulletList items={[
            "A pipeline view for the work coming next month",
            "Recurring invoices for retainers",
            "Meeting AI for kickoffs and weekly check-ins",
            "Open source — your data, your control",
          ]} />
        </div>
      </Section>
      <Section>
        <SectionHeader title="Just enough structure" />
        <div className="mt-10">
          <FeatureGrid items={[
            { to: "/features/projects", icon: User, title: "Lean projects", description: "Templates for the work you do over and over." },
            { to: "/features/crm", icon: GitBranch, title: "Pipeline", description: "Track the deals that pay next month's rent." },
            { to: "/features/finance", icon: DollarSign, title: "Invoices", description: "Time, fixed-fee or retainer billing in two clicks." },
            { to: "/features/docs-and-notes", icon: FileText, title: "Docs", description: "Your playbook + every client brief, searchable." },
            { to: "/features/meetings-ai", icon: Mic, title: "Meeting AI", description: "Never write meeting notes again." },
            { to: "/pricing", icon: Receipt, title: "Free to start", description: "A generous free tier — you only pay when you grow." },
          ]} />
        </div>
      </Section>
      <CTABand title="Stop running your business in tabs" subtitle="Free forever for solo operators." />
    </MarketingPage>
  );
}
