import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, FeatureGrid, CTABand, StatRow, Quote } from "@/components/marketing/MarketingPage";
import { USE_CASES } from "@/components/marketing/marketing-data";
import { ArrowRight, Workflow, Zap, Sparkles, Layers, GitBranch, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/use-cases")({
  head: () => ({
    meta: [
      { title: "Use cases — Aurora company OS" },
      { name: "description", content: "From digital agencies to professional services teams, see how Aurora replaces the patchwork of tools with one company OS." },
      { property: "og:title", content: "Aurora use cases — built for teams that ship and bill" },
      { property: "og:description", content: "Agencies, software delivery, consulting, freelancers, client portals, ProServ — one platform for the whole lifecycle." },
    ],
  }),
  component: UseCasesIndex,
});

const LIFECYCLE = [
  { icon: Sparkles, label: "Pitch", body: "Deals, proposals and SOWs in one CRM that talks to delivery." },
  { icon: Layers, label: "Plan", body: "Spin up engagements from templates — sprints, RAID, milestones." },
  { icon: Workflow, label: "Deliver", body: "Tasks, docs, meetings AI and approvals — without tab-switching." },
  { icon: Zap, label: "Bill", body: "Time, expenses and milestone invoicing wired to your accounting tool." },
];

const TEAM_QUOTES = [
  { quote: "We killed Jira, Notion and HubSpot in the same week. Nobody asked to bring them back.", author: "Maya Reyes", role: "Founder, Northwind Studio" },
  { quote: "Status reports used to take me a full afternoon. Aurora drafts them while I'm in standup.", author: "Daniel Ortega", role: "Delivery lead, Helix Consulting" },
  { quote: "Clients log into our portal and just… get it. No more 'where do I find that?' emails.", author: "Priya Shah", role: "Head of CS, Loomwork" },
];

function UseCasesIndex() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Use cases"
        title="One company OS, many shapes of work"
        subtitle="Aurora is built around the way work actually flows — from first conversation to invoice. Pick the scenario closest to yours."
        primaryCta={{ label: "Get started free", to: "/signup" }}
        secondaryCta={{ label: "See features", to: "/features" }}
      />

      {/* Stats */}
      <Section className="!py-14">
        <StatRow stats={[
          { value: "2k+", label: "Teams shipping with Aurora" },
          { value: "60+", label: "Countries" },
          { value: "$120M", label: "Invoiced through Aurora" },
          { value: "11hrs", label: "Saved per person, per week" },
        ]} />
      </Section>

      {/* Scenarios grid */}
      <Section className="!py-14">
        <SectionHeader title="Pick your scenario" subtitle="Every page is a hands-on playbook of how Aurora fits that team — workflows, screens, integrations." />
        <div className="mt-12">
          <FeatureGrid items={USE_CASES} columns={3} />
        </div>
      </Section>

      {/* Lifecycle */}
      <Section className="!py-14">
        <SectionHeader
          eyebrow="The lifecycle"
          title="Pitch → Plan → Deliver → Bill"
          subtitle="One workspace covers the full arc. No re-keying between sales, delivery and finance tools."
        />
        <div className="relative mt-12 grid gap-4 md:grid-cols-4">
          {LIFECYCLE.map((step, i) => (
            <div key={step.label} className="relative rounded-xl border border-border bg-card p-6">
              <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Step {i + 1}
              </div>
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-aura-gradient text-primary-foreground shadow-pop">
                <step.icon className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold tracking-tight">{step.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Replaces strip */}
      <section className="border-y border-border bg-muted/30 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeader
            eyebrow="What it replaces"
            title="One tool, fewer logins"
            subtitle="A typical Aurora workspace lets teams cancel four to seven existing SaaS tools."
          />
          <div className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-3">
            {["Jira", "Notion", "HubSpot", "ClickUp", "Asana", "Monday", "Trello", "Smartsheet", "Harvest", "Loom AI", "Fireflies", "Bonsai"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground line-through decoration-foreground/40">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Quotes per role */}
      <Section className="!py-16">
        <SectionHeader title="What teams say after a month" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {TEAM_QUOTES.map((q) => (
            <figure key={q.author} className="rounded-xl border border-border bg-card p-6">
              <blockquote className="text-pretty text-base leading-relaxed">&ldquo;{q.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{q.author}</span> · {q.role}
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* By stage / by role split */}
      <Section className="!py-14">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-8">
            <div className="absolute inset-0 bg-aura-gradient opacity-[0.05]" aria-hidden />
            <div className="relative">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-aura-gradient text-primary-foreground shadow-pop">
                <GitBranch className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight">Compare by alternative</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                See exactly where Aurora replaces Jira, Notion, Linear, HubSpot or Monday — and where it doesn't.
              </p>
              <Link to="/vs" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:gap-2.5 transition-all">
                Browse comparisons <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-8">
            <div className="absolute inset-0 bg-aura-gradient opacity-[0.05]" aria-hidden />
            <div className="relative">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-aura-gradient text-primary-foreground shadow-pop">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight">Find your role</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Founders, ops, PMs, finance and client services each get a workflow tailored to how they actually work.
              </p>
              <Link to="/for" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:gap-2.5 transition-all">
                Browse by role <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* Big quote */}
      <Section className="!py-14">
        <Quote
          quote="Aurora is the first tool I've rolled out where the team thanked me instead of complaining."
          author="Tomás Ihaka"
          role="COO, Halfmast Agency"
        />
      </Section>

      <CTABand
        title="Not sure which fits?"
        subtitle="Start free and shape Aurora around your team. Most workspaces are set up in a single afternoon."
        primaryCta={{ label: "Start free", to: "/signup" }}
        secondaryCta={{ label: "Talk to us", to: "/contact" }}
      />
    </MarketingPage>
  );
}
