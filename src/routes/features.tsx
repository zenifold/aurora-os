import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MarketingPage,
  PageHero,
  Section,
  SectionHeader,
  FeatureGrid,
  CTABand,
  StatRow,
  FAQ,
  SplitSection,
  BulletList,
} from "@/components/marketing/MarketingPage";
import { FEATURES } from "@/components/marketing/marketing-data";
import {
  Sparkles,
  Zap,
  Shield,
  Plug,
  ArrowRight,
  Chrome,
  Github,
  Slack,
  Figma,
  Mail,
  Calendar,
  Cloud,
  Database,
} from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Aurora company OS" },
      {
        name: "description",
        content:
          "Projects, CRM, finance, meetings AI, agents, client portals, docs, RBAC and a Chrome extension — one workspace for the whole company.",
      },
      { property: "og:title", content: "Aurora — every feature, one workspace" },
      {
        property: "og:description",
        content:
          "The features that replace Jira, Notion, HubSpot, ClickUp and a half-dozen other tools.",
      },
    ],
  }),
  component: FeaturesPage,
});

const PILLARS = [
  { icon: Zap, title: "Fast by default", body: "Keyboard-first, instant transitions, optimistic UI. Loads in under 200ms on a cold cache." },
  { icon: Shield, title: "Enterprise-grade RBAC", body: "Custom roles, field-level controls, SSO, SCIM and a tamper-evident audit log." },
  { icon: Plug, title: "Connects to everything", body: "GitHub, Slack, Google, Microsoft, Stripe, Xero, QuickBooks, Netsuite and your own API." },
  { icon: Sparkles, title: "AI that does the work", body: "Background agents, meeting capture and inline /commands across every surface." },
];

const INTEGRATIONS = [
  { icon: Github, name: "GitHub" },
  { icon: Slack, name: "Slack" },
  { icon: Figma, name: "Figma" },
  { icon: Mail, name: "Gmail" },
  { icon: Calendar, name: "Google Cal" },
  { icon: Cloud, name: "Drive" },
  { icon: Chrome, name: "Chrome" },
  { icon: Database, name: "Postgres" },
];

function FeaturesPage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Features"
        title="One workspace. Every feature you'd buy separately."
        subtitle="Projects, CRM, finance, meetings AI, agents, client portals, docs, RBAC and a Chrome companion — designed to feel like one product, not eight bolted together."
        primaryCta={{ label: "Get started free", to: "/signup" }}
        secondaryCta={{ label: "See pricing", to: "/pricing" }}
      />

      {/* Pillars */}
      <Section className="!py-14">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-aura-gradient text-primary-foreground shadow-pop">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold tracking-tight">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Visual product preview mock */}
      <Section className="!py-10">
        <SectionHeader
          eyebrow="The shape of it"
          title="A workspace built like a real product, not a wiki"
          subtitle="Aurora puts the work, the conversation and the context on the same screen — no app-switching to feel productive."
        />
        <div className="mx-auto mt-12 max-w-5xl">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
            {/* fake window chrome */}
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <div className="ml-4 flex-1 rounded-md border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                aurora.app/projects/halfmast-launch
              </div>
            </div>
            <div className="grid grid-cols-12 gap-0">
              {/* sidebar */}
              <aside className="col-span-3 hidden border-r border-border bg-muted/30 p-3 md:block">
                {["Inbox", "Projects", "CRM", "Finance", "Meetings", "Agents"].map((n, i) => (
                  <div
                    key={n}
                    className={`mb-1 rounded-md px-3 py-1.5 text-sm ${i === 1 ? "bg-aura-gradient text-primary-foreground shadow-pop" : "text-muted-foreground"}`}
                  >
                    {n}
                  </div>
                ))}
                <div className="mt-6 px-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Projects
                </div>
                {["Halfmast launch", "Q3 platform", "Onboarding v2"].map((n, i) => (
                  <div key={n} className={`mt-1 rounded-md px-3 py-1.5 text-sm ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                    {n}
                  </div>
                ))}
              </aside>
              {/* main */}
              <div className="col-span-12 p-6 md:col-span-9">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Project</div>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight">Halfmast launch</h3>
                  </div>
                  <div className="flex gap-1.5">
                    {["Table", "Board", "Timeline"].map((v, i) => (
                      <span key={v} className={`rounded-md border border-border px-2.5 py-1 text-xs ${i === 1 ? "bg-foreground text-background" : "text-muted-foreground"}`}>
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {["Backlog", "In progress", "Review"].map((col) => (
                    <div key={col} className="rounded-lg border border-border bg-background/40 p-3">
                      <div className="mb-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        <span>{col}</span>
                        <span>{col === "In progress" ? 5 : col === "Backlog" ? 12 : 3}</span>
                      </div>
                      {(col === "In progress"
                        ? ["Pricing teardown", "Brand audit", "AI status report"]
                        : col === "Backlog"
                          ? ["Migrate from Notion", "Q3 OKRs"]
                          : ["Landing v2 copy"]
                      ).map((t, ti) => (
                        <div key={t} className="mb-2 rounded-md border border-border bg-card p-2.5 text-xs">
                          <div className="font-medium">{t}</div>
                          <div className="mt-1 flex items-center justify-between text-muted-foreground">
                            <span>HM-{100 + ti * 17 + col.length}</span>
                            <span className="h-4 w-4 rounded-full bg-aura-gradient" />
                          </div>
                        </div>
                      ))}

                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Modules grid (linked deep dives) */}
      <Section className="!py-16">
        <SectionHeader
          eyebrow="Modules"
          title="Every module gets its own deep dive"
          subtitle="Tap any card for a full feature walkthrough."
        />
        <div className="mt-12">
          <FeatureGrid items={FEATURES} columns={3} />
        </div>
      </Section>

      {/* Chrome extension callout */}
      <Section className="!py-16">
        <SplitSection
          left={
            <div>
              <SectionHeader
                align="left"
                eyebrow="Aurora everywhere"
                title="The Chrome extension"
                subtitle="Capture tasks, screenshots and selections from any tab. Run AI agents on what you're reading. Search your workspace from the URL bar."
              />
              <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {["Quick capture", "Omnibox search", "Context Lens", "New-tab dashboard", "⌘+Shift+A"].map((t) => (
                  <span key={t} className="rounded-full border border-border bg-card px-2.5 py-1">{t}</span>
                ))}
              </div>
              <Link
                to="/extension"
                className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-aura-gradient px-4 py-2 text-sm font-medium text-primary-foreground shadow-pop transition hover:opacity-90"
              >
                <Chrome className="h-4 w-4" /> Install the extension <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          }
          right={
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
              <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <div className="ml-3 flex flex-1 items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                  <Chrome className="h-3 w-3" /> aura ship pricing teardown
                </div>
              </div>
              <div className="p-5">
                <div className="rounded-lg border border-border bg-background/60 p-4">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Quick capture</div>
                  <div className="mt-2 text-sm font-medium">Ship pricing teardown to Halfmast launch</div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="rounded-md border border-border bg-card px-2 py-0.5 text-muted-foreground">#halfmast-launch</span>
                    <span className="rounded-md border border-border bg-card px-2 py-0.5 text-muted-foreground">@maya</span>
                    <span className="rounded-md border border-border bg-card px-2 py-0.5 text-muted-foreground">due fri</span>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <span className="rounded-md bg-aura-gradient px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-pop">
                      Capture ⌘↵
                    </span>
                  </div>
                </div>
              </div>
            </div>
          }
        />
      </Section>

      {/* Integrations */}
      <section className="border-y border-border bg-muted/30 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeader eyebrow="Integrations" title="Plays nicely with your stack" />
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-4 gap-3 md:grid-cols-8">
            {INTEGRATIONS.map((i) => (
              <div key={i.name} className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center">
                <i.icon className="h-5 w-5 text-foreground" />
                <span className="text-[11px] text-muted-foreground">{i.name}</span>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-xl text-center text-sm text-muted-foreground">
            Plus webhooks, Zapier, and a public REST + GraphQL API. Build what we haven't.
          </p>
        </div>
      </section>

      {/* Stats */}
      <Section className="!py-14">
        <StatRow stats={[
          { value: "<200ms", label: "Median page load" },
          { value: "99.98%", label: "Uptime, trailing 90d" },
          { value: "SOC 2", label: "Type II compliant" },
          { value: "60+", label: "Native integrations" },
        ]} />
      </Section>

      {/* AI + bring your own key */}
      <Section className="!py-14">
        <SplitSection
          left={
            <SectionHeader
              align="left"
              eyebrow="AI that respects your stack"
              title="Bring your own model. Pay providers directly."
              subtitle="Aurora routes through OpenRouter so you can pin Claude, GPT, Gemini, Llama — per agent, per workspace. No AI seat tax."
            />
          }
          right={
            <BulletList items={[
              "Per-agent model pinning and prompts",
              "Token usage and cost dashboards",
              "Region-aware routing for EU customers",
              "Self-host the agent runtime if you need to",
              "Zero training on your data — ever",
            ]} />
          }
        />
      </Section>

      {/* FAQ */}
      <Section className="!py-14">
        <SectionHeader title="Frequently asked" />
        <div className="mt-10">
          <FAQ items={[
            { q: "Is there really no per-seat tax for guests?", a: "Read-only guests are free. Active client collaborators are billed at a low guest rate." },
            { q: "Can I self-host?", a: "Yes — the open-source edition is on GitHub and ships with a one-command Docker deploy." },
            { q: "How does the AI billing work?", a: "Aurora is free of AI markup. You connect your OpenRouter key and pay the model provider directly." },
            { q: "Will it import from Notion / Jira / HubSpot?", a: "Yes — one-click importers preserve structure, comments, and attachments." },
            { q: "Is there a mobile app?", a: "iOS and Android apps cover inbox, approvals, time tracking and meeting capture." },
          ]} />
        </div>
      </Section>

      <CTABand
        title="See it all in one place"
        subtitle="Spin up a workspace in 60 seconds — no credit card required."
        primaryCta={{ label: "Start free", to: "/signup" }}
        secondaryCta={{ label: "Talk to us", to: "/contact" }}
      />
    </MarketingPage>
  );
}
