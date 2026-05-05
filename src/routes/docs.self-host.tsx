import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MarketingHeader, MarketingFooter, GITHUB_URL } from "@/components/marketing/MarketingChrome";
import { Button } from "@/components/ui/button";
import {
  Terminal,
  Cloud,
  Database,
  KeyRound,
  GitBranch,
  Server,
  Check,
  Copy,
  ArrowRight,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/docs/self-host")({
  head: () => ({
    meta: [
      { title: "Self-host Aura — 4 commands to your own project OS" },
      {
        name: "description",
        content:
          "Run Aura on your own infrastructure. Clone the repo, point it at Supabase + Cloudflare, and ship in minutes. Your data, your keys, your rules.",
      },
      { property: "og:title", content: "Self-host Aura — your data, your infra" },
      {
        property: "og:description",
        content:
          "Step-by-step guide to deploy Aura on Supabase + Cloudflare Workers. MIT licensed, BYO OpenRouter key, no per-seat fees.",
      },
    ],
  }),
  component: SelfHostDocsPage,
});

const requirements = [
  { icon: GitBranch, label: "Git", hint: "Any recent version" },
  { icon: Terminal, label: "Bun ≥ 1.0", hint: "or Node 20 + npm" },
  { icon: Database, label: "Supabase project", hint: "Free tier works" },
  { icon: Cloud, label: "Cloudflare account", hint: "For Workers + Pages" },
];

const steps = [
  {
    n: "01",
    icon: GitBranch,
    title: "Clone the repo",
    body: "Grab the source from GitHub. It's MIT — fork it, change it, ship it.",
    code: `git clone ${GITHUB_URL}.git aura
cd aura
bun install`,
  },
  {
    n: "02",
    icon: Database,
    title: "Provision your database",
    body: "Create a Supabase project, then push the included migrations. Schema, RLS, roles, triggers — all wired in.",
    code: `bunx supabase link --project-ref <your-ref>
bunx supabase db push`,
  },
  {
    n: "03",
    icon: KeyRound,
    title: "Set environment variables",
    body: "Drop your Supabase keys into a .env file. No secrets are baked into the build.",
    code: `# .env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<ref>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`,
  },
  {
    n: "04",
    icon: Cloud,
    title: "Deploy to Cloudflare",
    body: "One command. Workers handles SSR, the static bundle ships to the edge worldwide.",
    code: `bun run deploy
# → https://aura.<your-account>.workers.dev`,
  },
];

const afterSteps = [
  {
    icon: Sparkles,
    title: "Add your OpenRouter key",
    body: "Open the app, go to Settings → AI, and paste your key. Pick any model — pay providers directly, no markup.",
    href: "https://openrouter.ai/keys",
    cta: "Get an OpenRouter key",
  },
  {
    icon: ShieldCheck,
    title: "Invite your team",
    body: "Auth is built in: email + Google OAuth out of the box. Roles and RLS policies enforce who can do what.",
  },
  {
    icon: Zap,
    title: "Customize anything",
    body: "It's your codebase. Add fields, build views, swap providers. No black boxes between you and your data.",
  },
];

function SelfHostDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="aura-mesh absolute inset-0 opacity-60" aria-hidden />
          <div className="relative mx-auto max-w-5xl px-6 py-20 md:py-28">
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
              >
                Docs
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-xs uppercase tracking-[0.14em] text-foreground">
                Self-host
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-6xl">
              Self-host Aura in{" "}
              <span className="bg-aura-gradient bg-clip-text text-transparent">4 commands</span>.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              Your project OS, on your Supabase, on your Cloudflare. MIT licensed, no telemetry,
              no per-seat ceiling. Bring your own AI key and pay providers directly.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                asChild
                className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
              >
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                  <GitBranch className="mr-1.5 h-4 w-4" /> View on GitHub
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="#quickstart">
                  Quickstart <ArrowRight className="ml-1.5 h-4 w-4" />
                </a>
              </Button>
            </div>

            {/* Requirements strip */}
            <div className="mt-10 grid gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:grid-cols-2 md:grid-cols-4">
              {requirements.map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-aura-gradient-subtle">
                    <r.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quickstart steps */}
        <section id="quickstart" className="border-b border-border/60">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Quickstart
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                  Four steps to your own instance
                </h2>
              </div>
              <p className="hidden max-w-xs text-sm text-muted-foreground md:block">
                Roughly 10 minutes start to finish, assuming you have Supabase and Cloudflare
                accounts ready.
              </p>
            </div>

            <ol className="mt-10 space-y-5">
              {steps.map((s) => (
                <li
                  key={s.n}
                  className="grid gap-5 rounded-2xl border border-border bg-card p-6 md:grid-cols-12"
                >
                  <div className="md:col-span-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-aura-gradient-subtle">
                        <s.icon className="h-4 w-4" />
                      </div>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
                  </div>
                  <div className="md:col-span-8">
                    <CodeBlock code={s.code} />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* After deploy */}
        <section className="border-b border-border/60 bg-muted/20">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              After deploy
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              You're live. Now make it yours.
            </h2>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {afterSteps.map((s) => (
                <div
                  key={s.title}
                  className="rounded-2xl border border-border bg-card p-6 transition hover:border-foreground/20 hover:shadow-elegant"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aura-gradient-subtle">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
                  {s.href && (
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {s.cta} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Architecture / FAQ */}
        <section className="border-b border-border/60">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Architecture
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  No magic. Just open standards.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Aura is a TanStack Start app on Cloudflare Workers, backed by Supabase
                  (Postgres + Auth + Storage). AI calls go directly to OpenRouter using your key —
                  Aura never proxies prompts or stores them.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {[
                    "TanStack Start (React 19) on Cloudflare Workers",
                    "Postgres with Row-Level Security from day one",
                    "OpenRouter for AI — model-agnostic, BYO key",
                    "Realtime via Supabase channels",
                    "MIT licensed end-to-end",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2 text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Common questions
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">FAQ</h2>
                <dl className="mt-5 space-y-5">
                  <Faq
                    q="Do I need to pay anyone?"
                    a="No. The code is MIT — free forever. You only pay your infrastructure bills (Supabase + Cloudflare both have generous free tiers) and your AI provider directly via OpenRouter."
                  />
                  <Faq
                    q="Can I migrate later from Aura Cloud to self-host?"
                    a="Yes. Export your data from Settings → Data, spin up your own instance, and import. No lock-in by design."
                  />
                  <Faq
                    q="What about updates?"
                    a="git pull and re-run migrations. Releases are tagged on GitHub with changelogs."
                  />
                  <Faq
                    q="Can I run it without Cloudflare?"
                    a="Yes — any host that supports Node 20 will work. Cloudflare is the default because Workers + the edge runtime are what we ship and test against."
                  />
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden">
          <div className="aura-mesh absolute inset-0 opacity-50" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-aura-gradient shadow-pop">
              <Server className="h-5 w-5 text-primary-foreground" />
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
              Ready to own your stack?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Star the repo, clone it, ship it. Or skip the ops and use Aura Cloud — same
              codebase, hosted by us.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button
                asChild
                className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
              >
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                  <GitBranch className="mr-1.5 h-4 w-4" /> Clone on GitHub
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/pricing">
                  See hosted pricing <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-background/80">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            terminal
          </span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            toast.success("Copied to clipboard");
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground/90">
        {code}
      </pre>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <dt className="font-medium">{q}</dt>
      <dd className="mt-1 text-sm text-muted-foreground">{a}</dd>
    </div>
  );
}
