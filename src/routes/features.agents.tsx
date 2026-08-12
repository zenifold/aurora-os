import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, FeatureGrid, FAQ, CTABand } from "@/components/marketing/MarketingPage";
import { Bot, AlarmClock, Workflow, Eye, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/features/agents")({
  head: () => ({
    meta: [
      { title: "Aurora Agents — background AI workers | Aurora" },
      { name: "description", content: "Aurora Agents watch your data, run on triggers and act with explicit guardrails — from project status updates to invoice reminders." },
      { property: "og:title", content: "Aurora Agents" },
      { property: "og:description", content: "AI that actually works for you." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Feature deep dive"
        title="AI that does the work, not just the talking"
        subtitle="Background agents that monitor your workspace and act — drafting status reports, nudging stuck deals, flagging margin slippage, chasing overdue invoices."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "See all features", to: "/features" }}
      />
      <Section>
        <SectionHeader eyebrow="What agents do" title="Always-on workers you actually trust" subtitle="Every action is logged, reversible and scoped to permissions." />
        <div className="mt-10">
          <FeatureGrid items={[
            { icon: Workflow, title: "Status reports", description: "Drafts a weekly status email per project, ready for review." },
            { icon: AlarmClock, title: "Invoice chasers", description: "Polite, branded reminders on the cadence you set." },
            { icon: Eye, title: "Margin watchers", description: "Pings the PM when burn outpaces budget." },
            { icon: Bot, title: "Deal nudges", description: "Surfaces deals gone cold with suggested next steps." },
            { icon: Sparkles, title: "Meeting prep", description: "Briefs you before every call with relevant context." },
            { icon: ShieldCheck, title: "Guardrails", description: "Approval-required, dry-run and full audit log on every action." },
          ]} />
        </div>
      </Section>
      <Section className="!py-12">
        <FAQ items={[
          { q: "Are actions reversible?", a: "Yes. Every agent action is logged with a one-click undo for 30 days." },
          { q: "Can I require approval?", a: "Per agent and per action type. Default to dry-run if you prefer." },
          { q: "What model is used?", a: "Aurora picks the right model per task. You can pin a model per agent." },
        ]} />
      </Section>
      <CTABand title="Hire your first AI teammate" />
    </MarketingPage>
  );
}
