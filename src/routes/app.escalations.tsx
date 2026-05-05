import { createFileRoute, Link } from "@tanstack/react-router";
import { useEscalations } from "@/hooks/use-escalations";
import { useProjects } from "@/hooks/use-projects";
import { TIER_COLORS, TIER_LABELS } from "@/lib/escalation-types";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/app/escalations")({
  component: EscalationsPage,
});

function EscalationsPage() {
  const { data: escalations = [], isLoading } = useEscalations({ status: "open" });
  const { data: projects = [] } = useProjects();
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-[oklch(0.65_0.2_35)]" />
        <h1 className="bg-aura-gradient bg-clip-text text-2xl font-semibold text-transparent">
          Escalations
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Tiered response for projects deviating from plan. L1 → L5.
      </p>

      <div className="mt-6 space-y-2">
        {isLoading && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}
        {!isLoading && escalations.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No active escalations. 🟢
          </div>
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
