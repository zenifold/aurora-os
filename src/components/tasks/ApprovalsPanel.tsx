import { useMemo, useState } from "react";
import { Check, Clock, ShieldAlert, X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, formatDistanceToNow } from "date-fns";
import {
  usePendingApprovalsForTask,
  useDecideApproval,
  useRequestApproval,
  useProjectTransitions,
  useProjectWorkflow,
} from "@/hooks/use-project-workflow";
import { useWorkspaceMembers } from "@/hooks/use-comments";
import { useAuth } from "@/lib/auth-context";
import type { Task } from "@/lib/types";
import type { ApprovalRequiredGate } from "@/lib/workflow-types";

/**
 * Shows pending/approved/rejected transition approvals for the task,
 * and lets approvers decide. Author can request approval for any
 * transition out of the current status that has an approval_required gate.
 */
export function ApprovalsPanel({ task }: { task: Task }) {
  const { user } = useAuth();
  const { data: approvals = [] } = usePendingApprovalsForTask(task.id);
  const { data: workflow = [] } = useProjectWorkflow(task.project_id);
  const { data: transitions = [] } = useProjectTransitions(task.project_id);
  const { data: members = [] } = useWorkspaceMembers();
  const decide = useDecideApproval();
  const request = useRequestApproval();

  // Surface transitions out of current status that gate on approval
  const approvalCandidates = useMemo(() => {
    const fromStatus =
      workflow.find((s) => s.id === task.status) ??
      workflow.find((s) => s.name.toLowerCase() === String(task.status).toLowerCase());
    if (!fromStatus) return [];
    return transitions
      .filter((t) => t.from_status_id === fromStatus.id)
      .map((t) => {
        const toStatus = workflow.find((s) => s.id === t.to_status_id);
        const approvalGate = (t.gates ?? []).find(
          (g) => g.type === "approval_required",
        ) as ApprovalRequiredGate | undefined;
        return { transition: t, toStatus, approvalGate };
      })
      .filter((c) => c.toStatus && c.approvalGate);
  }, [workflow, transitions, task.status]);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  if (approvals.length === 0 && approvalCandidates.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldAlert className="h-4 w-4 text-primary" />
        Approvals
      </div>

      {/* Pending/decided approvals */}
      {approvals.length > 0 && (
        <ul className="space-y-2">
          {approvals.map((a) => {
            const approver = memberMap.get(a.approver_id);
            const isMe = a.approver_id === user?.id;
            const isPending = a.status === "pending";
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-sm"
              >
                <span className="flex-1 truncate">
                  <span className="font-medium">
                    {approver?.display_name ?? "Approver"}
                  </span>{" "}
                  <span className="text-xs text-muted-foreground">
                    · requested{" "}
                    {formatDistanceToNow(new Date(a.requested_at), {
                      addSuffix: true,
                    })}
                  </span>
                </span>
                {isPending ? (
                  isMe ? (
                    <DecideButtons
                      onDecide={(status, comment) =>
                        decide.mutate({ id: a.id, status, comment })
                      }
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  )
                ) : a.status === "approved" ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400"
                    title={a.decided_at ? format(new Date(a.decided_at), "PPpp") : ""}
                  >
                    <Check className="h-3 w-3" /> Approved
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                    title={a.decided_at ? format(new Date(a.decided_at), "PPpp") : ""}
                  >
                    <X className="h-3 w-3" /> Rejected
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Request approval CTAs */}
      {approvalCandidates.length > 0 && (
        <div className="space-y-1.5">
          {approvalCandidates.map(({ transition, toStatus, approvalGate }) => {
            const alreadyAsked = approvals.some(
              (a) => a.transition_id === transition.id && a.status === "pending",
            );
            return (
              <div
                key={transition.id}
                className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
              >
                <span>
                  Move to <span className="font-medium text-foreground">{toStatus!.name}</span>
                  {" requires approval"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={alreadyAsked}
                  onClick={() =>
                    request.mutate({
                      task_id: task.id,
                      transition_id: transition.id,
                      approver_ids: approvalGate!.approver_ids ?? [],
                    })
                  }
                >
                  <UserPlus className="mr-1.5 h-3 w-3" />
                  {alreadyAsked ? "Requested" : "Request approval"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DecideButtons({
  onDecide,
}: {
  onDecide: (status: "approved" | "rejected", comment?: string) => void;
}) {
  const [comment, setComment] = useState("");
  return (
    <div className="flex items-center gap-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive">
            <X className="mr-1 h-3 w-3" />
            Reject
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Reason (optional)"
            rows={3}
            className="text-sm"
          />
          <Button
            size="sm"
            variant="destructive"
            className="w-full"
            onClick={() => onDecide("rejected", comment.trim() || undefined)}
          >
            Confirm reject
          </Button>
        </PopoverContent>
      </Popover>
      <Button
        size="sm"
        className="h-7 px-2"
        onClick={() => onDecide("approved")}
      >
        <Check className="mr-1 h-3 w-3" />
        Approve
      </Button>
    </div>
  );
}
