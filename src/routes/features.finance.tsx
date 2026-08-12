import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, BulletList, FAQ, CTABand, SplitSection, FeatureGrid, Quote, StatRow } from "@/components/marketing/MarketingPage";
import { DollarSign, Receipt, Wallet, LineChart, FileCheck2, Repeat, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/features/finance")({
  head: () => ({
    meta: [
      { title: "Finance: invoices, expenses & margin — Aurora features" },
      { name: "description", content: "Invoices, expenses, budgets and live project margin — built into Aurora. No syncing to a separate billing tool." },
      { property: "og:title", content: "Aurora — finance & billing" },
      { property: "og:description", content: "From signed deal to invoice to revenue, on one platform." },
    ],
  }),
  component: Page,
});

const ROWS = [
  { id: "INV-1042", client: "Northwind Co.", status: "Paid", due: "Aug 12", amount: "$24,500", tone: "text-emerald-500 bg-emerald-500/10" },
  { id: "INV-1043", client: "Halcyon Labs", status: "Sent", due: "Sep 02", amount: "$18,200", tone: "text-indigo-500 bg-indigo-500/10" },
  { id: "INV-1044", client: "Lumen Studios", status: "Overdue", due: "Aug 18", amount: "$9,750", tone: "text-red-500 bg-red-500/10" },
  { id: "INV-1045", client: "Atlas Group", status: "Draft", due: "Sep 12", amount: "$42,000", tone: "text-amber-500 bg-amber-500/10" },
];

function FinanceMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 text-xs font-medium text-muted-foreground">aurora · finance · August</span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">MTD $94,450</span>
      </div>
      <div className="grid grid-cols-4 gap-3 border-b border-border bg-background/40 p-4">
        {[
          { label: "Invoiced", value: "$94.4k", trend: "+12%" },
          { label: "Collected", value: "$71.2k", trend: "+8%" },
          { label: "Outstanding", value: "$23.2k", trend: "−4%" },
          { label: "Margin", value: "38%", trend: "+3pp" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{s.value}</div>
            <div className="text-[10px] text-emerald-500">{s.trend}</div>
          </div>
        ))}
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Recent invoices</div>
          <span className="text-[10px] text-muted-foreground">4 of 28</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          {ROWS.map((r, i) => (
            <div key={r.id} className={`grid grid-cols-[110px_1fr_90px_90px_100px] items-center gap-2 px-3 py-2.5 text-xs ${i % 2 === 0 ? "bg-background/40" : ""}`}>
              <span className="font-mono text-[10px] text-muted-foreground">{r.id}</span>
              <span className="truncate font-medium">{r.client}</span>
              <span className={`inline-flex justify-center rounded-full px-2 py-0.5 text-[10px] font-medium ${r.tone}`}>{r.status}</span>
              <span className="text-muted-foreground">{r.due}</span>
              <span className="text-right font-semibold tabular-nums">{r.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Feature deep dive"
        title="Money where the work lives"
        subtitle="Aurora's finance layer turns every project into a P&L. Time, expenses and milestones flow into invoices and revenue without re-keying."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "See pricing", to: "/pricing" }}
      />
      <Section className="!py-12">
        <FinanceMockup />
      </Section>
      <Section className="!pt-0">
        <StatRow stats={[
          { value: "$120M", label: "invoiced through Aurora" },
          { value: "−14d", label: "average DSO" },
          { value: "+6pp", label: "margin visibility" },
          { value: "0", label: "spreadsheets needed" },
        ]} />
      </Section>
      <Section>
        <SectionHeader eyebrow="What's inside" title="A finance layer, not a billing module" />
        <div className="mt-10">
          <FeatureGrid items={[
            { icon: Receipt, title: "Invoicing", description: "T&M, fixed-fee, retainer, milestone. Send, schedule, automate." },
            { icon: Wallet, title: "Expenses", description: "Capture, approve, reimburse. Tag to project for live margin." },
            { icon: DollarSign, title: "Budgets & WIP", description: "Planned vs actual margin on every project, every day." },
            { icon: LineChart, title: "Cash forecast", description: "Knows your pipeline, your invoices and your retainers." },
            { icon: FileCheck2, title: "Rev rec", description: "Recognize by milestone, percent complete or straight-line." },
            { icon: Repeat, title: "Retainers", description: "Track monthly draw-down, rollover and overage with zero spreadsheets." },
          ]} />
        </div>
      </Section>
      <Section className="!py-12">
        <SplitSection
          left={<SectionHeader align="left" eyebrow="Anatomy" title="One ledger from quote to cash" />}
          right={
            <BulletList items={[
              "Project budgets with planned vs actual margin",
              "Time entry that rolls into WIP and invoices",
              "Expenses with approval workflow",
              "T&M, fixed-fee, retainer and milestone billing",
              "Revenue recognition by milestone or accrual",
              "Cash forecast that knows your pipeline",
            ]} />
          }
        />
      </Section>
      <Section className="!py-12">
        <Quote
          quote="We cut DSO by two weeks because every milestone triggers the invoice automatically. Finance literally stopped chasing the PMs."
          author="Sofia Lin"
          role="CFO, Atlas Group"
        />
      </Section>
      <Section>
        <SectionHeader eyebrow="Pairs with" title="Connected to the rest of the stack" />
        <div className="mx-auto mt-8 grid max-w-3xl gap-3 md:grid-cols-3">
          {[
            { to: "/features/projects", title: "Projects" },
            { to: "/features/crm", title: "CRM" },
            { to: "/features/views", title: "Reporting views" },
          ].map((p) => (
            <Link key={p.to} to={p.to} className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-elegant">
              <span className="text-sm font-medium">{p.title}</span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
            </Link>
          ))}
        </div>
      </Section>
      <Section className="!py-12">
        <FAQ items={[
          { q: "Do you sync with our accounting tool?", a: "Yes — Xero and QuickBooks, with more on the way." },
          { q: "Can clients pay invoices in-app?", a: "Yes, via the optional Stripe integration." },
          { q: "What about multi-entity?", a: "Each workspace can map to a legal entity; consolidated reporting at the org level." },
          { q: "How is margin calculated?", a: "Time × cost rate + expenses, compared against budget and billed revenue, recomputed every time an entry lands." },
        ]} />
      </Section>
      <CTABand title="Stop reconciling spreadsheets" />
    </MarketingPage>
  );
}
