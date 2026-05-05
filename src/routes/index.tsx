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
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aura — The open-source project OS. Bring your own AI." },
      {
        name: "description",
        content:
          "Stop renting bloated productivity suites. Aura is open source, self-hostable, and connects to your own OpenRouter key for AI — table, board, canvas, timeline, meetings, all in one.",
      },
      {
        property: "og:title",
        content: "Aura — Open-source project OS, BYO AI key",
      },
      {
        property: "og:description",
        content:
          "Get off the $20/seat treadmill. Tables, boards, canvases, timelines, meetings AI — open source, yours forever.",
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

        <ProductPreview />
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
    { icon: Github, label: "Open source", sub: "MIT licensed" },
    { icon: Key, label: "BYO API key", sub: "via OpenRouter" },
    { icon: Server, label: "Self-hostable", sub: "Your data, your infra" },
    { icon: DollarSign, label: "Fair pricing", sub: "No per-seat AI tax" },
  ];
  return (
    <section className="border-y border-border/60 bg-muted/30 py-8">
      <div className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-6 px-6 md:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aura-gradient-subtle">
              <i.icon className="h-4 w-4 text-aura-gradient" />
            </div>
            <div>
              <p className="text-sm font-semibold">{i.label}</p>
              <p className="text-xs text-muted-foreground">{i.sub}</p>
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
      title: "Table when you need structure",
      body: "Spreadsheet-fast inline editing. Custom field types including Level of Effort that drives timeline scenarios.",
    },
    {
      icon: Kanban,
      title: "Board when you need flow",
      body: "Drag tasks across statuses with WIP limits and a visual workflow engine you can customize per project.",
    },
    {
      icon: Layers,
      title: "Canvas when you need clarity",
      body: "Infinite whiteboard for spatial planning. Same tasks, freeform layout — no separate Miro tab.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          One source of truth. <span className="text-aura-gradient">Every angle.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Every task is the same task — whether you're scanning a row, dragging a card, sketching
          on a canvas, or planning a Gantt scenario.
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-border bg-card p-6 shadow-elegant transition hover:-translate-y-1 hover:shadow-pop"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-aura-gradient-subtle">
              <f.icon className="h-5 w-5 text-aura-gradient" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Button asChild variant="outline">
          <Link to="/features">
            See all features <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/* ─── Manifesto ─────────────────────────────────────── */

function Manifesto() {
  return (
    <section className="border-y border-border/60 bg-muted/20 py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Heart className="h-3 w-3" />
            Why we built this
          </span>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight md:text-4xl">
            Productivity software is broken.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Notion, Asana, Monday, ClickUp, Linear — all great products, all charging $10–$25 per
            user per month, and now stacking AI add-ons on top. For most teams, it's hundreds of
            dollars a month for software you don't fully use, can't host, and can't extend.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "Open by default",
              body: "Read the source, fork it, change it, run it. No black boxes around your team's data.",
            },
            {
              icon: Zap,
              title: "AI you control",
              body: "Drop in your OpenRouter key, pick your model. Pay providers directly — no 3× markup.",
            },
            {
              icon: Shield,
              title: "Your data, your rules",
              body: "Self-host on your Supabase + Cloudflare in 4 commands. RLS and roles wired in from the start.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-aura-gradient-subtle">
                <c.icon className="h-5 w-5 text-aura-gradient" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{c.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button asChild variant="outline">
            <Link to="/how-it-works">
              How it works <ArrowRight className="ml-1.5 h-4 w-4" />
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
