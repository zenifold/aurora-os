import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  captureBaseline,
  deleteBaseline,
  getBaselineVariance,
  listBaselines,
  setActiveBaseline,
} from "@/server/baselines.functions";
import { useProject } from "@/hooks/use-projects";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Camera,
  CheckCircle2,
  Trash2,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/p/$projectId/baseline")({
  component: BaselinePage,
});

type BaselineRow = {
  id: string;
  name: string;
  is_active: boolean;
  start_date: string | null;
  target_end_date: string | null;
  total_budget_amount: number | null;
  notes: string | null;
  created_at: string;
};

type MilestoneDiff = {
  id: string;
  name: string;
  baseline_due: string | null;
  current_due: string | null;
  slip_days: number | null;
  status: string;
};

type Variance = {
  id: string;
  name: string;
  captured_at: string;
  start_date_baseline: string | null;
  start_date_current: string | null;
  start_slip_days: number | null;
  end_date_baseline: string | null;
  end_date_current: string | null;
  end_slip_days: number | null;
  budget_baseline: number | null;
  budget_current: number | null;
  budget_delta: number | null;
  milestones_total: number;
  milestones_slipped: number;
  milestones_on_time: number;
  milestone_diffs: MilestoneDiff[];
  scope_added_tasks: number;
  scope_removed_tasks: number;
};

function BaselinePage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const qc = useQueryClient();

  const list = useServerFn(listBaselines);
  const variance = useServerFn(getBaselineVariance);
  const capture = useServerFn(captureBaseline);
  const setActive = useServerFn(setActiveBaseline);
  const remove = useServerFn(deleteBaseline);

  const { data: baselinesData, isLoading: loadingList } = useQuery({
    queryKey: ["baselines", projectId],
    queryFn: async () => {
      const r = await list({ data: { project_id: projectId } });
      if ("error" in r) throw new Error(r.error);
      return r.baselines as BaselineRow[];
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveId = selectedId ?? baselinesData?.find((b) => b.is_active)?.id ?? null;

  const { data: varianceData, isLoading: loadingVar } = useQuery({
    queryKey: ["baseline-variance", projectId, effectiveId],
    enabled: !!effectiveId,
    queryFn: async () => {
      const r = await variance({
        data: { project_id: projectId, baseline_id: effectiveId ?? undefined },
      });
      if ("error" in r) throw new Error(r.error);
      return r.baseline as Variance | null;
    },
  });

  const captureMut = useMutation({
    mutationFn: async () => {
      const r = await capture({
        data: { project_id: projectId, name: `Baseline ${new Date().toLocaleDateString()}`, set_active: true },
      });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["baselines", projectId] });
      qc.invalidateQueries({ queryKey: ["baseline-variance", projectId] });
      toast.success("Baseline captured");
    },
    onError: (e) => toast.error((e as Error).message || "Capture failed"),
  });

  const activate = useMutation({
    mutationFn: async (id: string) => {
      const r = await setActive({ data: { project_id: projectId, id } });
      if ("error" in r) throw new Error(r.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["baselines", projectId] });
      qc.invalidateQueries({ queryKey: ["baseline-variance", projectId] });
      toast.success("Active baseline updated");
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const r = await remove({ data: { project_id: projectId, id } });
      if ("error" in r) throw new Error(r.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["baselines", projectId] });
      setSelectedId(null);
      toast.success("Baseline deleted");
    },
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            to="/app/p/$projectId"
            params={{ projectId }}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" />
            {project?.name ?? "Project"}
          </Link>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold lg:text-xl">Baseline &amp; variance</h1>
            <p className="text-xs text-muted-foreground">
              Snapshot the plan at kickoff, then track date, scope, and budget slippage against it.
            </p>
          </div>
          <Button size="sm" onClick={() => captureMut.mutate()} disabled={captureMut.isPending}>
            {captureMut.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Camera className="mr-1.5 h-4 w-4" />
            )}
            Capture baseline
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="overflow-auto border-b border-border lg:border-b-0 lg:border-r">
          {loadingList ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (baselinesData ?? []).length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No baselines yet. Capture one to start tracking variance.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {(baselinesData ?? []).map((b) => {
                const active = b.id === effectiveId;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(b.id)}
                      className={`group flex w-full flex-col gap-1 px-4 py-3 text-left text-sm hover:bg-accent ${
                        active ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{b.name}</span>
                        {b.is_active && (
                          <Badge variant="outline" className="shrink-0 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300">
                            Active
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Captured {new Date(b.created_at).toLocaleDateString()}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="overflow-auto p-4 lg:p-6">
          {!effectiveId ? (
            <Card className="p-6 text-sm text-muted-foreground">
              Capture a baseline to compare the current plan against it.
            </Card>
          ) : loadingVar || !varianceData ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{varianceData.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    Captured {new Date(varianceData.captured_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!baselinesData?.find((b) => b.id === effectiveId)?.is_active && (
                    <Button size="sm" variant="outline" onClick={() => activate.mutate(effectiveId)}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" /> Set active
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Delete this baseline?")) del.mutate(effectiveId);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                  label="Start slip"
                  value={fmtSlip(varianceData.start_slip_days)}
                  trend={trendOf(varianceData.start_slip_days)}
                />
                <StatCard
                  label="End slip"
                  value={fmtSlip(varianceData.end_slip_days)}
                  trend={trendOf(varianceData.end_slip_days)}
                />
                <StatCard
                  label="Milestones slipped"
                  value={`${varianceData.milestones_slipped}/${varianceData.milestones_total}`}
                  trend={varianceData.milestones_slipped > 0 ? "bad" : "good"}
                />
                <StatCard
                  label="Budget delta"
                  value={fmtMoney(varianceData.budget_delta)}
                  trend={
                    varianceData.budget_delta == null
                      ? "neutral"
                      : varianceData.budget_delta > 0
                      ? "good"
                      : varianceData.budget_delta < 0
                      ? "bad"
                      : "neutral"
                  }
                />
              </div>

              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold">Scope change</h3>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tasks added:</span>{" "}
                    <span className="font-medium">{varianceData.scope_added_tasks}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tasks removed:</span>{" "}
                    <span className="font-medium">{varianceData.scope_removed_tasks}</span>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold">Milestone variance</h3>
                </div>
                {varianceData.milestone_diffs.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    No milestones were captured in this baseline.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {varianceData.milestone_diffs.map((m) => (
                      <div key={m.id} className="grid grid-cols-12 items-center gap-2 px-4 py-2 text-sm">
                        <span className="col-span-5 truncate font-medium">{m.name}</span>
                        <span className="col-span-2 text-xs text-muted-foreground">
                          {m.baseline_due ?? "—"}
                        </span>
                        <span className="col-span-2 text-xs">{m.current_due ?? "—"}</span>
                        <span className="col-span-2 text-xs">
                          {m.slip_days == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : m.slip_days > 0 ? (
                            <span className="text-destructive">+{m.slip_days}d</span>
                          ) : m.slip_days < 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">{m.slip_days}d</span>
                          ) : (
                            <span className="text-muted-foreground">on plan</span>
                          )}
                        </span>
                        <span className="col-span-1 justify-self-end">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {m.status}
                          </Badge>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, trend }: { label: string; value: string; trend: "good" | "bad" | "neutral" }) {
  const Icon = trend === "good" ? TrendingDown : trend === "bad" ? TrendingUp : Minus;
  const color =
    trend === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "bad"
      ? "text-destructive"
      : "text-muted-foreground";
  return (
    <Card className="p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 flex items-center gap-1 text-lg font-semibold ${color}`}>
        <Icon className="h-4 w-4" /> {value}
      </p>
    </Card>
  );
}

function fmtSlip(d: number | null) {
  if (d == null) return "—";
  if (d === 0) return "on plan";
  return d > 0 ? `+${d}d` : `${d}d`;
}
function fmtMoney(n: number | null) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)}`;
}
function trendOf(d: number | null): "good" | "bad" | "neutral" {
  if (d == null || d === 0) return "neutral";
  return d > 0 ? "bad" : "good";
}
