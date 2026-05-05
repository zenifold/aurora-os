import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useDeliverySnapshot } from "@/hooks/use-delivery";
import { useDeals, useDealStages } from "@/hooks/use-crm";
import { useEscalations } from "@/hooks/use-escalations";
import { useProjects } from "@/hooks/use-projects";
import { Badge } from "@/components/ui/badge";
import { TIER_COLORS, TIER_LABELS } from "@/lib/escalation-types";
import {
  ArrowUpRight,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Users,
  Target,
} from "lucide-react";

export const Route = createFileRoute("/app/executive")({
  component: ExecutiveDashboard,
});

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function ExecutiveDashboard() {
  const { data: delivery } = useDeliverySnapshot();
  const { data: deals = [] } = useDeals();
  const { data: stages = [] } = useDealStages();
  const { data: projects = [] } = useProjects();
  const { data: openEscalations = [] } = useEscalations({ status: "open" });

  const stageMap = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const sales = useMemo(() => {
    const open = deals.filter((d) => d.status === "open");
    const pipelineValue = open.reduce((s, d) => s + (d.value ?? 0), 0);
    const weighted = open.reduce(
      (s, d) => s + ((d.value ?? 0) * (d.probability ?? 0)) / 100,
      0,
    );
    const won = deals.filter((d) => d.status === "won");
    const wonValue = won.reduce((s, d) => s + (d.value ?? 0), 0);
    const lost = deals.filter((d) => d.status === "lost").length;
    const winRate = won.length + lost > 0 ? Math.round((won.length / (won.length + lost)) * 100) : 0;

    // pipeline by stage
    const byStage = stages
      .filter((s) => s.stage_type === "open")
      .map((s) => ({
        stage: s,
        value: open.filter((d) => d.stage_id === s.id).reduce((sum, d) => sum + (d.value ?? 0), 0),
        count: open.filter((d) => d.stage_id === s.id).length,
      }));

    return { pipelineValue, weighted, wonValue, winRate, won: won.length, byStage };
  }, [deals, stages]);

  const ops = useMemo(() => {
    const internal = projects.filter((p) => !p.is_client_project && !p.is_archived);
    const client = projects.filter((p) => p.is_client_project && !p.is_archived);
    const health = {
      on_track: client.filter((p) => p.health === "on_track").length,
      at_risk: client.filter((p) => p.health === "at_risk").length,
      critical: client.filter((p) => p.health === "critical").length,
      on_hold: client.filter((p) => p.health === "on_hold").length,
    };
    return { internalCount: internal.length, clientCount: client.length, health };
  }, [projects]);

  const kpis = delivery?.kpis;
  const stats = delivery?.stats ?? [];
  const blendedMargin = useMemo(() => {
    const withMargin = stats.filter((s) => s.marginPct !== null);
    if (withMargin.length === 0) return null;
    return withMargin.reduce((sum, s) => sum + (s.marginPct ?? 0), 0) / withMargin.length;
  }, [stats]);

  const topClients = useMemo(
    () => [...stats].sort((a, b) => b.contractValue - a.contractValue).slice(0, 5),
    [stats],
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8">
      <div className="flex items-center gap-3">
        <h1 className="bg-aura-gradient bg-clip-text text-2xl font-semibold text-transparent">
          Executive Dashboard
        </h1>
        <Badge variant="outline">This quarter</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Strategic rollup across Sales, Delivery, and Ops.
      </p>

      {/* KPI Strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          to="/app/delivery"
          label="Revenue (contracts)"
          value={fmtMoney(kpis?.totalContract ?? 0)}
          trend="+ active"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
        <Kpi
          to="/app/crm"
          label="Pipeline (weighted)"
          value={fmtMoney(sales.weighted)}
          trend={`${fmtMoney(sales.pipelineValue)} open`}
          icon={<Target className="h-3.5 w-3.5" />}
        />
        <Kpi
          to="/app/delivery"
          label="Margin (blended)"
          value={blendedMargin == null ? "—" : `${blendedMargin.toFixed(0)}%`}
          trend="across active"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
        <Kpi
          to="/app/delivery"
          label="Active projects"
          value={String((kpis?.activeCount ?? 0) + ops.internalCount)}
          trend={`${ops.clientCount} client · ${ops.internalCount} internal`}
          icon={<Briefcase className="h-3.5 w-3.5" />}
        />
        <Kpi
          to="/app/escalations"
          label="At risk"
          value={String((kpis?.atRiskCount ?? 0) + openEscalations.length)}
          trend={`${openEscalations.length} escalation${openEscalations.length === 1 ? "" : "s"}`}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          accent={openEscalations.length > 0 ? "danger" : undefined}
        />
        <Kpi
          to="/app/delivery"
          label="On-time delivery"
          value={`${kpis?.onTimePct ?? 0}%`}
          trend="approved deliverables"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
      </div>

      {/* 3-column main grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue & Margin */}
        <Section title="Revenue & margin">
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Pipeline waterfall
              </p>
              <div className="mt-2 space-y-1.5">
                <Bar label="Committed (won)" value={sales.wonValue} max={sales.wonValue + sales.pipelineValue} />
                <Bar label="Weighted" value={sales.weighted} max={sales.wonValue + sales.pipelineValue} />
                <Bar label="Best case" value={sales.wonValue + sales.pipelineValue} max={sales.wonValue + sales.pipelineValue} />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Top clients by contract</p>
              <div className="space-y-1.5">
                {topClients.length === 0 && (
                  <p className="text-xs text-muted-foreground">No active client projects.</p>
                )}
                {topClients.map((s) => (
                  <Link
                    key={s.project.id}
                    to="/app/p/$projectId/overview"
                    params={{ projectId: s.project.id }}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/60"
                  >
                    <span className="truncate text-sm">{s.project.client_name || s.project.name}</span>
                    <span className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {fmtMoney(s.contractValue)}
                      {s.marginPct != null && <span>· {s.marginPct.toFixed(0)}%</span>}
                      <HealthDot health={s.project.health} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Operations */}
        <Section title="Operations">
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Project health (client)
              </p>
              <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-xs">
                <HealthCell label="On track" value={ops.health.on_track} color="oklch(0.7 0.16 145)" />
                <HealthCell label="At risk" value={ops.health.at_risk} color="oklch(0.75 0.17 80)" />
                <HealthCell label="Critical" value={ops.health.critical} color="oklch(0.6 0.22 25)" />
                <HealthCell label="On hold" value={ops.health.on_hold} color="oklch(0.7 0.02 240)" />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Active escalations</p>
              {openEscalations.length === 0 && (
                <p className="text-xs text-muted-foreground">None — clear skies.</p>
              )}
              <div className="space-y-1.5">
                {openEscalations.slice(0, 5).map((e) => {
                  const tier = e.tier as 1 | 2 | 3 | 4 | 5;
                  return (
                    <Link
                      key={e.id}
                      to="/app/escalations/$escalationId"
                      params={{ escalationId: e.id }}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                    >
                      <span className="truncate text-sm">{e.title}</span>
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[10px]"
                        style={{ backgroundColor: TIER_COLORS[tier] + "22", color: TIER_COLORS[tier] }}
                      >
                        L{tier}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
              {openEscalations.length > 0 && (
                <Link to="/app/escalations" className="mt-2 inline-block text-xs text-primary hover:underline">
                  View all →
                </Link>
              )}
            </div>
            <Link
              to="/app/resources/capacity"
              className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm hover:bg-muted/70"
            >
              <span className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" /> Resources & capacity
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          </div>
        </Section>

        {/* Sales & Pipeline */}
        <Section title="Sales & pipeline">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Win rate" value={`${sales.winRate}%`} />
              <Stat label="Won this period" value={`${sales.won} · ${fmtMoney(sales.wonValue)}`} />
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">By stage</p>
              <div className="mt-2 space-y-1.5">
                {sales.byStage.map((b) => (
                  <Bar
                    key={b.stage.id}
                    label={`${b.stage.name} · ${b.count}`}
                    value={b.value}
                    max={Math.max(...sales.byStage.map((x) => x.value), 1)}
                    color={b.stage.color}
                  />
                ))}
                {sales.byStage.length === 0 && (
                  <p className="text-xs text-muted-foreground">No open stages.</p>
                )}
              </div>
            </div>
            <Link
              to="/app/crm"
              className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm hover:bg-muted/70"
            >
              <span>Open pipeline board</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          </div>
        </Section>
      </div>

      {/* AI briefing placeholder */}
      <Section title="Today's briefing" className="mt-4">
        <p className="text-sm text-muted-foreground">
          {kpis?.activeCount ?? 0} active client projects, {openEscalations.length} open escalation
          {openEscalations.length === 1 ? "" : "s"}, {fmtMoney(sales.weighted)} weighted pipeline.
          {kpis?.atRiskCount ? ` ${kpis.atRiskCount} project${kpis.atRiskCount === 1 ? "" : "s"} flagged at risk.` : ""}
          {openEscalations[0] ? ` Highest priority: ${TIER_LABELS[openEscalations[0].tier as 1 | 2 | 3 | 4 | 5]} on ${openEscalations[0].title}.` : ""}
        </p>
      </Section>
    </div>
  );
}

function Kpi({
  label,
  value,
  trend,
  icon,
  to,
  accent,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
  to: string;
  accent?: "danger";
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
      style={accent === "danger" ? { borderColor: "oklch(0.65 0.2 35)" } : undefined}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-semibold">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{trend}</p>
    </Link>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-4 ${className ?? ""}`}>
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{fmtMoney(value)}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color ?? "var(--primary)" }}
        />
      </div>
    </div>
  );
}

function HealthCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md bg-background/60 p-1.5">
      <p className="text-base font-semibold" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function HealthDot({ health }: { health?: string }) {
  const map: Record<string, string> = {
    on_track: "oklch(0.7 0.16 145)",
    at_risk: "oklch(0.75 0.17 80)",
    critical: "oklch(0.6 0.22 25)",
    on_hold: "oklch(0.7 0.02 240)",
  };
  return (
    <span
      className="h-1.5 w-1.5 rounded-full"
      style={{ background: map[health ?? "on_track"] ?? map.on_track }}
    />
  );
}
