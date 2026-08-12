import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, CTABand } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "Changelog — what's new in Aurora" },
      { name: "description", content: "Recent shipped features, fixes and improvements in Aurora." },
      { property: "og:title", content: "Aurora changelog" },
      { property: "og:description", content: "What we shipped this week." },
    ],
  }),
  component: Page,
});

const ENTRIES = [
  {
    date: "May 21, 2026",
    tag: "New",
    title: "Aurora Agents — public beta",
    body: "Background AI workers that monitor your workspace and act with explicit guardrails. Start with status reports, invoice chasers and deal nudges.",
  },
  {
    date: "May 14, 2026",
    tag: "New",
    title: "Client portals 2.0",
    body: "Branded portals on your own domain, granular role-scoped views, SSO for client users, and a redesigned approvals flow.",
  },
  {
    date: "May 7, 2026",
    tag: "Improved",
    title: "Meetings AI — multi-language",
    body: "Added support for Spanish, French, German, Portuguese, Italian, Dutch and Japanese transcription and summaries.",
  },
  {
    date: "Apr 30, 2026",
    tag: "New",
    title: "RBAC — custom roles",
    body: "Define your own roles with field-level permissions. SCIM provisioning on enterprise plans.",
  },
  {
    date: "Apr 23, 2026",
    tag: "Improved",
    title: "Finance — Netsuite sync",
    body: "Two-way sync with Netsuite, joining our existing Xero and QuickBooks integrations.",
  },
];

function Page() {
  return (
    <MarketingPage>
      <PageHero eyebrow="Changelog" title="What we shipped" subtitle="Aurora is updated continuously. Here are the highlights." />
      <Section>
        <ol className="space-y-10">
          {ENTRIES.map((e) => (
            <li key={e.title} className="grid gap-6 border-b border-border pb-10 last:border-0 md:grid-cols-[180px,1fr]">
              <div className="text-sm">
                <div className="font-mono text-muted-foreground">{e.date}</div>
                <span className="mt-2 inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {e.tag}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">{e.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <CTABand title="Want the changelog by email?" subtitle="Monthly digest, no marketing fluff." secondaryCta={{ label: "Contact us", to: "/contact" }} />
    </MarketingPage>
  );
}
