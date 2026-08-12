import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MarketingPage,
  PageHero,
  Section,
  SectionHeader,
  FeatureGrid,
  FAQ,
  CTABand,
  Quote,
  StatRow,
} from "@/components/marketing/MarketingPage";
import { GITHUB_URL } from "@/components/marketing/MarketingChrome";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link as LinkIcon, ArrowRight, Github, Key, Server, Sparkles, Cloud, Terminal, Workflow, Database, Shield, Zap, Layers, GitBranch, Globe, Cpu, Lock, Eye, DollarSign, Check } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Aurora works — from signup to flow in 2 minutes" },
      {
        name: "description",
        content:
          "Hosted or self-hosted, bring your own AI key, own your data. See the architecture, the 4-step setup, the cost math, and the security model.",
      },
      { property: "og:title", content: "How Aurora works" },
      {
        property: "og:description",
        content: "Open-source workspace on TanStack Start + Supabase. BYO OpenRouter key. Same code hosted or self-run.",
      },
    ],
  }),
  component: HowItWorksPage,
});

/* -------------------------------------------------------- */
/* Data                                                      */
/* -------------------------------------------------------- */

const STEPS = [
  {
    n: "01",
    icon: Cloud,
    title: "Pick how you run it",
    body: "Deploy it anywhere: git-clone and ship to your own infrastructure. Identical codebase — switch later without a migration.",
    detail: "MIT licensed. Cloudflare Workers, Vercel, Fly, your own box — anywhere TanStack Start runs.",
  },
  {
    n: "02",
    icon: Workflow,
    title: "Create a workspace",
    body: "Workspaces hold projects, custom fields, workflow templates and people. Roles and row-level security wire in on first commit.",
    detail: "Invite your team, set roles, pick a workspace preset (agency, product, consulting) and you're seeded with sensible defaults.",
  },
  {
    n: "03",
    icon: Key,
    title: "Drop in your OpenRouter key",
    body: "Settings → AI → paste your key. Meeting analysis, task agents, Magic Plan, automations turn on instantly. Skip it and the rest of the app still works.",
    detail: "Pick any model OpenRouter supports — GPT-5, Claude, Gemini, Llama. Switch per-feature.",
  },
  {
    n: "04",
    icon: Sparkles,
    title: "Work the way you think",
    body: "The same tasks render as Table, Board, Canvas, Calendar or Timeline. Switch perspectives instantly — your data is the source of truth, not the view.",
    detail: "Saved views per person, per project. No more 'export to spreadsheet to actually look at it.'",
  },
];

const STACK = [
  { icon: Layers, title: "TanStack Start v1", body: "React 19, file-based routes, typed server functions. SSR + edge-ready." },
  { icon: Database, title: "Supabase Postgres", body: "Row-level security from day one. Migrations versioned in the repo." },
  { icon: Cpu, title: "OpenRouter", body: "One key, 100+ models. You pay the provider rate, no markup." },
  { icon: Globe, title: "Cloudflare Workers", body: "Edge runtime by default. Sub-100ms server functions globally." },
  { icon: Shield, title: "Your data, your rules", body: "Self-host means the database lives in your account. No vendor lock-in." },
  { icon: GitBranch, title: "Open source, MIT", body: "Fork it, extend it, ship your own SaaS on top. PRs welcome." },
];

const SELF_HOST = [
  { cmd: "clone", text: `git clone ${GITHUB_URL}.git aurora` },
  { cmd: "install", text: "cd aurora && bun install" },
  { cmd: "configure", text: "cp .env.example .env  # add Supabase URL + anon key" },
  { cmd: "migrate", text: "bunx supabase db push" },
  { cmd: "deploy", text: "bun run build && bun run deploy" },
];

const COST_ROWS = [
  { tool: "Notion AI", price: "$10 / seat / mo", team10: "$1,200 / yr", note: "Per-seat, model locked" },
  { tool: "ClickUp Brain", price: "$7 / seat / mo", team10: "$840 / yr", note: "Per-seat, model locked" },
  { tool: "Asana AI", price: "Enterprise add-on", team10: "$2k+ / yr", note: "Bundled, opaque pricing" },
  { tool: "Aurora + your key", price: "Actual model cost", team10: "~$60–$240 / yr*", note: "Shared, any model" },
];

const FAQS = [
  {
    q: "Do I need an OpenRouter key to use Aurora?",
    a: "No. Tasks, projects, CRM, meetings recording, notes, the whole workspace works without it. The key unlocks AI features: summaries, agents, Magic Plan, draft replies, transcript analysis.",
  },
  {
    q: "What's the difference between hosted and self-hosted?",
    a: "Same code, same features. Hosted is one click — we run the database, edge functions and updates. Self-hosted is your infra, your database, your control. You can move between them without losing data.",
  },
  {
    q: "How does the AI cost math actually work?",
    a: "OpenRouter bills you per-token at the provider's published rate. A typical 10-person team running daily meetings, agents and Magic Plan lands around $5–20/month total — not per seat. Heavy GPT-5 use is more; Gemini Flash is pennies.",
  },
  {
    q: "Is my data sent to OpenRouter?",
    a: "Only the data needed for the specific AI call (e.g. a meeting transcript when you click Summarize). No background training, no telemetry to us. Self-hosted means even less surface area.",
  },
  {
    q: "Can I bring my own model provider?",
    a: "OpenRouter is the default because it routes to everyone in one key. Direct OpenAI/Anthropic/Google keys are on the roadmap — and trivial to wire if you're self-hosting.",
  },
  {
    q: "What happens to my data if I stop using Aurora?",
    a: "Export everything as CSV/JSON from Settings. Self-hosters already have the raw Postgres database. There's no proprietary format and no vendor lock-in.",
  },
];

/* -------------------------------------------------------- */
/* Page                                                      */
/* -------------------------------------------------------- */

function HowItWorksPage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="How it works"
        title={
          <>
            Own your <span className="bg-aura-gradient bg-clip-text text-transparent">workflow</span>.
            <br />
            Own your <span className="bg-aura-gradient bg-clip-text text-transparent">AI bill</span>.
          </>
        }
        subtitle="Aurora is open source under MIT. Use the hosted version, or run it yourself — and bring your own OpenRouter key so AI costs stay yours, not a vendor's revenue line."
        primaryCta={{ label: "Start free", to: "/signup" }}
        secondaryCta={{ label: "See features", to: "/features" }}
      />

      {/* Stats */}
      <Section className="pt-12 pb-0">
        <StatRow
          stats={[
            { value: "2 min", label: "Signup to first task" },
            { value: "4 cmds", label: "To self-host" },
            { value: "100+", label: "AI models via OpenRouter" },
            { value: "$0", label: "Per-seat AI tax" },
          ]}
        />
      </Section>

      {/* Steps */}
      <Section>
        <SectionHeader
          eyebrow="The 4-step setup"
          title="From signup to flow, fast"
          subtitle="Same path whether you're hosted or self-hosted."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="group relative rounded-2xl border border-border bg-card p-7 transition hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-elegant"
            >
              <div className="flex items-start justify-between">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-aura-gradient text-primary-foreground shadow-pop">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground/80">
                {s.detail}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Architecture diagram */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeader
            eyebrow="Under the hood"
            title="A small, modern stack you can actually read"
            subtitle="No microservice maze, no proprietary runtime. Open source primitives all the way down."
          />

          <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid gap-px bg-border md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              {/* Browser */}
              <div className="bg-card p-8 text-center">
                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-aura-gradient-subtle">
                  <Eye className="h-5 w-5 text-foreground" />
                </div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Client</div>
                <div className="mt-1 font-semibold">Browser / Extension</div>
                <p className="mt-2 text-xs text-muted-foreground">React 19 · TanStack Router · Tailwind</p>
              </div>
              <div className="hidden items-center justify-center bg-card px-2 md:flex">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              {/* Edge */}
              <div className="bg-card p-8 text-center">
                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-aura-gradient-subtle">
                  <Zap className="h-5 w-5 text-foreground" />
                </div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Edge</div>
                <div className="mt-1 font-semibold">Server functions</div>
                <p className="mt-2 text-xs text-muted-foreground">TanStack Start · Cloudflare Workers</p>
              </div>
              <div className="hidden items-center justify-center bg-card px-2 md:flex">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              {/* Data + AI */}
              <div className="bg-card p-8 text-center">
                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-aura-gradient-subtle">
                  <Database className="h-5 w-5 text-foreground" />
                </div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Data + AI</div>
                <div className="mt-1 font-semibold">Postgres · OpenRouter</div>
                <p className="mt-2 text-xs text-muted-foreground">RLS · realtime · your model</p>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STACK.map((s) => (
              <div key={s.title} className="rounded-xl border border-border bg-card p-5">
                <s.icon className="h-5 w-5 text-foreground" />
                <h4 className="mt-3 text-sm font-semibold">{s.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Self-host */}
      <Section>
        <SectionHeader
          eyebrow="Self-host"
          title="Five commands. Your own Aurora."
          subtitle="Runs on Cloudflare, Vercel, Fly or any Node host. Detailed guide in the README."
        />
        <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-xl border border-border bg-card font-mono text-sm shadow-elegant">
          <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
            <span className="ml-3 text-[11px] uppercase tracking-wider text-muted-foreground">~/aurora</span>
          </div>
          {SELF_HOST.map((step, i) => (
            <div
              key={step.cmd}
              className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-border/60" : ""}`}
            >
              <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="w-20 shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">
                {step.cmd}
              </span>
              <code className="text-foreground/90">
                <span className="text-muted-foreground">$ </span>
                {step.text}
              </code>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Full setup: ~15 min · Maintenance: cron + a redeploy when you pull.</span>
          <Button asChild variant="outline" size="sm">
            <a href={`${GITHUB_URL}#self-hosting`} target="_blank" rel="noreferrer">
              <Github className="mr-1.5 h-3.5 w-3.5" /> Read the guide
            </a>
          </Button>
        </div>
      </Section>

      {/* BYO Key cost math */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeader
            eyebrow="Bring your own key"
            title="The cost math nobody else shows you"
            subtitle="Most tools mark up AI 3–10× and charge per seat on top. Aurora connects to OpenRouter — you pick the model, you pay the provider rate."
          />
          <div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Tool</th>
                  <th className="px-5 py-3 text-left">Price</th>
                  <th className="px-5 py-3 text-left">10-person team / yr</th>
                  <th className="px-5 py-3 text-left">Note</th>
                </tr>
              </thead>
              <tbody>
                {COST_ROWS.map((r, i) => {
                  const isAurora = r.tool.startsWith("Aurora");
                  return (
                    <tr
                      key={r.tool}
                      className={`${i % 2 === 0 ? "bg-background/40" : ""} ${isAurora ? "bg-aura-gradient-subtle/40" : ""}`}
                    >
                      <td className="px-5 py-3.5 text-sm font-medium">
                        {isAurora ? (
                          <span className="inline-flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-foreground" />
                            {r.tool}
                          </span>
                        ) : (
                          r.tool
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{r.price}</td>
                      <td className={`px-5 py-3.5 text-sm ${isAurora ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {r.team10}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{r.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mx-auto mt-4 max-w-4xl text-xs text-muted-foreground">
            *Estimated for a 10-person team running daily meetings, Magic Plan and agents on Gemini Flash / GPT-5-mini. Heavy GPT-5 use is more; the point is <em>you can see and pick</em>.
          </p>
        </div>
      </section>

      {/* Security */}
      <Section>
        <SectionHeader
          eyebrow="Security & data"
          title="Yours stays yours"
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { icon: Lock, title: "Row-level security", body: "Every table ships with RLS policies. Nobody — including the hosted operators — sees what they shouldn't." },
            { icon: Shield, title: "BYO key, BYO data", body: "Self-host means your Postgres, your secrets, your audit log. Hosted runs on the same code with a clear privacy line." },
            { icon: DollarSign, title: "No AI markup", body: "OpenRouter bills you direct at provider rates. We don't see your usage, we don't see your bill." },
          ].map((c) => (
            <div key={c.title} className="rounded-xl border border-border bg-card p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-aura-gradient text-primary-foreground shadow-pop">
                <c.icon className="h-5 w-5" />
              </div>
              <h4 className="mt-4 text-base font-semibold">{c.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Quote */}
      <Section className="pt-0">
        <Quote
          quote="We replaced Notion AI, Linear, and a Zapier subscription with one self-hosted Aurora. Our AI bill went from $480/mo to about $14."
          author="Marta K."
          role="Head of ops, 12-person studio"
        />
      </Section>

      {/* FAQ */}
      <Section>
        <SectionHeader eyebrow="Questions" title="Things people ask" />
        <div className="mt-10">
          <FAQ items={FAQS} />
        </div>
      </Section>

      <CTABand
        title="Try it now, host it later"
        subtitle="Start hosted in 30 seconds. Move to your own infra whenever you're ready — same data, same code."
        primaryCta={{ label: "Start free", to: "/signup" }}
        secondaryCta={{ label: "Star on GitHub", to: "/extension" }}
      />
    </MarketingPage>
  );
}
