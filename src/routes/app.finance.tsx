import { createFileRoute, Link } from "@tanstack/react-router";
import { NavAccessGuard } from "@/components/app/NavAccessGuard";
import { useMemo, useState } from "react";
import { usePortfolioFinance, type ProjectRollup } from "@/hooks/use-portfolio-finance";
import { formatMoney } from "@/lib/financial-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, DollarSign, Loader2, Receipt, Search, TrendingUp, Wallet, AlertTriangle, Clock } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/finance")({
  component: () => <NavAccessGuard navKey="finance"><FinancePage /></NavAccessGuard>,
});

type SortKey = "name" | "contract" | "invoiced" | "outstanding" | "margin" | "burn" | "wip";

function FinancePage() {
  const { data, isLoading } = usePortfolioFinance();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("outstanding");

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const rows = data.rows.filter((r) =>
      query ? r.project.name.toLowerCase().includes(query.toLowerCase()) : true
    );
    const get = (r: ProjectRollup): number | string => {
      switch (sortBy) {
        case "name": return r.project.name.toLowerCase();
        case "contract": return r.contractValue;
        case "invoiced": return r.invoicedTotal;
        case "outstanding": return r.outstanding;
        case "margin": return r.marginPct;
        case "burn": return r.burnPct;
        case "wip": return r.wip;
      }
    };
    return [...rows].sort((a, b) => {
      const av = get(a); const bv = get(b);
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv);
      return (Number(bv) || 0) - (Number(av) || 0);
    });
  }, [data, query, sortBy]);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <Header />
        <div className="flex-1 p-6">
          <EmptyState
            icon={DollarSign}
            title="No financial data yet"
            description="Add contract values, log time, and create invoices on your projects to see portfolio-level revenue, margin, and AR aging here."
            primaryAction={{ label: "Open a project", to: "/app" }}
          />
        </div>
      </div>
    );
  }

  const { totals, aging, invoicesByStatus, currency } = data;
  const agingTotal = aging.current + aging.d0_30 + aging.d31_60 + aging.d61_90 + aging.d90_plus;

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Kpi icon={Wallet} label="Contract value" value={formatMoney(totals.contractValue, currency)} />
            <Kpi icon={Receipt} label="Invoiced" value={formatMoney(totals.invoiced, currency)} sub={`${formatMoney(totals.paid, currency)} paid`} />
            <Kpi icon={AlertTriangle} label="Outstanding" value={formatMoney(totals.outstanding, currency)} tone={totals.outstanding > 0 ? "warn" : "ok"} />
            <Kpi icon={Clock} label="WIP unbilled" value={formatMoney(totals.wip, currency)} sub={`${totals.billableHours.toFixed(0)}h billable`} />
            <Kpi icon={TrendingUp} label="Margin" value={formatMoney(totals.margin, currency)} sub={`${totals.marginPct.toFixed(0)}%`} tone={totals.margin >= 0 ? "ok" : "warn"} />
            <Kpi icon={DollarSign} label="Logged revenue" value={formatMoney(totals.loggedRevenue, currency)} sub={`cost ${formatMoney(totals.loggedCost, currency)}`} />
          </div>

          {/* AR aging + invoice status */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">AR aging</CardTitle>
                <CardDescription>Outstanding balance by days past due</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  <AgingCell label="Current" amount={aging.current} total={agingTotal} currency={currency} tone="ok" />
                  <AgingCell label="0–30" amount={aging.d0_30} total={agingTotal} currency={currency} tone="neutral" />
                  <AgingCell label="31–60" amount={aging.d31_60} total={agingTotal} currency={currency} tone="warn" />
                  <AgingCell label="61–90" amount={aging.d61_90} total={agingTotal} currency={currency} tone="warn" />
                  <AgingCell label="90+" amount={aging.d90_plus} total={agingTotal} currency={currency} tone="bad" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Invoices</CardTitle>
                <CardDescription>By status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <StatusRow label="Draft" count={invoicesByStatus.draft} />
                <StatusRow label="Sent" count={invoicesByStatus.sent} />
                <StatusRow label="Overdue" count={invoicesByStatus.overdue} tone="warn" />
                <StatusRow label="Paid" count={invoicesByStatus.paid} tone="ok" />
                <StatusRow label="Void" count={invoicesByStatus.void} tone="muted" />
              </CardContent>
            </Card>
          </div>

          {/* Per-project P&L table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <CardTitle className="text-base">Project P&L</CardTitle>
                  <CardDescription>Profitability, burn, and receivables by project</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects…" className="w-56 pl-8" />
                </div>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outstanding">Sort: Outstanding</SelectItem>
                    <SelectItem value="wip">Sort: WIP</SelectItem>
                    <SelectItem value="margin">Sort: Margin %</SelectItem>
                    <SelectItem value="burn">Sort: Burn %</SelectItem>
                    <SelectItem value="invoiced">Sort: Invoiced</SelectItem>
                    <SelectItem value="contract">Sort: Contract</SelectItem>
                    <SelectItem value="name">Sort: Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-y border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="p-2 pl-4 text-left">Project</th>
                      <th className="p-2 text-right">Contract</th>
                      <th className="p-2 text-right">Invoiced</th>
                      <th className="p-2 text-right">Outstanding</th>
                      <th className="p-2 text-right">WIP</th>
                      <th className="p-2 text-right">Margin</th>
                      <th className="p-2 text-left">Burn</th>
                      <th className="p-2 pr-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => (
                      <tr key={r.project.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="p-2 pl-4">
                          <Link to="/app/p/$projectId/financials" params={{ projectId: r.project.id }} className="font-medium hover:underline">
                            {r.project.name}
                          </Link>
                        </td>
                        <td className="p-2 text-right">{formatMoney(r.contractValue, r.currency)}</td>
                        <td className="p-2 text-right">{formatMoney(r.invoicedTotal, r.currency)}</td>
                        <td className="p-2 text-right">
                          <div>{formatMoney(r.outstanding, r.currency)}</div>
                          {r.overdueOutstanding > 0 && (
                            <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              {formatMoney(r.overdueOutstanding, r.currency)} overdue
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-right">{formatMoney(r.wip, r.currency)}</td>
                        <td className="p-2 text-right">
                          <div className={cn("font-medium", r.margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                            {formatMoney(r.margin, r.currency)}
                          </div>
                          {r.loggedRevenue > 0 && (
                            <div className="text-[10px] text-muted-foreground">{r.marginPct.toFixed(0)}%</div>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(100, r.burnPct)} className="h-1.5 w-20" />
                            <span className={cn("text-xs", r.burnPct > 90 ? "text-red-500" : r.burnPct > 75 ? "text-amber-500" : "text-muted-foreground")}>
                              {r.contractValue > 0 ? `${r.burnPct.toFixed(0)}%` : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 pr-4 text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to="/app/p/$projectId/financials" params={{ projectId: r.project.id }}>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Workspace</div>
          <h1 className="flex items-center gap-2 text-lg font-semibold lg:text-xl">
            <DollarSign className="h-5 w-5" /> Finance
          </h1>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/forecast"><TrendingUp className="mr-1.5 h-3.5 w-3.5" /> Forecast</Link>
        </Button>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone = "neutral" }: {
  icon: typeof DollarSign; label: string; value: string; sub?: string;
  tone?: "ok" | "warn" | "neutral";
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "ok" && "text-foreground",
        )}>{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function AgingCell({ label, amount, total, currency, tone }: {
  label: string; amount: number; total: number; currency: string;
  tone: "ok" | "neutral" | "warn" | "bad";
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  const toneClass = {
    ok: "bg-emerald-500/10 border-emerald-500/30",
    neutral: "bg-muted border-border",
    warn: "bg-amber-500/10 border-amber-500/30",
    bad: "bg-red-500/10 border-red-500/30",
  }[tone];
  return (
    <div className={cn("rounded-md border p-2.5", toneClass)}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{formatMoney(amount, currency)}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{pct.toFixed(0)}%</div>
    </div>
  );
}

function StatusRow({ label, count, tone }: { label: string; count: number; tone?: "ok" | "warn" | "muted" }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(
        "text-muted-foreground",
        tone === "warn" && "text-amber-600 dark:text-amber-400",
        tone === "ok" && "text-emerald-600 dark:text-emerald-400",
      )}>{label}</span>
      <Badge variant="outline" className="tabular-nums">{count}</Badge>
    </div>
  );
}
