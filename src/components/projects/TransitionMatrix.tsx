import { useState } from "react";
import { Check, X, ArrowRight, ShieldCheck, Lock } from "lucide-react";
import type { WorkflowStatus, WorkflowTransition } from "@/lib/workflow-types";
import {
  useProjectWorkflow,
  useProjectTransitions,
} from "@/hooks/use-project-workflow";
import { TransitionEditorDialog } from "./TransitionEditorDialog";
import { Badge } from "@/components/ui/badge";

/**
 * Visual matrix: rows = from status, columns = to status.
 * Click any cell to add/edit/remove the transition.
 */
export function TransitionMatrix({ projectId }: { projectId: string }) {
  const { data: statuses = [] } = useProjectWorkflow(projectId);
  const { data: transitions = [] } = useProjectTransitions(projectId);
  const [editing, setEditing] = useState<{
    from: WorkflowStatus;
    to: WorkflowStatus;
    transition: WorkflowTransition | null;
  } | null>(null);

  if (statuses.length < 2) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        Add at least two statuses to configure transitions.
      </p>
    );
  }

  const txMap = new Map(transitions.map((t) => [`${t.from_status_id}->${t.to_status_id}`, t]));

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/15 text-emerald-600">
              <Check className="h-3 w-3" />
            </span>
            Allowed
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-amber-600" /> Has gates
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-purple-600" /> Restricted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-muted-foreground">
              <X className="h-3 w-3" />
            </span>
            Blocked
          </span>
        </div>

        <div className="-mx-2 overflow-x-auto px-2">
          <table className="min-w-full border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background pr-2 text-left font-normal text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    From <ArrowRight className="h-3 w-3" /> To
                  </div>
                </th>
                {statuses.map((s) => (
                  <th key={s.id} className="px-1 py-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      <span className="max-w-[80px] truncate font-medium">{s.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statuses.map((from) => (
                <tr key={from.id}>
                  <th className="sticky left-0 z-10 bg-background py-1 pr-2 text-left font-normal">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: from.color }} />
                      <span className="max-w-[120px] truncate font-medium">{from.name}</span>
                    </div>
                  </th>
                  {statuses.map((to) => {
                    if (from.id === to.id) {
                      return (
                        <td key={to.id} className="h-9 w-9 rounded bg-muted/30">
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            —
                          </div>
                        </td>
                      );
                    }
                    const tx = txMap.get(`${from.id}->${to.id}`);
                    return (
                      <td key={to.id}>
                        <button
                          onClick={() => setEditing({ from, to, transition: tx ?? null })}
                          className={`flex h-9 w-full min-w-[44px] items-center justify-center gap-1 rounded transition ${
                            tx
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                          title={tx ? `Edit transition${tx.button_label ? `: ${tx.button_label}` : ""}` : "Allow this path"}
                        >
                          {tx ? (
                            <>
                              <Check className="h-3 w-3" />
                              {(tx.gates?.length ?? 0) > 0 && <ShieldCheck className="h-3 w-3 text-amber-600" />}
                              {tx.permission !== "anyone" && <Lock className="h-3 w-3 text-purple-600" />}
                            </>
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {transitions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Configured paths
            </p>
            <div className="flex flex-wrap gap-1.5">
              {transitions.map((t) => {
                const from = statuses.find((s) => s.id === t.from_status_id);
                const to = statuses.find((s) => s.id === t.to_status_id);
                if (!from || !to) return null;
                return (
                  <button
                    key={t.id}
                    onClick={() => setEditing({ from, to, transition: t })}
                    className="group flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] hover:border-primary/40"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: from.color }} />
                    {from.name}
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: to.color }} />
                    {to.name}
                    {t.button_label && (
                      <Badge variant="secondary" className="ml-1 h-3.5 px-1 text-[9px]">
                        {t.button_label}
                      </Badge>
                    )}
                    {(t.gates?.length ?? 0) > 0 && (
                      <ShieldCheck className="ml-0.5 h-2.5 w-2.5 text-amber-600" />
                    )}
                    {t.permission !== "anyone" && (
                      <Lock className="ml-0.5 h-2.5 w-2.5 text-purple-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <TransitionEditorDialog
          projectId={projectId}
          fromStatus={editing.from}
          toStatus={editing.to}
          transition={editing.transition}
          open={true}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
