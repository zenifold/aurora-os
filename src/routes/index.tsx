import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Sparkles,
  Layers,
  Table as TableIcon,
  Kanban,
  ArrowRight,
  Check,
  Zap,
  MessageSquare,
  ListChecks,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aura — Where whiteboards meet workflows" },
      {
        name: "description",
        content:
          "Aura is the project OS for visual thinkers. Plan as a table, work as a board, think as a canvas — same tasks, every angle.",
      },
      { property: "og:title", content: "Aura — Where whiteboards meet workflows" },
      {
        property: "og:description",
        content: "The project tool that lets you think in tables, boards, and infinite canvases.",
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
      <Navbar signedIn={!!user} />

      <main>
        <Hero />
        <SocialProof />
        <FeatureGrid />
        <HowItWorks />
        <PricingTeaser />
      </main>

      <Footer />
    </div>
  );
}

/* ─── Navbar ──────────────────────────────────────────── */

function Navbar({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aura-gradient shadow-pop">
            <Sparkles className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-semibold tracking-tight">Aura</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <a href="#features" className="text-sm text-muted-foreground transition hover:text-foreground">Features</a>
          <a href="#how" className="text-sm text-muted-foreground transition hover:text-foreground">How it works</a>
          <a href="#pricing" className="text-sm text-muted-foreground transition hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Button asChild className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
              <Link to="/app">Go to app <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
                <Link to="/signup">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ─── Hero ──────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="aura-mesh absolute inset-0 -z-10 opacity-60" />
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3 w-3" />
          New — Aura v1
        </span>
        <h1 className="mt-6 max-w-4xl text-balance text-5xl font-bold tracking-tight md:text-7xl">
          Your projects.{" "}
          <span className="text-aura-gradient">Every angle.</span> One space.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          The only project tool that lets you think in tables, boards, and infinite canvases — without losing a single detail.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild className="bg-aura-gradient text-primary-foreground shadow-pop transition hover:scale-[1.02] hover:opacity-90 active:scale-[0.98]">
            <Link to="/signup">Start for free <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">No credit card required · Free forever for solo use</p>

        <ProductPreview />
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <div className="mt-16 grid w-full max-w-5xl gap-4 md:grid-cols-3">
      {[
        { icon: TableIcon, title: "Table", color: "from-aura-indigo to-aura-purple" },
        { icon: Kanban, title: "Board", color: "from-aura-purple to-aura-pink" },
        { icon: Layers, title: "Canvas", color: "from-aura-pink to-aura-orange" },
      ].map((v) => (
        <div
          key={v.title}
          className="rounded-2xl border border-border bg-card/60 p-5 shadow-elegant backdrop-blur transition hover:-translate-y-1 hover:shadow-pop"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-aura-gradient text-primary-foreground shadow-pop">
            <v.icon className="h-4 w-4" />
          </div>
          <p className="mt-3 text-sm font-semibold">{v.title} view</p>
          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-full rounded bg-muted" />
            <div className="h-2 w-4/5 rounded bg-muted" />
            <div className="h-2 w-2/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Social proof ──────────────────────────────────── */

function SocialProof() {
  return (
    <section className="border-y border-border/60 bg-muted/30 py-10">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <p className="text-sm text-muted-foreground">Loved by product teams, agencies, and visual thinkers</p>
        <div className="mt-6 grid grid-cols-2 items-center gap-6 md:grid-cols-5">
          {["Northwind", "Acme Co", "Lumen", "Pinnacle", "Helio"].map((name) => (
            <span
              key={name}
              className="font-mono text-sm tracking-wide text-muted-foreground/60"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Feature grid ──────────────────────────────────── */

function FeatureGrid() {
  const features = [
    {
      icon: TableIcon,
      title: "Table when you need structure",
      body: "Spreadsheet-fast inline editing. Custom field types, filters, sorts, and saved views built in.",
    },
    {
      icon: Kanban,
      title: "Board when you need flow",
      body: "Drag tasks across columns. A visual pipeline that stays in lockstep with everything else.",
    },
    {
      icon: Layers,
      title: "Canvas when you need clarity",
      body: "Infinite whiteboard for spatial planning. Same tasks, freeform thinking — connect and explore.",
    },
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          Three views. <span className="text-aura-gradient">One source of truth.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Every task is the same task — whether you're scanning a row, dragging a card, or sketching on a canvas.
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {features.map((f) => (
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
  );
}

/* ─── How it works ──────────────────────────────────── */

function HowItWorks() {
  const steps = [
    { icon: ListChecks, title: "Create a project", body: "Group work into projects, nested folders, and saved views." },
    { icon: Zap, title: "Add tasks anywhere", body: "Capture in Table, Board, or Canvas — they share the same data." },
    { icon: MessageSquare, title: "Switch perspectives instantly", body: "Your tasks follow you across views, with comments and history." },
  ];
  return (
    <section id="how" className="border-y border-border/60 bg-muted/20 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
            Get going in under a minute.
          </h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-aura-gradient text-sm font-semibold text-primary-foreground shadow-pop">
                {i + 1}
              </div>
              <h3 className="mt-4 flex items-center gap-2 text-lg font-semibold">
                <s.icon className="h-4 w-4 text-muted-foreground" /> {s.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing teaser ────────────────────────────────── */

function PricingTeaser() {
  const tiers = [
    {
      name: "Free",
      price: "$0",
      desc: "Perfect for solo work and side projects.",
      features: ["Unlimited tasks", "Up to 3 projects", "Table view", "1 user"],
    },
    {
      name: "Pro",
      price: "$12",
      popular: true,
      desc: "For freelancers and small teams.",
      features: ["Unlimited projects", "All views", "Custom fields", "Up to 10 users"],
    },
    {
      name: "Team",
      price: "$24",
      desc: "Power features for growing teams.",
      features: ["Everything in Pro", "Roles & permissions", "Priority support", "Unlimited users"],
    },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          Simple pricing.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Start free. Upgrade when your team grows.
        </p>
      </div>
      <div className="mt-12 grid items-stretch gap-6 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`relative flex flex-col rounded-2xl border bg-card p-6 transition hover:-translate-y-1 ${
              t.popular
                ? "border-transparent shadow-pop md:-translate-y-2"
                : "border-border shadow-elegant"
            }`}
            style={
              t.popular
                ? { backgroundImage: "linear-gradient(var(--card), var(--card)), var(--gradient-aura)", backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box", borderWidth: "2px", borderStyle: "solid", borderColor: "transparent" }
                : undefined
            }
          >
            {t.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-aura-gradient px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow-pop">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold">{t.name}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-bold">{t.price}</span>
              <span className="text-sm text-muted-foreground">/ user / mo</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
            <ul className="mt-6 flex-1 space-y-2">
              {t.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-aura-gradient" /> {f}
                </li>
              ))}
            </ul>
            <Button
              asChild
              className={`mt-6 ${t.popular ? "bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90" : ""}`}
              variant={t.popular ? "default" : "outline"}
            >
              <Link to="/signup">{t.popular ? "Start Pro trial" : "Get started"}</Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Footer ────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="h-px w-full bg-aura-gradient" />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-aura-gradient">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Aura</span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Where whiteboards meet workflows.
          </p>
        </div>
        <FooterCol title="Product" items={["Features", "Pricing", "Templates", "Changelog"]} />
        <FooterCol title="Company" items={["About", "Blog", "Careers", "Contact"]} />
        <FooterCol title="Legal" items={["Privacy", "Terms", "Security", "Status"]} />
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Aura. All rights reserved.
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i}>
            <a href="#" className="text-sm text-muted-foreground transition hover:text-foreground">{i}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
