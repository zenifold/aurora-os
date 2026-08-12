import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, BulletList, FAQ, CTABand, SplitSection, FeatureGrid, Quote, StatRow } from "@/components/marketing/MarketingPage";
import { GitBranch, TrendingUp, Mail, Briefcase, Users, BarChart3, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/features/crm")({
  head: () => ({
    meta: [
      { title: "CRM, pipeline & forecasting — Aurora features" },
      { name: "description", content: "A lean, opinionated CRM with accounts, contacts, deals and forecasting — living next to your delivery work, not in a silo." },
      { property: "og:title", content: "Aurora — CRM & pipeline" },
      { property: "og:description", content: "Pipeline next to projects. Forecasting that touches reality." },
    ],
  }),
  component: Page,
});

const STAGES = [
  { name: "Discovery", count: 8, value: "$184k", tone: "from-slate-500 to-slate-600" },
  { name: "Qualified", count: 6, value: "$312k", tone: "from-indigo-500 to-indigo-600" },
  { name: "Proposal", count: 4, value: "$268k", tone: "from-violet-500 to-violet-600" },
  { name: "Negotiation", count: 3, value: "$195k", tone: "from-fuchsia-500 to-fuchsia-600" },
  { name: "Won", count: 5, value: "$420k", tone: "from-emerald-500 to-emerald-600" },
];

const DEALS = [
  { id: "DL-184", account: "Northwind Co.", value: "$84k", owner: "MR", probability: 80 },
  { id: "DL-201", account: "Lumen Studios", value: "$42k", owner: "DJ", probability: 60 },
  { id: "DL-217", account: "Halcyon Labs", value: "$128k", owner: "PS", probability: 45 },
];

function PipelineMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 text-xs font-medium text-muted-foreground">aurora · pipeline · Q3</span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">forecast $1.38M</span>
      </div>
      <div className="grid grid-cols-5 gap-3 p-4">
        {STAGES.map((s) => (
          <div key={s.name} className="rounded-lg border border-border bg-background/60 p-3">
            <div className={`mb-2 h-1 w-8 rounded-full bg-gradient-to-r ${s.tone}`} />
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{s.name}</div>
            <div className="mt-1.5 text-sm font-semibold tabular-nums">{s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.count} deals</div>
            <div className="mt-3 space-y-1.5">
              {Array.from({ length: Math.min(s.count, 3) }).map((_, i) => (
                <div key={i} className="h-6 rounded bg-muted/60" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border bg-background/40 p-4">
        <div className="mb-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Deals closing this week</div>
        <div className="space-y-1.5">
          {DEALS.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-xs">
              <span className="font-mono text-[10px] text-muted-foreground">{d.id}</span>
              <span className="flex-1 truncate font-medium">{d.account}</span>
              <span className="hidden text-muted-foreground md:inline">prob {d.probability}%</span>
              <span className="font-semibold tabular-nums">{d.value}</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-aura-gradient text-[10px] font-semibold text-primary-foreground">{d.owner}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Feature deep dive"
        title="A CRM that lives where the work happens"
        subtitle="Aurora's CRM is opinionated, fast, and connected — accounts, contacts and deals one click away from the projects they fund."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "See vs HubSpot", to: "/vs/hubspot" }}
      />
      <Section className="!py-12">
        <PipelineMockup />
      </Section>
      <Section className="!pt-0">
        <StatRow stats={[
          { value: "11hr", label: "saved per rep / week" },
          { value: "94%", label: "forecast accuracy" },
          { value: "0", label: "double data entry" },
          { value: "1 click", label: "deal → project" },
        ]} />
      </Section>
      <Section>
        <SectionHeader eyebrow="What's inside" title="Built for teams that sell and deliver" subtitle="Not a marketing automation cathedral. A pipeline that touches reality." />
        <div className="mt-10">
          <FeatureGrid items={[
            { icon: GitBranch, title: "Visual pipeline", description: "Drag, edit, weight. Multiple boards per team, all in one record." },
            { icon: TrendingUp, title: "Weighted forecast", description: "Probability x value, rolled up by owner, team, region or product." },
            { icon: Mail, title: "Activity auto-log", description: "Email, calls and meetings attach to the right deal automatically." },
            { icon: Briefcase, title: "Won → project", description: "A won deal kicks off a project from your template, with the team pre-assigned." },
            { icon: Users, title: "Account 360°", description: "Every contact, deal, project, invoice and message — on one page." },
            { icon: BarChart3, title: "Exec dashboards", description: "Forecast, conversion, cycle time. Saved views per role." },
          ]} />
        </div>
      </Section>
      <Section className="!py-12">
        <SplitSection
          left={<SectionHeader align="left" eyebrow="Anatomy" title="From first email to forecast" />}
          right={
            <BulletList items={[
              "Accounts and contacts unified across the workspace",
              "Pipeline stages with weighted forecast",
              "Activities that auto-log from email and meeting AI",
              "Won deals create projects from a template",
              "Account view shows pipeline + projects + revenue",
              "Forecast dashboard for the whole exec team",
            ]} />
          }
        />
      </Section>
      <Section className="!py-12">
        <Quote
          quote="We moved 18 months of HubSpot data into Aurora in an afternoon and never looked back. The team finally sells in the same tool they deliver in."
          author="Priya Shah"
          role="Head of Revenue, Halcyon Labs"
        />
      </Section>
      <Section>
        <SectionHeader eyebrow="Pairs with" title="The rest of the stack" />
        <div className="mx-auto mt-8 grid max-w-3xl gap-3 md:grid-cols-3">
          {[
            { to: "/features/projects", title: "Projects" },
            { to: "/features/finance", title: "Finance" },
            { to: "/features/meetings-ai", title: "Meetings AI" },
          ].map((p) => (
            <Link key={p.to} to={p.to} className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-elegant">
              <span className="text-sm font-medium">{p.title}</span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
            </Link>
          ))}
        </div>
      </Section>
      <Section className="!py-12">
        <FAQ items={[
          { q: "Is it replacing HubSpot?", a: "For agencies, consulting and studios — yes. We don't try to be a marketing automation platform." },
          { q: "Can we import contacts?", a: "Yes, CSV or via the API. Field mapping included." },
          { q: "Does it support multi-currency?", a: "Yes, both for pipeline value and invoicing." },
          { q: "How does the deal → project handoff work?", a: "When a deal moves to Won, Aurora can spin up a project from a template you choose, copy the team, set the budget from the deal value, and notify the delivery lead." },
        ]} />
      </Section>
      <CTABand title="One record from prospect to invoice" secondaryCta={{ label: "Compare to HubSpot", to: "/vs/hubspot" }} />
    </MarketingPage>
  );
}
