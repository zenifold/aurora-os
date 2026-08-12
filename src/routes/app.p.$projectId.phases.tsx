import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, SkipForward, Play, Clock, CheckCircle2, Circle, Flag, Layers, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { listEngagementPhases, advanceEngagementPhase } from "@/lib/phases.functions";
import { format, formatDistanceToNow } from "date-fns";
import {
  ApplyPhaseTemplateDialog,
  SavePhasesAsTemplateDialog,
} from "@/components/projects/PhaseTemplatePicker";

export const Route = createFileRoute("/app/p/$projectId/phases")({
  component: PhasesTab,
});

type Phase = {
  id: string;
  key: string;
  name: string;
  order_index: number;
  color: string | null;
  owner_role: string | null;
  target_days: number | null;
  is_terminal: boolean;
  exit_criteria: unknown;
  status: "planned" | "active" | "completed" | "skipped";
  started_at: string | null;
  completed_at: string | null;
};

function PhasesTab() {
  const { projectId } = Route.useParams();
  const vocab = useVocabulary();
  const qc = useQueryClient();
  const listFn = useServerFn(listEngagementPhases);
  const advanceFn = useServerFn(advanceEngagementPhase);

  const { data = [], isLoading } = useQuery({
    queryKey: ["engagement-phases", projectId],
    queryFn: () => listFn({ data: { project_id: projectId } }) as Promise<Phase[]>,
  });

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const advanceMut = useMutation({
    mutationFn: (vars: { phase_id: string; action: "complete" | "skip" | "activate" }) => {
      setPendingId(vars.phase_id);
      return advanceFn({ data: { project_id: projectId, ...vars } });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["engagement-phases", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success(
        vars.action === "complete" ? `${vocab.phase.singular} completed` :
        vars.action === "skip" ? `${vocab.phase.singular} skipped` :
        `${vocab.phase.singular} activated`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPendingId(null),
  });

  const completedCount = data.filter((p) => p.status === "completed").length;
  const totalCount = data.length;
  const progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!data.length) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center space-y-4">
          <Flag className="h-8 w-8 mx-auto text-muted-foreground" />
          <div className="space-y-1">
            <h3 className="font-medium">No {vocab.phase.plural.toLowerCase()} yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This {vocab.engagement.singular.toLowerCase()} is running freeform. Apply a phase template to seed a workflow, or leave it as is.
            </p>
          </div>
          <Button onClick={() => setApplyOpen(true)}>
            <Layers className="h-4 w-4 mr-1.5" /> Apply phase template
          </Button>
        </Card>
        <ApplyPhaseTemplateDialog
          projectId={projectId}
          open={applyOpen}
          onOpenChange={setApplyOpen}
          hasExistingPhases={false}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <header className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{vocab.phase.plural}</h2>
            <p className="text-sm text-muted-foreground">
              {completedCount} of {totalCount} {vocab.phase.plural.toLowerCase()} complete
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)}>
              <Save className="h-3.5 w-3.5 mr-1.5" /> Save as template
            </Button>
            <Button variant="outline" size="sm" onClick={() => setApplyOpen(true)}>
              <Layers className="h-3.5 w-3.5 mr-1.5" /> Apply template
            </Button>
            <span className="text-2xl font-semibold tabular-nums">{progress}%</span>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <ApplyPhaseTemplateDialog
        projectId={projectId}
        open={applyOpen}
        onOpenChange={setApplyOpen}
        hasExistingPhases={data.length > 0}
      />
      <SavePhasesAsTemplateDialog
        projectId={projectId}
        open={saveOpen}
        onOpenChange={setSaveOpen}
      />


      <ol className="space-y-3">
        {data.map((p, idx) => {
          const isPending = pendingId === p.id && advanceMut.isPending;
          const exitCriteria = Array.isArray(p.exit_criteria) ? (p.exit_criteria as string[]) : [];
          return (
            <li key={p.id}>
              <Card className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center pt-1">
                    <PhaseIcon status={p.status} color={p.color} />
                    {idx < data.length - 1 && <div className="w-px flex-1 bg-border mt-2 min-h-8" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{p.name}</h3>
                          <StatusBadge status={p.status} />
                          {p.is_terminal && <Badge variant="outline" className="text-xs">Terminal</Badge>}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          {p.owner_role && <span>Owner: {p.owner_role}</span>}
                          {p.target_days != null && <span>Target: {p.target_days}d</span>}
                          {p.started_at && (
                            <span>Started {formatDistanceToNow(new Date(p.started_at), { addSuffix: true })}</span>
                          )}
                          {p.completed_at && (
                            <span>Closed {format(new Date(p.completed_at), "MMM d")}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {p.status === "planned" && (
                          <Button size="sm" variant="outline" disabled={isPending}
                            onClick={() => advanceMut.mutate({ phase_id: p.id, action: "activate" })}>
                            <Play className="h-3.5 w-3.5 mr-1" /> Start
                          </Button>
                        )}
                        {p.status === "active" && (
                          <>
                            <Button size="sm" variant="outline" disabled={isPending}
                              onClick={() => advanceMut.mutate({ phase_id: p.id, action: "skip" })}>
                              <SkipForward className="h-3.5 w-3.5 mr-1" /> Skip
                            </Button>
                            <Button size="sm" disabled={isPending}
                              onClick={() => advanceMut.mutate({ phase_id: p.id, action: "complete" })}>
                              <Check className="h-3.5 w-3.5 mr-1" /> Complete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {exitCriteria.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {exitCriteria.map((c, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-muted-foreground/60 mt-0.5">·</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PhaseIcon({ status, color }: { status: Phase["status"]; color: string | null }) {
  const ring = color ?? "hsl(var(--primary))";
  if (status === "completed")
    return <CheckCircle2 className="h-5 w-5" style={{ color: ring }} />;
  if (status === "active")
    return (
      <div className="h-5 w-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: ring }}>
        <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: ring }} />
      </div>
    );
  if (status === "skipped")
    return <Circle className="h-5 w-5 text-muted-foreground/50" />;
  return <Clock className="h-5 w-5 text-muted-foreground/60" />;
}

function StatusBadge({ status }: { status: Phase["status"] }) {
  const map = {
    planned: { label: "Planned", variant: "outline" as const },
    active: { label: "Active", variant: "default" as const },
    completed: { label: "Completed", variant: "secondary" as const },
    skipped: { label: "Skipped", variant: "outline" as const },
  };
  const cfg = map[status];
  return <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>;
}
