import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter, GITHUB_URL } from "@/components/marketing/MarketingChrome";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github, Key, Server, Sparkles, Cloud, Terminal, Workflow } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — Aura" },
      {
        name: "description",
        content:
          "Sign up on the hosted version or self-host in minutes. Connect your OpenRouter key and own your data and your AI bill.",
      },
      { property: "og:title", content: "How Aura works" },
      {
        property: "og:description",
        content: "Two minutes to your first project. Bring your own OpenRouter key for AI features.",
      },
    ],
  }),
  component: HowItWorksPage,
});

const STEPS = [
  {
    icon: Cloud,
    title: "1. Pick how you run it",
    body: "Hosted on auraz.lovable.app for zero setup, or git-clone the repo and deploy to your own infra. Same code, your choice.",
  },
  {
    icon: Workflow,
    title: "2. Create a workspace",
    body: "Workspaces hold projects, custom fields, workflow templates, and team members. Roles & RLS are wired in from the first commit.",
  },
  {
    icon: Key,
    title: "3. Drop in your OpenRouter key (optional)",
    body: "Settings → AI → paste your key. AI features (meetings analysis, task agents, automations) start working instantly. No key, no problem — the rest of the app works fine.",
  },
  {
    icon: Sparkles,
    title: "4. Work the way you think",
    body: "Same tasks render as Table, Board, Canvas, Calendar, or Timeline. Switch perspectives instantly — your data is the source of truth, not the view.",
  },
];

const SELF_HOST = [
  { cmd: "git clone", text: `git clone ${GITHUB_URL}.git` },
  { cmd: "install", text: "bun install" },
  { cmd: "configure", text: "cp .env.example .env  # add your Supabase URL & key" },
  { cmd: "deploy", text: "bun run build && bun run deploy" },
];

function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="aura-mesh absolute inset-0 -z-10 opacity-40" />
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3" />
              From signup to flow in under 2 minutes
            </span>
            <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight md:text-6xl">
              Own your <span className="text-aura-gradient">workflow</span>.<br />
              Own your <span className="text-aura-gradient">AI bill</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
              Aura is open source under MIT. Use the hosted version, or run it yourself — and bring
              your own OpenRouter key so AI costs stay yours, not a vendor's revenue line.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-20">
          <div className="grid gap-6 md:grid-cols-2">
            {STEPS.map((s) => (
              <div
                key={s.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-elegant"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-aura-gradient-subtle">
                  <s.icon className="h-5 w-5 text-aura-gradient" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/30 py-20">
          <div className="mx-auto max-w-4xl px-6">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-aura-gradient" />
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Self-host in 4 commands</h2>
            </div>
            <p className="mt-2 text-muted-foreground">
              Aura runs on TanStack Start + Supabase. Drop it on Cloudflare, Vercel, Fly, or your own
              box.
            </p>
            <div className="mt-6 overflow-hidden rounded-xl border border-border bg-background font-mono text-sm">
              {SELF_HOST.map((step, i) => (
                <div
                  key={step.cmd}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {step.cmd}
                  </span>
                  <code className="ml-2 truncate">{step.text}</code>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Full guide in the repo README — issues and PRs welcome.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
            Why <span className="text-aura-gradient">bring your own key</span>?
          </h2>
          <p className="mx-auto mt-4 text-muted-foreground">
            Most tools mark up AI usage 3–10×, then charge per seat on top. Aura just connects to{" "}
            <a
              className="font-medium text-aura-gradient"
              href="https://openrouter.ai"
              target="_blank"
              rel="noreferrer"
            >
              OpenRouter
            </a>
            . You pick the model, you pay the actual provider rate, and a small team can run a year
            of AI for what one Notion AI seat costs a month.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
              <Link to="/signup">
                Start free <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                <Github className="mr-1.5 h-4 w-4" /> Star on GitHub
              </a>
            </Button>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
