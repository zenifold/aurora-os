import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, BulletList, FAQ, CTABand, SplitSection, FeatureGrid, Quote } from "@/components/marketing/MarketingPage";
import { Kanban, GitBranch, AlertTriangle, FileEdit, BarChart3, Calendar, ArrowUpRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/features/projects")({
  head: () => ({
    meta: [
      { title: "Projects, sprints & RAID — Aurora features" },
      { name: "description", content: "Sprints, milestones, RAID logs, change orders and status reports. Aurora's project layer replaces Jira and Linear for delivery teams." },
      { property: "og:title", content: "Aurora — projects & delivery" },
      { property: "og:description", content: "The project OS for teams that actually have to ship." },
    ],
  }),
  component: Page,
});

const COLUMNS = [
  { name: "To do", tone: "bg-slate-500", tasks: [
    { id: "HM-201", title: "Audit homepage hero variants", owner: "MR", pts: 3 },
    { id: "HM-204", title: "Wire CRM webhook to inbox", owner: "DJ", pts: 5 },
  ]},
  { name: "In progress", tone: "bg-amber-500", tasks: [
    { id: "HM-198", title: "Build status report email template", owner: "PS", pts: 8 },
    { id: "HM-212", title: "Migrate legacy phases", owner: "MR", pts: 5 },
  ]},
  { name: "Review", tone: "bg-violet-500", tasks: [
    { id: "HM-188", title: "RAID export PDF", owner: "DJ", pts: 3 },
  ]},
  { name: "Done", tone: "bg-emerald-500", tasks: [
    { id: "HM-176", title: "Sprint planning autopopulate", owner: "PS", pts: 5 },
    { id: "HM-180", title: "Client portal sign-off button", owner: "MR", pts: 3 },
  ]},
];

function ProjectMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 text-xs font-medium text-muted-foreground">aurora · Halfmast relaunch · Sprint 14</span>
        </div>
        <div className="hidden gap-1 md:flex">
          {["Board", "Timeline", "Sprint", "RAID"].map((t, i) => (
            <span key={t} className={`rounded px-2 py-0.5 text-[10px] font-medium ${i === 0 ? "bg-foreground text-background" : "text-muted-foreground"}`}>{t}</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 p-4">
        {COLUMNS.map((col) => (
          <div key={col.name} className="rounded-lg bg-background/60 p-2.5">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${col.tone}`} />
                <span className="text-[11px] font-medium">{col.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{col.tasks.length}</span>
            </div>
            <div className="space-y-1.5">
              {col.tasks.map((t) => (
                <div key={t.id} className="rounded-md border border-border bg-card p-2 shadow-sm">
                  <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                    <span>{t.id}</span>
                    <span>{t.pts}pt</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug">{t.title}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-aura-gradient text-[9px] font-semibold text-primary-foreground">{t.owner}</span>
                    <span className="text-[9px] text-muted-foreground">Aug 24</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-border bg-background/40 p-4 text-xs">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Velocity</div>
          <div className="mt-0.5 font-semibold">42 pts <span className="text-emerald-500">↑ 8</span></div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Burndown</div>
          <div className="mt-1 flex h-3 items-end gap-0.5">
            {[14, 12, 11, 9, 7, 5, 3].map((h, i) => (
              <div key={i} className="flex-1 rounded-sm bg-aura-gradient" style={{ height: `${h * 6}%` }} />
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Health</div>
          <div className="mt-0.5 inline-flex items-center gap-1 font-semibold text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> On track</div>
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
        title="Projects built for shipping work"
        subtitle="Not a generic task list. Aurora projects ship with sprints, milestones, RAID, change orders and exec-ready status reports baked in."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "See vs Jira", to: "/vs/jira" }}
      />
      <Section className="!py-12">
        <ProjectMockup />
      </Section>
      <Section>
        <SectionHeader eyebrow="What's inside" title="The delivery primitives, in one place" />
        <div className="mt-10">
          <FeatureGrid items={[
            { icon: Kanban, title: "Sprints", description: "Plan, run, retrospect. Capacity, velocity and burndown out of the box." },
            { icon: Calendar, title: "Milestones", description: "Tied to commercials — billing triggers and sign-off live here." },
            { icon: AlertTriangle, title: "RAID log", description: "Risks, assumptions, issues, dependencies. Owners and severity." },
            { icon: FileEdit, title: "Change orders", description: "Recompute scope and budget without leaving the project." },
            { icon: BarChart3, title: "Status reports", description: "Auto-generated, exec-ready. Schedule them to clients on Fridays." },
            { icon: GitBranch, title: "Methodology agnostic", description: "Scrum, Kanban, Shape Up — pick per project, switch when needed." },
          ]} />
        </div>
      </Section>
      <Section className="!py-12">
        <SplitSection
          left={
            <div>
              <SectionHeader align="left" eyebrow="Anatomy" title="Every project has the same scaffolding" subtitle="So new starters, clients and execs can read any project without a tour." />
              <div className="mt-6">
                <BulletList items={[
                  "Overview, status and health on the first screen",
                  "Sprints with velocity, capacity and burndown",
                  "Milestones tied to commercial deliverables",
                  "RAID log with owners and severity",
                  "Change orders that recompute the budget",
                  "Pages and notes scoped to the project",
                ]} />
              </div>
            </div>
          }
          right={
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Status report · Aug 23</div>
              <div className="mt-2 text-lg font-semibold">Halfmast relaunch · On track</div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Sprint 14 delivered 42 pts (+8 vs forecast). Hero variants in review with stakeholder. RAID: 1 risk added (CMS migration window). Budget burn at 58% with 64% time elapsed — margin 22%.</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-border p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Scope</div>
                  <div className="text-sm font-semibold text-emerald-500">Green</div>
                </div>
                <div className="rounded-md border border-border p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Schedule</div>
                  <div className="text-sm font-semibold text-emerald-500">Green</div>
                </div>
                <div className="rounded-md border border-border p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Budget</div>
                  <div className="text-sm font-semibold text-amber-500">Amber</div>
                </div>
              </div>
            </div>
          }
        />
      </Section>
      <Section className="!py-12">
        <Quote
          quote="The auto-generated status reports alone saved our PMs about a day a week. Clients think we're psychic — we're just consistent."
          author="Daniel Ortega"
          role="Delivery Director, Northwind Co."
        />
      </Section>
      <Section>
        <SectionHeader eyebrow="It replaces" title="One workspace instead of five" />
        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-2">
          {["Jira", "Linear", "ClickUp", "Smartsheet", "Asana", "Monday"].map((t) => (
            <span key={t} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground line-through">{t}</span>
          ))}
        </div>
      </Section>
      <Section className="!pt-0">
        <SectionHeader eyebrow="Pairs with" title="The rest of the stack" />
        <div className="mx-auto mt-8 grid max-w-3xl gap-3 md:grid-cols-3">
          {[
            { to: "/features/crm", title: "CRM" },
            { to: "/features/finance", title: "Finance" },
            { to: "/features/client-portals", title: "Client portals" },
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
          { q: "Can we run multiple methodologies?", a: "Yes — Scrum, Kanban, Shape Up or your own. Switch per-project." },
          { q: "Does it integrate with GitHub?", a: "Yes, tickets link to PRs and merge state. Status reports auto-update." },
          { q: "Can clients see the project?", a: "Yes — share scoped views via portals or expiring share links." },
          { q: "How do change orders work?", a: "Log new scope, set price impact, route for client sign-off, then the budget and timeline recompute automatically." },
        ]} />
      </Section>
      <CTABand title="Project work, finally calm" secondaryCta={{ label: "Compare to Jira", to: "/vs/jira" }} />
    </MarketingPage>
  );
}
