import { createFileRoute, Link } from "@tanstack/react-router";
import { NavAccessGuard } from "@/components/app/NavAccessGuard";
import { useState } from "react";
import { useFinanceForecast } from "@/hooks/use-finance-forecast";
import { formatMoney } from "@/lib/financial-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarRange, Loader2, TrendingUp, Wallet, AlertTriangle, DollarSign, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/forecast")({
  component: () => <NavAccessGuard navKey="finance"><ForecastPage /></NavAccessGuard>,
});

function ForecastPage() {
  const [horizon, setHorizon] = useState(8);
  const { data, isLoading } = useFinanceForecast(horizon);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const hasAny = !!data && data.weeks.some((w) => w.bookedHours > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Workspace</div>
            <h1 className="flex items-center gap-2 text-lg font-semibold lg:text-xl">
              <TrendingUp className="h-5 w-5" /> Forecast
            </h1>
          </div>
          <Select value={String(horizon)} onValueChange={(v) => setHorizon(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="4">Next 4 weeks</SelectItem>
              <SelectItem value="8">Next 8 weeks</SelectItem>
              <SelectItem value="13">Next quarter</SelectItem>
              <SelectItem value="26">Next 6 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/finance">Back to Finance</Link>
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
        {!data || !hasAny ? (
          <EmptyState
            icon={CalendarRange}
            title="No allocations to forecast"
            description="Assign team members and resources to projects with bill rates to see projected revenue, cost, and utilization for upcoming weeks."
            primaryAction={{ label: "Plan capacity", to: "/app/resources/capacity" }}
            secondaryAction={{ label: "Manage resources", to: "/app/resources" }}
          />
        ) : (
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Totals */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi icon={Wallet} label="Projected revenue" value={formatMoney(data.totals.forecastRevenue, data.currency)} sub={`${horizon} weeks`} />
              <Kpi icon={DollarSign} label="Projected cost" value={formatMoney(data.totals.forecastCost, data.currency)} />
              <Kpi icon={TrendingUp} label="Projected margin" value={formatMoney(data.totals.projectedMargin, data.currency)} sub={`${data.totals.forecastRevenue > 0 ? ((data.totals.projectedMargin / data.totals.forecastRevenue) * 100).toFixed(0) : 0}%`} tone={data.totals.projectedMargin >= 0 ? "ok" : "warn"} />
              <Kpi icon={AlertTriangle} label="Utilization" value={`${data.totals.utilizationPct.toFixed(0)}%`} sub={`${data.totals.bookedHours.toFixed(0)} / ${data.totals.capacityHours.toFixed(0)} h`} tone={data.totals.utilizationPct > 100 ? "warn" : "neutral"} />
            </div>

            {/* Weekly breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Weekly outlook</CardTitle>
                <CardDescription>Booked vs capacity, projected revenue and margin per week</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead>
                      <tr className="border-y border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="p-2 pl-4 text-left">Week of</th>
                        <th className="p-2 text-left">Utilization</th>
                        <th className="p-2 text-right">Hours</th>
                        <th className="p-2 text-right">Revenue</th>
                        <th className="p-2 text-right">Cost</th>
                        <th className="p-2 pr-4 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.weeks.map((w) => (
                        <tr key={w.weekStart} className="border-b border-border last:border-0">
                          <td className="p-2 pl-4 font-medium">{w.label}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(100, w.utilizationPct)} className="h-1.5 w-24" />
                              <span className={cn(
                                "text-xs tabular-nums",
                                w.utilizationPct > 100 ? "text-red-500" :
                                w.utilizationPct > 90 ? "text-amber-500" :
                                w.utilizationPct < 40 ? "text-muted-foreground" : "text-foreground",
                              )}>
                                {w.utilizationPct.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="p-2 text-right tabular-nums">{w.bookedHours.toFixed(0)}h</td>
                          <td className="p-2 text-right tabular-nums">{formatMoney(w.forecastRevenue, data.currency)}</td>
                          <td className="p-2 text-right tabular-nums text-muted-foreground">{formatMoney(w.forecastCost, data.currency)}</td>
                          <td className={cn(
                            "p-2 pr-4 text-right font-medium tabular-nums",
                            w.projectedMargin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                          )}>
                            {formatMoney(w.projectedMargin, data.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Per-project pipeline (first 4 weeks) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Project pipeline</CardTitle>
                <CardDescription>Where forecasted hours are going (next 4 weeks)</CardDescription>
              </CardHeader>
              <CardContent>
                <ProjectPipeline weeks={data.weeks.slice(0, 4)} currency={data.currency} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectPipeline({ weeks, currency }: { weeks: { perProject: { project_id: string; project_name: string; hours: number; revenue: number; cost: number }[] }[]; currency: string }) {
  const agg = new Map<string, { name: string; hours: number; revenue: number; cost: number }>();
  for (const w of weeks) {
    for (const p of w.perProject) {
      const cur = agg.get(p.project_id) ?? { name: p.project_name, hours: 0, revenue: 0, cost: 0 };
      cur.hours += p.hours; cur.revenue += p.revenue; cur.cost += p.cost;
      agg.set(p.project_id, cur);
    }
  }
  const rows = Array.from(agg.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
  const maxRev = Math.max(1, ...rows.map(([, v]) => v.revenue));

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No allocations in the next 4 weeks.</p>;
  }

  return (
    <div className="space-y-2.5">
      {rows.map(([pid, v]) => {
        const margin = v.revenue - v.cost;
        return (
          <Link key={pid} to="/app/p/$projectId/financials" params={{ projectId: pid }}
            className="flex items-center gap-3 rounded-md border border-border p-2.5 transition hover:bg-muted/40">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{v.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{v.hours.toFixed(0)}h</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${(v.revenue / maxRev) * 100}%` }} />
              </div>
            </div>
            <div className="text-right text-xs tabular-nums">
              <div className="font-medium">{formatMoney(v.revenue, currency)}</div>
              <div className={cn(margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {formatMoney(margin, currency)} margin
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        );
      })}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone = "neutral" }: {
  icon: typeof Wallet; label: string; value: string; sub?: string;
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
        )}>{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
