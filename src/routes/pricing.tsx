import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter, GITHUB_URL } from "@/components/marketing/MarketingChrome";
import { Button } from "@/components/ui/button";
import { Check, Github, Heart, Sparkles, Server, Cloud } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Aura. Free forever, open source." },
      {
        name: "description",
        content:
          "Aura is MIT-licensed and free to self-host forever. Hosted plans cover the cost of running it for you — no per-seat AI markup.",
      },
      { property: "og:title", content: "Aura — pricing that respects you" },
      {
        property: "og:description",
        content: "Self-host free. Hosted from $5/user. AI is BYO OpenRouter — pay providers directly.",
      },
    ],
  }),
  component: PricingPage,
});

interface Tier {
  name: string;
  price: string;
  cadence?: string;
  desc: string;
  features: string[];
  cta: string;
  ctaTo?: "/signup" | "/login";
  ctaHref?: string;
  popular?: boolean;
  icon: typeof Server;
}

const TIERS: Tier[] = [
  {
    name: "Self-hosted",
    price: "$0",
    cadence: "forever",
    desc: "Clone the repo, deploy anywhere, own everything. MIT licensed.",
    features: [
      "Every feature, no gates",
      "Unlimited workspaces & users",
      "Your database, your data",
      "Bring your own OpenRouter key",
      "Community support on GitHub",
    ],
    cta: "Get the source",
    ctaHref: GITHUB_URL,
    icon: Server,
  },
  {
    name: "Hosted Personal",
    price: "$5",
    cadence: "/ user / mo",
    desc: "Hassle-free hosted Aura for solo work and small projects.",
    features: [
      "Unlimited projects",
      "1 workspace, 1 user",
      "All views & workflows",
      "Bring your OpenRouter key for AI",
      "Email support",
    ],
    cta: "Start free trial",
    ctaTo: "/signup",
    icon: Cloud,
    popular: true,
  },
  {
    name: "Hosted Team",
    price: "$8",
    cadence: "/ seat / mo",
    desc: "We run it, back it up, and scale it. You focus on work.",
    features: [
      "Unlimited projects & workspaces",
      "Roles, permissions, audit log",
      "Daily backups & 99.9% SLA",
      "Bring your OpenRouter key for AI",
      "Priority support",
    ],
    cta: "Start 14-day trial",
    ctaTo: "/signup",
    icon: Heart,
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="aura-mesh absolute inset-0 -z-10 opacity-40" />
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3" />
              No per-seat AI tax. Ever.
            </span>
            <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight md:text-6xl">
              Free to <span className="text-aura-gradient">self-host</span>.<br />
              Fair when you don't.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
              Aura is open source. The hosted plans only exist to pay for the servers — AI features
              run on your own OpenRouter key, so you pay providers directly at cost.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-stretch gap-6 md:grid-cols-3">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className={`relative flex flex-col rounded-2xl border bg-card p-6 transition hover:-translate-y-1 ${
                  t.popular
                    ? "border-transparent shadow-pop md:-translate-y-2"
                    : "border-border shadow-elegant"
                }`}
                style={
                  t.popular
                    ? {
                        backgroundImage:
                          "linear-gradient(var(--card), var(--card)), var(--gradient-aura)",
                        backgroundOrigin: "border-box",
                        backgroundClip: "padding-box, border-box",
                        borderWidth: "2px",
                        borderStyle: "solid",
                        borderColor: "transparent",
                      }
                    : undefined
                }
              >
                {t.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-aura-gradient px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow-pop">
                    Most popular
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-aura-gradient-subtle">
                    <t.icon className="h-4 w-4 text-aura-gradient" />
                  </div>
                  <h3 className="text-lg font-semibold">{t.name}</h3>
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{t.price}</span>
                  {t.cadence && <span className="text-sm text-muted-foreground">{t.cadence}</span>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
                <ul className="mt-6 flex-1 space-y-2">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-aura-gradient" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {t.ctaTo ? (
                    <Button
                      asChild
                      className={
                        t.popular
                          ? "w-full bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
                          : "w-full"
                      }
                      variant={t.popular ? "default" : "outline"}
                    >
                      <Link to={t.ctaTo}>{t.cta}</Link>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="w-full">
                      <a href={t.ctaHref} target="_blank" rel="noreferrer">
                        <Github className="mr-1.5 h-4 w-4" /> {t.cta}
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-20">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-center text-balance text-3xl font-bold tracking-tight md:text-4xl">
              FAQ
            </h2>
            <div className="mt-10 space-y-6">
              {[
                {
                  q: "Why is it open source?",
                  a: "Productivity software has gotten absurdly expensive and most teams use 10% of what they pay for. We'd rather build a tool people own than rent them software at $20/seat/month.",
                },
                {
                  q: "How does AI work without an API key from you?",
                  a: "Aura talks to OpenRouter — you create an account, top up $5, paste the key into Settings → AI. We never see or store the key on the server beyond your own workspace, and you pay OpenRouter at provider cost.",
                },
                {
                  q: "Can I migrate off the hosted version later?",
                  a: "Yes. Export your data anytime, then run the same codebase yourself. There's no vendor lock-in by design.",
                },
                {
                  q: "What's in the Team plan that isn't free?",
                  a: "Nothing functional — same code, same features. You're paying for managed hosting, backups, uptime SLA, and priority support.",
                },
                {
                  q: "Is there a Business / Enterprise plan?",
                  a: "Not yet. If you need SSO, custom contracts, or on-prem deployment, open an issue on GitHub and we'll talk.",
                },
              ].map((f) => (
                <div key={f.q} className="rounded-xl border border-border bg-card p-5">
                  <h3 className="font-semibold">{f.q}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
