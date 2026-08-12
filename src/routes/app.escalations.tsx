import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { NavAccessGuard } from "@/components/app/NavAccessGuard";
import { useEscalations } from "@/hooks/use-escalations";
import { useProjects } from "@/hooks/use-projects";
import { TIER_COLORS, TIER_LABELS } from "@/lib/escalation-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/loading-scaffolds";
import { AlertTriangle, ShieldCheck, Play, Settings2 } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { evaluateEscalations } from "@/lib/escalations.functions";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/app/escalations")({
  component: () => <NavAccessGuard navKey="escalations"><EscalationsPage /></NavAccessGuard>,
});

function EscalationsPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: escalations = [], isLoading } = useEscalations({ status: "open" });
  const { data: projects = [] } = useProjects();
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const evaluate = useServerFn(evaluateEscalations);
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const runNow = async () => {
    if (!ws) return;
    setRunning(true);
    try {
      const res = await evaluate({ data: { workspace_id: ws.id } });
      if (res.ok) {
        toast.success(
          res.created > 0
            ? `Created ${res.created} escalation${res.created > 1 ? "s" : ""} from ${res.evaluated} project${res.evaluated > 1 ? "s" : ""}`
            : `Evaluated ${res.evaluated} project${res.evaluated > 1 ? "s" : ""} — no new escalations`,
        );
        qc.invalidateQueries({ queryKey: ["escalations"] });
      } else {
        toast.error(res.error);
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="animate-page-in mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-[oklch(0.65_0.2_35)]" />
            <h1 className="bg-aura-gradient bg-clip-text text-2xl font-semibold text-transparent">
              Escalations
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Tiered response for projects deviating from plan. L1 → L5.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/settings/escalations">
              <Settings2 className="mr-2 h-4 w-4" /> Manage rules
            </Link>
          </Button>
          <Button size="sm" onClick={runNow} disabled={running}>
            <Play className="mr-2 h-4 w-4" /> {running ? "Running…" : "Run rules now"}
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {isLoading && <ListSkeleton rows={5} />}
        {!isLoading && escalations.length === 0 && (
          <EmptyState
            icon={ShieldCheck}
            title="No active escalations"
            description="Projects flagged off-plan or breaching SLA will appear here so you can intervene early."
            primaryAction={{ label: "Open projects", to: "/app/projects" }}
          />
        )}
        {escalations.map((e) => {
          const tier = e.tier as 1 | 2 | 3 | 4 | 5;
          const project = projectMap.get(e.project_id);
          return (
            <Link
              key={e.id}
              to="/app/escalations/$escalationId"
              params={{ escalationId: e.id }}
              className="block rounded-xl border-l-4 border border-border bg-card p-4 transition-colors hover:bg-muted/40"
              style={{ borderLeftColor: TIER_COLORS[tier] }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      style={{ backgroundColor: TIER_COLORS[tier] + "22", color: TIER_COLORS[tier] }}
                    >
                      {TIER_LABELS[tier]}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {e.status.replace("_", " ")}
                    </Badge>
                    {project && (
                      <span className="text-xs text-muted-foreground">
                        {project.client_name || project.name}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 truncate font-medium">{e.title}</h3>
                  {e.detail && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.detail}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
