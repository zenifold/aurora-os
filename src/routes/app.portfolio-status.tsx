import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, Activity, AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import type { StatusHealth } from "@/hooks/use-status-updates";
import { ProjectPhaseChip } from "@/components/projects/ProjectPhaseChip";

export const Route = createFileRoute("/app/portfolio-status")({
  component: PortfolioStatusPage,
});

const HEALTH_LABEL: Record<StatusHealth, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  complete: "Complete",
};
const HEALTH_CLASS: Record<StatusHealth, string> = {
  on_track: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  at_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  off_track: "bg-destructive/15 text-destructive border-destructive/30",
  complete: "bg-primary/15 text-primary border-primary/30",
};
const HEALTH_DOT: Record<StatusHealth | "none", string> = {
  on_track: "bg-emerald-500",
  at_risk: "bg-amber-500",
  off_track: "bg-destructive",
  complete: "bg-primary",
  none: "bg-muted-foreground/30",
};

interface Row {
  project_id: string;
  project_name: string;
  client_name: string | null;
  health: StatusHealth | null;
  headline: string | null;
  published_at: string | null;
  csat_avg: number | null;
  csat_count: number;
}

function usePortfolioStatus() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["portfolio-status", ws?.id],
    enabled: !!ws?.id,
    queryFn: async (): Promise<Row[]> => {
      const { data: projects, error } = await supabase
        .from("projects")
        .select("id, name, client_name")
        .eq("workspace_id", ws!.id)
        .order("name");
      if (error) throw error;
      const ids = (projects ?? []).map((p) => p.id);
      if (ids.length === 0) return [];

      const [{ data: updates }, { data: csat }] = await Promise.all([
        supabase
          .from("project_status_updates")
          .select("project_id, health, headline, published_at, status, created_at")
          .in("project_id", ids)
          .eq("status", "published")
          .order("published_at", { ascending: false }),
        supabase
          .from("csat_responses")
          .select("project_id, score")
          .in("project_id", ids),
      ]);

      const latestByProject = new Map<string, { health: StatusHealth; headline: string | null; published_at: string | null }>();
      for (const u of (updates ?? []) as Array<{ project_id: string; health: StatusHealth; headline: string | null; published_at: string | null }>) {
        if (!latestByProject.has(u.project_id)) {
          latestByProject.set(u.project_id, { health: u.health, headline: u.headline, published_at: u.published_at });
        }
      }
      const csatByProject = new Map<string, { sum: number; count: number }>();
      for (const r of (csat ?? []) as Array<{ project_id: string; score: number }>) {
        const cur = csatByProject.get(r.project_id) ?? { sum: 0, count: 0 };
        cur.sum += Number(r.score) || 0;
        cur.count += 1;
        csatByProject.set(r.project_id, cur);
      }

      return (projects ?? []).map((p) => {
        const u = latestByProject.get(p.id);
        const c = csatByProject.get(p.id);
        return {
          project_id: p.id,
          project_name: p.name,
          client_name: p.client_name ?? null,
          health: u?.health ?? null,
          headline: u?.headline ?? null,
          published_at: u?.published_at ?? null,
          csat_avg: c && c.count > 0 ? c.sum / c.count : null,
          csat_count: c?.count ?? 0,
        };
      });
    },
  });
}

function PortfolioStatusPage() {
  const { data: rows = [], isLoading } = usePortfolioStatus();

  const counts = rows.reduce(
    (acc, r) => {
      const k = r.health ?? "none";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const totalCsat = rows.filter((r) => r.csat_count > 0);
  const portfolioCsat =
    totalCsat.length > 0
      ? totalCsat.reduce((s, r) => s + (r.csat_avg ?? 0), 0) / totalCsat.length
      : null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-4 lg:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold lg:text-xl">Portfolio status</h1>
            <p className="text-xs text-muted-foreground">
              Latest published status update and CSAT across every project in this workspace.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <SummaryChip icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />} label="On track" value={counts.on_track ?? 0} />
          <SummaryChip icon={<Activity className="h-3.5 w-3.5 text-amber-500" />} label="At risk" value={counts.at_risk ?? 0} />
          <SummaryChip icon={<AlertTriangle className="h-3.5 w-3.5 text-destructive" />} label="Off track" value={counts.off_track ?? 0} />
          <SummaryChip icon={<Circle className="h-3.5 w-3.5 text-muted-foreground" />} label="No update" value={counts.none ?? 0} />
          {portfolioCsat !== null && (
            <SummaryChip
              icon={<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
              label="Avg CSAT"
              value={portfolioCsat.toFixed(2)}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            No projects in this workspace yet.
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => (
              <Link
                key={r.project_id}
                to="/app/p/$projectId/status"
                params={{ projectId: r.project_id }}
                className="block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg"
              >
                <Card className="h-full space-y-3 p-4 transition-colors hover:bg-accent/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[r.health ?? "none"]}`} />
                        <span className="truncate text-sm font-semibold">{r.project_name}</span>
                      </div>
                      {r.client_name && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.client_name}</p>
                      )}
                    </div>
                    {r.health && (
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${HEALTH_CLASS[r.health]}`}>
                        {HEALTH_LABEL[r.health]}
                      </Badge>
                    )}
                  </div>

                  <p className="line-clamp-2 min-h-[2.5em] text-xs text-muted-foreground">
                    {r.headline ?? "No published status update yet."}
                  </p>

                  <div className="flex items-center justify-between gap-2">
                    <ProjectPhaseChip projectId={r.project_id} noLink />
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
                    <span>
                      {r.published_at
                        ? `Updated ${new Date(r.published_at).toLocaleDateString()}`
                        : "Never updated"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {r.csat_avg !== null ? `${r.csat_avg.toFixed(1)} · ${r.csat_count}` : "—"}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1">
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
