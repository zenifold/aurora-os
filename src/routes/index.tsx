import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  MarketingHeader,
  MarketingFooter,
  GITHUB_URL,
} from "@/components/marketing/MarketingChrome";
import {
  Sparkles,
  Layers,
  Table as TableIcon,
  Kanban,
  ArrowRight,
  Github,
  Key,
  Server,
  Heart,
  Zap,
  Shield,
  DollarSign,
  Workflow,
  Mic,
  Users,
  Bot,
  CheckCircle2,
  GitBranch,
  MessageSquare,
  Briefcase,
  Target,
  Rocket,
  LineChart,
  FileText,
  Receipt,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aura — The company OS for agencies & software delivery teams" },
      {
        name: "description",
        content:
          "From sales to fulfillment in one place. Aura replaces Jira, Notion, Linear, HubSpot, and Fathom for agencies and software delivery teams — pipeline, projects, sprints, meetings, financials, and client portals.",
      },
      {
        property: "og:title",
        content: "Aura — Company OS: Sales → Delivery → Ops",
      },
      {
        property: "og:description",
        content:
          "Pipeline, projects, sprints, meetings AI, financials, and client portals — one open-source platform replacing Jira, Notion, Linear, HubSpot, and Fathom.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main>
        <Hero />
        <ValueBar />
        <ViewsShowcase />
        <CapabilitiesShowcase />
        <Manifesto />
        <PricingTeaser />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </div>
  );
}

/* ─── Hero ──────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="aura-mesh absolute inset-0 -z-10 opacity-60" />
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur transition hover:text-foreground"
        >
          <Github className="h-3 w-3" />
          Now open source — star us on GitHub
          <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
        </a>
        <h1 className="mt-6 max-w-4xl text-balance text-5xl font-bold tracking-tight md:text-7xl">
          Quit your <span className="text-aura-gradient">$20/seat</span> productivity tax.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          Aura is the open-source project OS. Tables, boards, canvases, timelines, meetings AI —
          all in one place. Self-host it, or use ours. Bring your own OpenRouter key and pay only
          for the AI you actually use.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            asChild
            className="bg-aura-gradient text-primary-foreground shadow-pop transition hover:scale-[1.02] hover:opacity-90 active:scale-[0.98]"
          >
            <Link to="/signup">
              Start free <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <Github className="mr-1.5 h-4 w-4" /> Self-host
            </a>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          MIT licensed · No credit card · Free forever for solo & self-host
        </p>

        
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <div className="mt-16 grid w-full max-w-5xl gap-4 md:grid-cols-3">
      <PreviewCard
        icon={TableIcon}
        title="Table"
        body="Spreadsheet-fast structure."
        accent="from-violet-500/20 to-fuchsia-500/10"
      >
        <MiniTable />
      </PreviewCard>
      <PreviewCard
        icon={Kanban}
        title="Board"
        body="Drag-and-drop flow."
        accent="from-sky-500/20 to-emerald-500/10"
      >
        <MiniBoard />
      </PreviewCard>
      <PreviewCard
        icon={Layers}
        title="Canvas"
        body="Spatial thinking."
        accent="from-amber-500/20 to-rose-500/10"
      >
        <MiniCanvas />
      </PreviewCard>
    </div>
  );
}

function PreviewCard({
  icon: Icon,
  title,
  body,
  accent,
  children,
}: {
  icon: typeof TableIcon;
  title: string;
  body: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card/70 p-4 shadow-elegant backdrop-blur transition hover:-translate-y-1 hover:shadow-pop">
      <div
        className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br opacity-60 transition group-hover:opacity-100 ${accent}`}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aura-gradient text-primary-foreground shadow-pop">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">{title} view</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{body}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400/70" />
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
        </div>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border border-border/70 bg-background/80">
        {children}
      </div>
    </div>
  );
}

function MiniTable() {
  const rows = [
    { name: "Onboarding flow", status: "In progress", c: "bg-amber-400" },
    { name: "Pricing page", status: "Review", c: "bg-violet-400" },
    { name: "Auth + RLS", status: "Done", c: "bg-emerald-400" },
    { name: "AI meeting notes", status: "Todo", c: "bg-sky-400" },
  ];
  return (
    <div className="text-[11px]">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-border/60 bg-muted/40 px-2.5 py-1.5 font-medium text-muted-foreground">
        <span>Task</span>
        <span>Status</span>
        <span className="w-8 text-right">Effort</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.name}
          className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2.5 py-1.5 ${
            i % 2 ? "bg-muted/20" : ""
          }`}
        >
          <span className="truncate text-foreground/90">{r.name}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-1.5 py-0.5 text-[10px]">
            <span className={`h-1.5 w-1.5 rounded-full ${r.c}`} />
            {r.status}
          </span>
          <span className="w-8 text-right text-muted-foreground">{[3, 5, 8, 2][i]}d</span>
        </div>
      ))}
    </div>
  );
}

function MiniBoard() {
  const cols = [
    { title: "Todo", cards: ["Hero copy", "Footer"], tint: "bg-sky-400" },
    { title: "Doing", cards: ["Pricing", "Auth"], tint: "bg-amber-400" },
    { title: "Done", cards: ["Schema"], tint: "bg-emerald-400" },
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5 p-2">
      {cols.map((c) => (
        <div key={c.title} className="rounded-md bg-muted/40 p-1.5">
          <div className="flex items-center gap-1 px-0.5 pb-1 text-[10px] font-medium text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${c.tint}`} />
            {c.title}
          </div>
          <div className="space-y-1">
            {c.cards.map((card) => (
              <div
                key={card}
                className="rounded border border-border/60 bg-background px-1.5 py-1 text-[10px] shadow-sm"
              >
                <div className="truncate font-medium">{card}</div>
                <div className="mt-1 h-1 w-2/3 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniCanvas() {
  return (
    <div className="relative h-[124px] w-full overflow-hidden bg-[radial-gradient(circle_at_1px_1px,_color-mix(in_oklab,var(--foreground)_18%,transparent)_1px,_transparent_0)] [background-size:10px_10px]">
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <line x1="38%" y1="32%" x2="62%" y2="58%" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="62%" y1="58%" x2="32%" y2="78%" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
      <div className="absolute left-[18%] top-[18%] rounded-md border border-violet-400/60 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
        Idea
      </div>
      <div className="absolute left-[52%] top-[44%] rounded-md border border-sky-400/60 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
        Spec
      </div>
      <div className="absolute left-[20%] top-[68%] rounded-md border border-emerald-400/60 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
        Ship
      </div>
      <div className="absolute right-3 top-2 rounded border border-border/60 bg-background/80 px-1.5 py-0.5 text-[9px] text-muted-foreground">
        ∞ infinite canvas
      </div>
    </div>
  );
}


/* ─── Value bar ─────────────────────────────────────── */

function ValueBar() {
  const items = [
    {
      icon: Github,
      label: "Open source",
      sub: "MIT licensed",
      tint: "from-violet-500/20 to-fuchsia-500/10",
      iconBg: "bg-violet-500/15 text-violet-500 ring-violet-500/30",
    },
    {
      icon: Key,
      label: "BYO API key",
      sub: "via OpenRouter",
      tint: "from-sky-500/20 to-cyan-500/10",
      iconBg: "bg-sky-500/15 text-sky-500 ring-sky-500/30",
    },
    {
      icon: Server,
      label: "Self-hostable",
      sub: "Your data, your infra",
      tint: "from-emerald-500/20 to-teal-500/10",
      iconBg: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/30",
    },
    {
      icon: DollarSign,
      label: "Fair pricing",
      sub: "No per-seat AI tax",
      tint: "from-amber-500/20 to-rose-500/10",
      iconBg: "bg-amber-500/15 text-amber-500 ring-amber-500/30",
    },
  ];
  return (
    <section className="relative border-y border-border/60 bg-muted/30 py-10">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-6 md:grid-cols-4">
        {items.map((i) => (
          <div
            key={i.label}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur transition hover:-translate-y-0.5 hover:border-border hover:shadow-elegant"
          >
            <div
              className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-50 blur-2xl transition group-hover:opacity-90 ${i.tint}`}
            />
            <div className="relative flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${i.iconBg}`}
              >
                <i.icon className="h-4 w-4" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{i.label}</p>
                <p className="truncate text-xs text-muted-foreground">{i.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Views showcase ────────────────────────────────── */

function ViewsShowcase() {
  const features = [
    {
      icon: TableIcon,
      eyebrow: "01 — Structure",
      title: "Table",
      tagline: "when you need structure",
      body: "Spreadsheet-fast inline editing. Custom field types including Level of Effort that drives timeline scenarios.",
      tint: "from-violet-500/25 via-fuchsia-500/10 to-transparent",
      ring: "ring-violet-500/30",
      visual: <MiniTable />,
    },
    {
      icon: Kanban,
      eyebrow: "02 — Flow",
      title: "Board",
      tagline: "when you need flow",
      body: "Drag tasks across statuses with WIP limits and a visual workflow engine you can customize per project.",
      tint: "from-sky-500/25 via-cyan-500/10 to-transparent",
      ring: "ring-sky-500/30",
      visual: <MiniBoard />,
    },
    {
      icon: Layers,
      eyebrow: "03 — Clarity",
      title: "Canvas",
      tagline: "when you need clarity",
      body: "Infinite whiteboard for spatial planning. Same tasks, freeform layout — no separate Miro tab.",
      tint: "from-amber-500/25 via-rose-500/10 to-transparent",
      ring: "ring-amber-500/30",
      visual: <MiniCanvas />,
    },
  ];
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-24">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Layers className="h-3 w-3" /> One database, many lenses
        </span>
        <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight md:text-5xl">
          One source of truth. <span className="text-aura-gradient">Every angle.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground">
          Every task is the same task — whether you're scanning a row, dragging a card, sketching
          on a canvas, or planning a Gantt scenario.
        </p>
      </div>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {features.map((f) => (
          <article
            key={f.title}
            className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elegant transition hover:-translate-y-1 hover:shadow-pop hover:ring-2 ${f.ring}`}
          >
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 transition group-hover:opacity-100 ${f.tint}`}
            />
            <div className="relative border-b border-border/60 bg-background/60 p-3 backdrop-blur">
              {f.visual}
            </div>
            <div className="relative flex flex-1 flex-col p-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {f.eyebrow}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aura-gradient text-primary-foreground shadow-pop">
                  <f.icon className="h-4 w-4" />
                </div>
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">
                {f.title}{" "}
                <span className="font-normal text-muted-foreground">{f.tagline}</span>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-12 text-center">
        <Button asChild variant="outline" className="group">
          <Link to="/features">
            See all features
            <ArrowRight className="ml-1.5 h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/* ─── Capabilities showcase ─────────────────────────── */

function CapabilitiesShowcase() {
  const caps = [
    {
      icon: Workflow,
      eyebrow: "Automations",
      title: "Task automations that just run",
      body: "Trigger status changes, route work, post updates, and create follow-ups when fields change — all in a visual rule builder, no Zapier tab required.",
      iconClass: "bg-violet-500/15 text-violet-500 ring-violet-500/30",
      visual: <AutomationVisual />,
    },
    {
      icon: Mic,
      eyebrow: "Meeting AI",
      title: "Meetings that turn into tasks",
      body: "Record or paste a transcript. Get a summary, decisions log, and assigned action items wired straight into the project — using your own AI key.",
      iconClass: "bg-sky-500/15 text-sky-500 ring-sky-500/30",
      visual: <MeetingVisual />,
    },
    {
      icon: Users,
      eyebrow: "Collaboration",
      title: "Real-time, presence, threads",
      body: "Live cursors, presence avatars, threaded comments on any task or canvas node, and granular roles backed by row-level security.",
      iconClass: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/30",
      visual: <CollabVisual />,
    },
  ];
  return (
    <section className="relative border-t border-border/60 bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3" /> Built for teams that ship
          </span>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight md:text-5xl">
            More than views.{" "}
            <span className="text-aura-gradient">A full operating system.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground">
            Automations, meeting intelligence, and collaboration — first-class, not bolted on.
          </p>
        </div>

        <div className="mt-14 space-y-6">
          {caps.map((c, i) => (
            <article
              key={c.title}
              className={`group grid gap-0 overflow-hidden rounded-2xl border border-border bg-card shadow-elegant transition hover:shadow-pop md:grid-cols-2 ${
                i % 2 ? "md:[&>div:first-child]:order-2" : ""
              }`}
            >
              <div className="relative flex items-center justify-center border-b border-border/60 bg-gradient-to-br from-muted/40 to-background p-6 md:border-b-0 md:border-r">
                {c.visual}
              </div>
              <div className="relative flex flex-col justify-center p-8">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ring-1 ${c.iconClass}`}
                  >
                    <c.icon className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {c.eyebrow}
                  </span>
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button asChild variant="outline" className="group">
            <Link to="/features">
              Explore every capability
              <ArrowRight className="ml-1.5 h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function AutomationVisual() {
  const steps = [
    { icon: GitBranch, label: "When status = Done", tone: "text-violet-500 bg-violet-500/10 ring-violet-500/30" },
    { icon: Bot, label: "Notify owner in thread", tone: "text-sky-500 bg-sky-500/10 ring-sky-500/30" },
    { icon: CheckCircle2, label: "Create follow-up task", tone: "text-emerald-500 bg-emerald-500/10 ring-emerald-500/30" },
  ];
  return (
    <div className="w-full max-w-sm space-y-2">
      {steps.map((s, i) => (
        <div key={s.label} className="relative">
          <div
            className={`flex items-center gap-3 rounded-xl border border-border bg-background p-3 shadow-sm ring-1 ${s.tone.replace(/text-\S+ /, "").replace(/bg-\S+\/10 /, "")}`}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${s.tone}`}>
              <s.icon className="h-4 w-4" strokeWidth={2.25} />
            </div>
            <span className="text-sm font-medium">{s.label}</span>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground">
              0{i + 1}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="ml-7 h-3 w-px bg-gradient-to-b from-border to-transparent" />
          )}
        </div>
      ))}
    </div>
  );
}

function MeetingVisual() {
  return (
    <div className="w-full max-w-sm space-y-3">
      <div className="rounded-xl border border-border bg-background p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-500 ring-1 ring-sky-500/30">
            <Mic className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium">Sprint review · 32 min</p>
            <div className="mt-1 flex h-1 items-center gap-px">
              {Array.from({ length: 28 }).map((_, i) => (
                <span
                  key={i}
                  className="w-px rounded-full bg-sky-500/60"
                  style={{ height: `${4 + Math.abs(Math.sin(i * 0.7)) * 10}px` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-background p-3 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Action items
        </p>
        <ul className="mt-2 space-y-1.5 text-xs">
          {[
            { who: "AB", what: "Ship pricing copy", tone: "bg-violet-500" },
            { who: "JK", what: "QA onboarding flow", tone: "bg-amber-500" },
            { who: "MR", what: "Draft Q3 OKRs", tone: "bg-emerald-500" },
          ].map((a) => (
            <li key={a.what} className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white ${a.tone}`}
              >
                {a.who}
              </span>
              <span className="flex-1 truncate">{a.what}</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CollabVisual() {
  return (
    <div className="w-full max-w-sm space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3 shadow-sm">
        <div className="flex -space-x-2">
          {[
            { i: "AB", c: "bg-violet-500" },
            { i: "JK", c: "bg-sky-500" },
            { i: "MR", c: "bg-emerald-500" },
            { i: "TL", c: "bg-amber-500" },
          ].map((u) => (
            <span
              key={u.i}
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white ${u.c}`}
            >
              {u.i}
            </span>
          ))}
        </div>
        <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          4 live now
        </span>
      </div>
      <div className="rounded-xl border border-border bg-background p-3 shadow-sm">
        <div className="flex items-start gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500 text-[10px] font-semibold text-white">
            AB
          </span>
          <div className="flex-1 rounded-lg bg-muted/50 px-2.5 py-1.5">
            <p className="text-xs">Moved this to Review — can you take a look?</p>
          </div>
        </div>
        <div className="mt-2 flex items-start gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[10px] font-semibold text-white">
            JK
          </span>
          <div className="flex-1 rounded-lg bg-muted/50 px-2.5 py-1.5">
            <p className="text-xs">On it 👀</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          Thread on “Pricing page”
        </div>
      </div>
    </div>
  );
}

/* ─── Manifesto ─────────────────────────────────────── */

function Manifesto() {
  const competitors = [
    { name: "Notion AI", price: "$20" },
    { name: "Asana", price: "$25" },
    { name: "Monday", price: "$24" },
    { name: "ClickUp", price: "$19" },
    { name: "Linear", price: "$16" },
  ];
  const pillars = [
    {
      icon: Sparkles,
      title: "Open by default",
      body: "Read the source, fork it, change it, run it. No black boxes around your team's data.",
      iconClass: "bg-violet-500/15 text-violet-500 ring-violet-500/30",
      glow: "from-violet-500/20 to-fuchsia-500/5",
      stat: "MIT",
      statLabel: "License",
    },
    {
      icon: Zap,
      title: "AI you control",
      body: "Drop in your OpenRouter key, pick your model. Pay providers directly — no 3× markup.",
      iconClass: "bg-sky-500/15 text-sky-500 ring-sky-500/30",
      glow: "from-sky-500/20 to-cyan-500/5",
      stat: "0×",
      statLabel: "Markup on AI",
    },
    {
      icon: Shield,
      title: "Your data, your rules",
      body: "Self-host on your Supabase + Cloudflare in 4 commands. RLS and roles wired in from the start.",
      iconClass: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/30",
      glow: "from-emerald-500/20 to-teal-500/5",
      stat: "4",
      statLabel: "Commands to deploy",
    },
  ];

  return (
    <section className="relative overflow-hidden border-y border-border/60 bg-muted/20 py-24">
      <div className="aura-mesh absolute inset-0 -z-10 opacity-30" />
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Heart className="h-3 w-3 text-rose-500" />
            Why we built this
          </span>
          <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight md:text-5xl">
            Productivity software is{" "}
            <span className="relative inline-block">
              <span className="text-aura-gradient">broken</span>
              <svg
                className="absolute -bottom-1 left-0 h-2 w-full text-aura-gradient/60"
                viewBox="0 0 100 8"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M0 6 Q 25 0, 50 4 T 100 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            .
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-muted-foreground">
            Notion, Asana, Monday, ClickUp, Linear — all great products, all charging{" "}
            <span className="font-semibold text-foreground">$10–$25 per user per month</span>, then
            stacking AI add-ons on top. Hundreds of dollars a month for software you don't fully
            use, can't host, and can't extend.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {competitors.map((c) => (
              <span
                key={c.name}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs backdrop-blur"
              >
                <span className="font-medium text-muted-foreground line-through decoration-rose-500/70 decoration-2">
                  {c.name}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {c.price}/seat
                </span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-aura-gradient px-3 py-1 text-xs font-semibold text-primary-foreground shadow-pop">
              <Sparkles className="h-3 w-3" /> Aura · open & yours
            </span>
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {pillars.map((c) => (
            <div
              key={c.title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-elegant transition hover:-translate-y-1 hover:shadow-pop"
            >
              <div
                className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-60 blur-3xl transition group-hover:opacity-100 ${c.glow}`}
              />
              <div className="relative flex items-start justify-between">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${c.iconClass}`}
                >
                  <c.icon className="h-5 w-5" strokeWidth={2.25} />
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-bold leading-none tracking-tight">
                    {c.stat}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.statLabel}
                  </div>
                </div>
              </div>
              <h3 className="relative mt-5 text-lg font-semibold">{c.title}</h3>
              <p className="relative mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {c.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button asChild variant="outline" className="group">
            <Link to="/how-it-works">
              How it works
              <ArrowRight className="ml-1.5 h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing teaser ────────────────────────────────── */

function PricingTeaser() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <div className="text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          Pricing that <span className="text-aura-gradient">respects you.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Free forever to self-host. Hosted plans only cover what it costs us to run servers for
          you. AI is BYO — pay providers, not us.
        </p>
      </div>
      <div className="mt-12 grid items-stretch gap-6 md:grid-cols-3">
        {[
          {
            name: "Self-host",
            price: "$0",
            sub: "forever",
            desc: "MIT-licensed. Run it anywhere.",
            cta: "GitHub",
            href: GITHUB_URL,
          },
          {
            name: "Hosted Personal",
            price: "$5",
            sub: "/ user / mo",
            desc: "Solo & small projects, BYO key.",
            cta: "Start trial",
            to: "/signup" as const,
            popular: true,
          },
          {
            name: "Hosted Team",
            price: "$8",
            sub: "/ seat / mo",
            desc: "Backups, SLA, priority support.",
            cta: "Start trial",
            to: "/signup" as const,
          },
        ].map((t) => (
          <div
            key={t.name}
            className={`flex flex-col rounded-2xl border bg-card p-6 ${
              t.popular ? "border-primary/40 shadow-pop" : "border-border shadow-elegant"
            }`}
          >
            <h3 className="text-base font-semibold">{t.name}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold">{t.price}</span>
              <span className="text-xs text-muted-foreground">{t.sub}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
            <div className="mt-auto pt-6">
              {t.to ? (
                <Button
                  asChild
                  className={
                    t.popular
                      ? "w-full bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
                      : "w-full"
                  }
                  variant={t.popular ? "default" : "outline"}
                >
                  <Link to={t.to}>{t.cta}</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="w-full">
                  <a href={t.href} target="_blank" rel="noreferrer">
                    <Github className="mr-1.5 h-4 w-4" /> {t.cta}
                  </a>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link
          to="/pricing"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Full pricing & FAQ →
        </Link>
      </div>
    </section>
  );
}

/* ─── Final CTA ─────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="border-t border-border/60 bg-aura-gradient-subtle py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          Ready to own your workflow?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Two minutes to a working project. Zero credit card. Cancel by closing the tab.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            asChild
            className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
          >
            <Link to="/signup">
              Start free <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <Github className="mr-1.5 h-4 w-4" /> View on GitHub
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
