import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useDeliverySnapshot, type DeliveryProjectStats } from "@/hooks/use-delivery";
import { PROJECT_HEALTH, CONTRACT_TYPES, PROJECT_PHASES } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  TrendingUp,
  Users,
  DollarSign,
  ChevronRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/delivery")({
  component: DeliveryPage,
});

const PHASE_ORDER: ProjectPhase[] = PROJECT_PHASES.map((p) => p.value).filter(
  (p) => p !== "on_hold",
);

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function DeliveryPage() {
  const { data, isLoading } = useDeliverySnapshot();
  const [filter, setFilter] = useState<"all" | "attention" | "on_track">("all");

  const filteredStats = useMemo(() => {
    if (!data) return [];
    if (filter === "attention") {
      return data.stats.filter(
        (s) =>
          s.project.health === "at_risk" ||
          s.project.health === "critical" ||
          s.alerts.length > 0,
      );
    }
    if (filter === "on_track") {
      return data.stats.filter((s) => s.project.health === "on_track");
    }
    return data.stats;
  }, [data, filter]);

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading delivery snapshot…
      </div>
    );
  }

  const { kpis, alerts } = data;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="bg-aura-gradient bg-clip-text text-2xl font-semibold text-transparent">
            Delivery
          </h1>
          <p className="text-sm text-muted-foreground">
            Client project oversight · {kpis.activeCount} active engagements
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
          {(["all", "attention", "on_track"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded px-2.5 py-1 capitalize transition",
                filter === f ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {f === "attention" ? "Needs attention" : f === "on_track" ? "On track" : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          accent="from-blue-500 to-cyan-400"
          label="Active projects"
          value={kpis.activeCount.toString()}
          sub={`${fmt$(kpis.totalContract)} contract value`}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          accent="from-rose-500 to-orange-400"
          label="At risk"
          value={kpis.atRiskCount.toString()}
          sub={kpis.atRiskNames.slice(0, 2).join(", ") || "All clear"}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="from-emerald-500 to-teal-400"
          label="On-time delivery"
          value={`${kpis.onTimePct}%`}
          sub={`${kpis.deliverablesApproved} approved`}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          accent="from-violet-500 to-fuchsia-400"
          label="Pending action"
          value={kpis.deliverablesNeedingAction.toString()}
          sub={`${kpis.deliverablesReviewing} in review`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Project cards */}
        <div className="space-y-3">
          {filteredStats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No client projects yet. Mark a project as a client engagement in
              its settings to see it here.
            </div>
          ) : (
            filteredStats.map((s) => <ProjectCard key={s.project.id} stats={s} />)
          )}
        </div>

        {/* Alert feed */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Live alerts
              {alerts.length > 0 && (
                <Badge variant="secondary" className="ml-auto h-5 text-[10px]">
                  {alerts.length}
                </Badge>
              )}
            </h3>
            {alerts.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                All quiet on the delivery front.
              </p>
            ) : (
              <ul className="space-y-2">
                {alerts.slice(0, 12).map((a) => (
                  <li
                    key={a.id}
                    className={cn(
                      "rounded-md border p-2.5 text-xs",
                      a.level === "critical" && "border-destructive/40 bg-destructive/5",
                      a.level === "warning" && "border-amber-500/40 bg-amber-500/5",
                      a.level === "info" && "border-border bg-muted/30",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{a.projectName}</span>
                      <span className="text-muted-foreground">·</span>
                      <span>{a.title}</span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">{a.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-primary" />
              Client deliverables
            </h3>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Needs action" value={kpis.deliverablesNeedingAction} />
              <Stat label="Reviewing" value={kpis.deliverablesReviewing} />
              <Stat label="Approved" value={kpis.deliverablesApproved} />
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Portfolio health
            </h3>
            <div className="space-y-1.5 text-xs">
              {(["on_track", "at_risk", "critical", "on_hold"] as const).map((h) => {
                const count = data.stats.filter((s) => (s.project.health ?? "on_track") === h).length;
                const meta = PROJECT_HEALTH[h];
                return (
                  <div key={h} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      {meta.label}
                    </span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  accent,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  accent: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", accent)} />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/30 px-2 py-2">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ProjectCard({ stats }: { stats: DeliveryProjectStats }) {
  const { project: p } = stats;
  const health = PROJECT_HEALTH[p.health ?? "on_track"];
  const phaseIdx = p.phase ? PHASE_ORDER.indexOf(p.phase) : -1;
  const burn = Math.min(100, Math.round(stats.burnPct));
  const marginBelow =
    stats.marginPct !== null &&
    stats.targetMarginPct !== null &&
    stats.marginPct < stats.targetMarginPct;

  return (
    <Link
      to="/app/p/$projectId"
      params={{ projectId: p.id }}
      className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: p.color }}
        >
          {(p.client_name ?? p.name).slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{p.name}</h3>
            <Badge
              variant="outline"
              className="gap-1 text-[10px]"
              style={{ borderColor: health.color, color: health.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: health.color }} />
              {health.label}
            </Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {p.client_name && <span>{p.client_name}</span>}
            {stats.contractValue > 0 && <span>· {fmt$(stats.contractValue)}</span>}
            {p.contract_type && <span>· {CONTRACT_TYPES[p.contract_type]}</span>}
            {p.phase && (
              <span>
                · {PROJECT_PHASES.find((x) => x.value === p.phase)?.label}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      {/* Phase strip */}
      {phaseIdx >= 0 && (
        <div className="mt-3 grid grid-cols-6 gap-1">
          {PHASE_ORDER.map((ph, i) => (
            <div
              key={ph}
              className={cn(
                "h-1.5 rounded-full",
                i < phaseIdx
                  ? "bg-primary"
                  : i === phaseIdx
                  ? "bg-aura-gradient"
                  : "bg-muted",
              )}
              title={PROJECT_PHASES.find((x) => x.value === ph)?.label}
            />
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium tabular-nums">{stats.progressPct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-aura-gradient transition-all"
              style={{ width: `${stats.progressPct}%` }}
            />
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {stats.taskDone} / {stats.taskTotal} tasks
          </p>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-muted-foreground">Budget burn</span>
            <span className="font-medium tabular-nums">{burn}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all",
                burn > 90 ? "bg-destructive" : burn > 70 ? "bg-amber-500" : "bg-emerald-500",
              )}
              style={{ width: `${burn}%` }}
            />
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {stats.marginPct !== null ? (
              <span className={marginBelow ? "text-amber-600 dark:text-amber-400" : ""}>
                Margin {stats.marginPct.toFixed(0)}%
                {stats.targetMarginPct !== null && ` (target ${stats.targetMarginPct}%)`}
              </span>
            ) : (
              "No time logs yet"
            )}
          </p>
        </div>
      </div>

      {(stats.pendingDeliverables.length > 0 || stats.alerts.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
          {stats.overdueDeliverables.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {stats.overdueDeliverables.length} overdue
            </Badge>
          )}
          {stats.pendingDeliverables.length > 0 && (
            <Badge variant="secondary">
              {stats.pendingDeliverables.length} pending deliverable
              {stats.pendingDeliverables.length === 1 ? "" : "s"}
            </Badge>
          )}
          {stats.alerts.filter((a) => a.level === "warning").length > 0 && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
              {stats.alerts.filter((a) => a.level === "warning").length} warning
            </Badge>
          )}
        </div>
      )}
    </Link>
  );
}

export default DeliveryPage;
export { Button };
