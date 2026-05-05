import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Task } from "@/lib/types";
import {
  validateTransition,
  findTransition,
  wouldExceedWipLimit,
} from "@/lib/workflow-engine";
import type {
  WorkflowStatus,
  WorkflowTransition,
  TransitionApproval,
  ApprovalRequiredGate,
} from "@/lib/workflow-types";

interface GuardArgs {
  task: Task;
  toStatus: WorkflowStatus;
  fromStatus: WorkflowStatus | undefined;
  workflow: WorkflowStatus[];
  transitions: WorkflowTransition[];
  /** Number of tasks currently in the destination status (excluding this one). */
  destinationCount: number;
}

export interface GuardResult {
  allowed: boolean;
  /** When false, an approval flow was kicked off and the user should not move the task. */
  needsApproval?: { gate: ApprovalRequiredGate; transition: WorkflowTransition };
  message?: string;
}

/**
 * Centralized guard used by Kanban (drag) and TaskDetailPanel (status select).
 * - Refuses moves with no transition
 * - Enforces WIP limits, exit/entry/transition gates
 * - Surfaces approval requirements without performing the move
 */
export function useTransitionGuard() {
  const qc = useQueryClient();

  return useCallback(
    async ({
      task,
      toStatus,
      fromStatus,
      transitions,
      workflow,
      destinationCount,
    }: GuardArgs): Promise<GuardResult> => {
      // 1. WIP limit
      if (
        wouldExceedWipLimit(toStatus, destinationCount, fromStatus?.id === toStatus.id)
      ) {
        toast.error(
          `WIP limit reached for "${toStatus.name}" (${toStatus.wip_limit}). Finish or move existing tasks first.`,
        );
        return { allowed: false, message: "WIP limit" };
      }

      // 2. Transition exists?
      const transition = fromStatus
        ? findTransition(transitions, fromStatus.id, toStatus.id)
        : undefined;
      if (fromStatus && !transition) {
        toast.error(
          `No transition from "${fromStatus.name}" to "${toStatus.name}". Configure it in project settings → Workflow.`,
        );
        return { allowed: false, message: "No transition" };
      }

      // 3. Build status lookup + load supporting context for gate eval
      const statusById = new Map(workflow.map((s) => [s.id, s]));

      // Subtasks (children) — only fetched if any gate needs them
      const needsChildren =
        (toStatus.entry_criteria ?? []).some(
          (g) => g.type === "subtasks_status" || g.type === "child_tasks_status",
        ) ||
        (fromStatus?.exit_criteria ?? []).some(
          (g) => g.type === "subtasks_status" || g.type === "child_tasks_status",
        ) ||
        (transition?.gates ?? []).some(
          (g) => g.type === "subtasks_status" || g.type === "child_tasks_status",
        );

      let children: Task[] | undefined;
      if (needsChildren) {
        const { data } = await supabase
          .from("tasks")
          .select("*")
          .eq("parent_task_id", task.id);
        children = (data ?? []) as Task[];
      }

      // Blockers
      const needsBlockers =
        (toStatus.entry_criteria ?? []).some(
          (g) => g.type === "all_blockers_resolved" || g.type === "no_open_blockers",
        ) ||
        (fromStatus?.exit_criteria ?? []).some(
          (g) => g.type === "all_blockers_resolved" || g.type === "no_open_blockers",
        ) ||
        (transition?.gates ?? []).some(
          (g) => g.type === "all_blockers_resolved" || g.type === "no_open_blockers",
        );

      let blockers: Task[] | undefined;
      if (needsBlockers) {
        const { data: rels } = await supabase
          .from("task_relations")
          .select("source_task_id, target_task_id, relation_type")
          .or(
            `and(target_task_id.eq.${task.id},relation_type.eq.blocked_by),and(source_task_id.eq.${task.id},relation_type.eq.blocked_by)`,
          );
        const blockerIds = new Set<string>();
        for (const r of (rels ?? []) as {
          source_task_id: string;
          target_task_id: string;
          relation_type: string;
        }[]) {
          if (r.relation_type === "blocked_by") {
            // Convention: source is blocked, target blocks
            const otherId = r.source_task_id === task.id ? r.target_task_id : r.source_task_id;
            blockerIds.add(otherId);
          }
        }
        if (blockerIds.size > 0) {
          const { data: bts } = await supabase
            .from("tasks")
            .select("*")
            .in("id", Array.from(blockerIds));
          blockers = (bts ?? []) as Task[];
        } else {
          blockers = [];
        }
      }

      // Approvals already granted for this transition
      let approvals: TransitionApproval[] | undefined;
      if (transition) {
        const { data } = await supabase
          .from("transition_approvals")
          .select("*")
          .eq("task_id", task.id)
          .eq("transition_id", transition.id);
        approvals = (data ?? []) as unknown as TransitionApproval[];
      }

      const { data: u } = await supabase.auth.getUser();

      // 4. Evaluate gates
      const result = validateTransition(fromStatus, toStatus, transition, {
        task,
        children,
        blockers,
        approvals,
        statusById,
        currentUserId: u.user?.id,
      });

      if (result.passed) {
        // refresh approvals/dwell caches when a move is about to happen
        qc.invalidateQueries({ queryKey: ["workflow", "approvals", task.id] });
        return { allowed: true };
      }

      if (result.needsApproval && result.approvalGate && transition) {
        toast.message("Approval required", {
          description: result.message,
        });
        return {
          allowed: false,
          needsApproval: { gate: result.approvalGate, transition },
        };
      }

      if (result.blocking) {
        toast.error(result.message || "This transition is blocked.", {
          description:
            result.missing.length > 0
              ? result.missing.slice(0, 3).join(", ")
              : undefined,
        });
        return { allowed: false, message: result.message };
      }

      // Warning only — allow move but inform user
      toast.warning(result.message || "Transition completed with warnings.");
      return { allowed: true };
    },
    [qc],
  );
}
