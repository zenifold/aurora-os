import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  TrendingUp,
  Trophy,
  AlertTriangle,
  DollarSign,
  Filter,
  ArrowRight,
  Timer,
} from "lucide-react";
import { usePipelineAnalytics } from "@/hooks/use-pipeline-analytics";
import { formatDealValue } from "@/lib/crm-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/pipeline-analytics")({
  component: PipelineAnalyticsPage,
});

const STALE_OPTIONS = [7, 14, 30, 60];

function PipelineAnalyticsPage() {
  const [staleDays, setStaleDays] = useState(14);
  const a = usePipelineAnalytics(staleDays);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="bg-aura-gradient bg-clip-text text-2xl font-semibold text-transparent">
            Pipeline analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Weighted forecast, win rates, loss reasons, and follow-up health across your pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/app/clients">
            <Button variant="outline" size="sm" className="gap-2">
              Open pipeline <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* KPI cards */}
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={DollarSign} label="Open pipeline" value={formatDealValue(a.kpis.openValue)} hint={`${a.kpis.openCount} deals`} />
        <Kpi icon={TrendingUp} label="Weighted forecast" value={formatDealValue(a.kpis.weightedPipeline)} hint="probability adjusted" />
        <Kpi icon={Trophy} label="Win rate" value={`${Math.round(a.kpis.winRate * 100)}%`} hint={`${a.kpis.wonCount} won / ${a.kpis.lostCount} lost`} />
        <Kpi icon={Timer} label="Avg cycle" value={`${Math.round(a.kpis.avgCycleDays)}d`} hint={`Avg won ${formatDealValue(a.kpis.avgDealSize)}`} />
      </section>

      {/* Forecast + Funnel */}
      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <LineChart className="h-4 w-4" /> 6-month forecast
            </h2>
            <span className="text-xs text-muted-foreground">Open + weighted vs. won by month</span>
          </header>
          {a.forecast.length === 0 ? (
            <Empty>No forecast yet.</Empty>
          ) : (
            <div className="space-y-2">
              {a.forecast.map((m) => {
                const max = Math.max(1, ...a.forecast.map((x) => Math.max(x.open, x.won)));
                return (
                  <div key={m.monthKey} className="grid grid-cols-[60px_1fr_auto] items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
                    <div className="space-y-1">
                      <div className="flex h-2 w-full overflow-hidden rounded bg-muted">
                        <div className="h-full bg-primary/70" style={{ width: `${(m.open / max) * 100}%` }} />
                      </div>
                      <div className="flex h-2 w-full overflow-hidden rounded bg-muted">
                        <div className="h-full bg-emerald-500" style={{ width: `${(m.won / max) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-right text-[11px] tabular-nums">
                      <div>{formatDealValue(m.weighted)}</div>
                      <div className="text-emerald-600 dark:text-emerald-400">{formatDealValue(m.won)}</div>
                    </div>
                  </div>
                );
              })}
              <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
                <Legend color="bg-primary/70" label="Open" />
                <Legend color="bg-emerald-500" label="Won" />
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Filter className="h-4 w-4" /> Stage funnel
            </h2>
            <span className="text-xs text-muted-foreground">Open deals by stage</span>
          </header>
          {a.funnel.length === 0 ? (
            <Empty>No open deals.</Empty>
          ) : (
            <div className="space-y-2">
              {a.funnel.map((row) => {
                const max = Math.max(1, ...a.funnel.map((x) => x.value));
                return (
                  <div key={row.stage.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: row.stage.color }}
                        />
                        <span className="font-medium">{row.stage.name}</span>
                        <span className="text-muted-foreground">· {row.count}</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatDealValue(row.value)} · w {formatDealValue(row.weighted)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-muted">
                      <div
                        className="h-full"
                        style={{
                          width: `${(row.value / max) * 100}%`,
                          background: row.stage.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      {/* Owners + Loss reasons */}
      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4" /> Owner leaderboard
          </h2>
          {a.owners.length === 0 ? (
            <Empty>No deal owners.</Empty>
          ) : (
            <ul className="space-y-2">
              {a.owners.slice(0, 8).map((o) => (
                <li
                  key={o.ownerId ?? "unassigned"}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 p-2"
                >
                  <Avatar className="h-8 w-8">
                    {o.avatarUrl && <AvatarImage src={o.avatarUrl} />}
                    <AvatarFallback className="text-[10px]">
                      {o.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{o.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Open {formatDealValue(o.openValue)} · Weighted {formatDealValue(o.weighted)}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-semibold">{formatDealValue(o.wonValue)}</div>
                    <div className="text-muted-foreground">{Math.round(o.winRate * 100)}% win</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" /> Loss reasons
          </h2>
          {a.lossReasons.length === 0 ? (
            <Empty>No closed-lost deals yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {a.lossReasons.map((r) => {
                const total = a.lossReasons.reduce((s, x) => s + x.count, 0);
                const pct = total === 0 ? 0 : (r.count / total) * 100;
                return (
                  <li key={r.reason}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{r.reason}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {r.count} · {formatDealValue(r.value)}
                      </span>
                    </div>
                    <Progress value={pct} className="mt-1 h-1.5" />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* Sources + Stale */}
      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4" /> Sources
          </h2>
          {a.sources.length === 0 ? (
            <Empty>No source data.</Empty>
          ) : (
            <div className="divide-y divide-border/60">
              {a.sources.slice(0, 8).map((s) => (
                <div key={s.source} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium capitalize">{s.source}</span>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{s.count} deals</span>
                    <span className="tabular-nums">{formatDealValue(s.value)}</span>
                    <Badge variant="outline">{Math.round(s.winRate * 100)}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Timer className="h-4 w-4" /> Stale deals
            </h2>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Idle ≥</span>
              {STALE_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setStaleDays(d)}
                  className={cn(
                    "rounded px-1.5 py-0.5",
                    d === staleDays ? "bg-primary/15 text-primary" : "hover:bg-muted",
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          </header>
          {a.stale.length === 0 ? (
            <Empty>No deals are stale 🎉</Empty>
          ) : (
            <ul className="space-y-1.5">
              {a.stale.map(({ deal, daysSinceUpdate }) => {
                const stage = a.stageById.get(deal.stage_id);
                return (
                  <li
                    key={deal.id}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 p-2 text-sm"
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: stage?.color ?? "#94a3b8" }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{deal.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {stage?.name ?? "—"}
                    </Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatDealValue(deal.value, deal.currency)}
                    </span>
                    <Badge variant="destructive" className="text-[10px]">
                      {daysSinceUpdate}d
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("h-2 w-3 rounded", color)} /> {label}
    </span>
  );
}
