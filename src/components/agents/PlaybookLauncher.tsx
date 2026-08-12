import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, ShieldCheck, Workflow } from "lucide-react";
import { toast } from "sonner";
import { useAgentPlaybooks, useRunAgentPlaybook, type AgentPlaybookRow } from "@/hooks/use-agent-playbooks";
import type { PlaybookStage, PlaybookTargetKind } from "@/lib/agent-playbook-defaults";

interface Props {
  targetKind: PlaybookTargetKind;
  targetId: string;
  stage: PlaybookStage;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
}

const AUTONOMY_LABEL: Record<string, { label: string; tint: string; icon: typeof ShieldCheck }> = {
  suggest: { label: "Approval first", tint: "bg-amber-500/15 text-amber-600", icon: ShieldCheck },
  bounded: { label: "Bounded", tint: "bg-blue-500/15 text-blue-600", icon: Workflow },
  autonomous: { label: "Autonomous", tint: "bg-emerald-500/15 text-emerald-600", icon: Sparkles },
};

export function PlaybookLauncher({
  targetKind,
  targetId,
  stage,
  label,
  variant = "outline",
  size = "sm",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const { data: playbooks = [], isLoading } = useAgentPlaybooks({ stage, target_kind: targetKind });
  const run = useRunAgentPlaybook();
  const navigate = useNavigate();

  const onRun = async (pb: AgentPlaybookRow) => {
    try {
      const r = await run.mutateAsync({ playbook_id: pb.id, target_id: targetId });
      toast.success(`${pb.name} started`, {
        description: "Agent is planning. Pending actions appear in your approval inbox.",
        action: {
          label: "View run",
          onClick: () => navigate({ to: "/app/runs/$runId" as never, params: { runId: r.execution_id } as never }),
        },
      });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start");
    }
  };

  const buttonLabel = label ?? (stage === "presales" ? "AI pre-sales" : "AI fulfillment");

  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        {buttonLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Run agent playbook
            </DialogTitle>
            <DialogDescription>
              Pre-built {stage === "presales" ? "pre-sales" : "fulfillment"} flows. Sensitive actions (send email, post update, create invoice) are queued for your approval before execution.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {isLoading && (
              <div className="text-sm text-muted-foreground">Loading playbooks…</div>
            )}
            {!isLoading && playbooks.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No playbooks available for this {targetKind}.
              </div>
            )}
            {playbooks.map((pb) => {
              const auto = pb.autonomy_override ?? "bounded";
              const meta = AUTONOMY_LABEL[auto];
              const Icon = meta.icon;
              return (
                <button
                  key={pb.id}
                  onClick={() => onRun(pb)}
                  disabled={run.isPending}
                  className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-accent/30 disabled:opacity-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
                    {pb.agent?.avatar_emoji ?? "🤖"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{pb.name}</span>
                      <Badge variant="secondary" className={`gap-1 text-[10px] ${meta.tint}`}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </div>
                    {pb.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{pb.description}</p>
                    )}
                  </div>
                  {run.isPending && run.variables?.playbook_id === pb.id && (
                    <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
