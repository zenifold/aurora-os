import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter, GITHUB_URL } from "@/components/marketing/MarketingChrome";
import { Button } from "@/components/ui/button";
import {
  Table as TableIcon,
  Kanban,
  Layers,
  Calendar,
  GitBranch,
  Bot,
  Sparkles,
  ListChecks,
  Mic,
  StickyNote,
  Users,
  Workflow,
  ArrowRight,
  Github,
  Gauge,
} from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Aura, the open-source project OS" },
      {
        name: "description",
        content:
          "Tables, boards, canvases, timelines, custom workflows, meetings AI, notes — all open source, all in one place. Bring your own OpenRouter key.",
      },
      { property: "og:title", content: "Features — Aura" },
      {
        property: "og:description",
        content:
          "Everything you'd expect from a $20/seat productivity suite — open source and self-hostable.",
      },
    ],
  }),
  component: FeaturesPage,
});

const FEATURES = [
  {
    icon: TableIcon,
    title: "Table view",
    body: "Spreadsheet-fast inline editing, custom field types, filters, sorts, saved views, and color rules.",
  },
  {
    icon: Kanban,
    title: "Kanban board",
    body: "Drag tasks across statuses with WIP limits, swimlanes, and configurable card fields.",
  },
  {
    icon: Layers,
    title: "Infinite canvas",
    body: "Spatial whiteboard for the same tasks. Group, connect, sketch — no separate tool.",
  },
  {
    icon: Calendar,
    title: "Calendar & timeline",
    body: "Plan dates, drag bars, zoom day/week/month — and run effort-based scenarios with named snapshots.",
  },
  {
    icon: Workflow,
    title: "Custom workflows",
    body: "Design status flows visually with transitions, gates, approvals, SLAs, and per-status auto-actions.",
  },
  {
    icon: GitBranch,
    title: "Hierarchies & relations",
    body: "Initiatives → Epics → Tasks → Subtasks, plus blocks/duplicates/relates-to dependencies with rollups.",
  },
  {
    icon: Bot,
    title: "AI agents (BYO key)",
    body: "Wire your OpenRouter key once. Build agents that summarize, draft replies, or auto-update tasks.",
  },
  {
    icon: Mic,
    title: "Meetings AI",
    body: "Paste a transcript, get summary, decisions, risks, and one-click action items into projects.",
  },
  {
    icon: StickyNote,
    title: "Notes",
    body: "Project wiki and personal scratchpads with rich text, pins, reminders, and task conversion.",
  },
  {
    icon: ListChecks,
    title: "Custom fields",
    body: "Text, number, date, select, URL, email, checkbox — and Level of Effort that drives the timeline.",
  },
  {
    icon: Users,
    title: "Workspaces & roles",
    body: "Invite teammates, assign owner/member roles, share projects with row-level security from day one.",
  },
  {
    icon: Gauge,
    title: "Realtime everything",
    body: "Comments, presence, status changes, mentions — synced live across every connected client.",
  },
];

function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="aura-mesh absolute inset-0 -z-10 opacity-40" />
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3" />
              One tool, every angle
            </span>
            <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight md:text-6xl">
              Everything in <span className="text-aura-gradient">a $20/seat suite</span>,<br />
              open source and yours to keep.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
              Aura combines the table, board, canvas, timeline, workflow engine, meetings AI and
              docs of half a dozen products — without the per-seat tax.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
                <Link to="/signup">Try the hosted version</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                  <Github className="mr-1.5 h-4 w-4" /> Self-host it
                </a>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 shadow-elegant transition hover:-translate-y-1 hover:shadow-pop"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-aura-gradient-subtle">
                  <f.icon className="h-5 w-5 text-aura-gradient" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-20">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
              Bring your own AI key.
            </h2>
            <p className="mx-auto mt-4 text-muted-foreground">
              Aura talks to AI through <a className="text-aura-gradient font-medium" href="https://openrouter.ai" target="_blank" rel="noreferrer">OpenRouter</a>,
              so you choose the model — Claude, GPT, Gemini, Llama — and you pay only for the
              tokens you actually use. No markups, no seat-based AI add-ons.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link to="/how-it-works">See how it works <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
