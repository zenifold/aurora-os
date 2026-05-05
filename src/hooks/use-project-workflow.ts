import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import type {
  WorkflowStatus,
  WorkflowTransition,
  TransitionApproval,
  TaskStatusHistoryRow,
  Gate,
  WorkflowAction,
  StatusCategory,
} from "@/lib/workflow-types";

// Re-export for backward compat with existing imports.
export type { WorkflowStatus } from "@/lib/workflow-types";
export type { StatusCategory } from "@/lib/workflow-types";

/**
 * Transient placeholder used as `placeholderData` while the real workflow loads.
 * Components must render even before the DB has seeded a workflow for a project.
 */
export const DEFAULT_WORKFLOW: WorkflowStatus[] = [];

function rowToStatus(r: Record<string, unknown>): WorkflowStatus {
  return {
    id: r.id as string,
    workspace_id: r.workspace_id as string,
    project_id: r.project_id as string,
    name: r.name as string,
    color: r.color as string,
    icon: (r.icon as string) ?? "circle",
    category: r.category as StatusCategory,
    order_index: (r.order_index as number) ?? 0,
    is_start: !!r.is_start,
    is_terminal: !!r.is_terminal,
    wip_limit: (r.wip_limit as number | null) ?? null,
    sla_hours: (r.sla_hours as number | null) ?? null,
    auto_assign_to: (r.auto_assign_to as Record<string, unknown> | null) ?? null,
    entry_criteria: ((r.entry_criteria as Gate[] | null) ?? []) as Gate[],
    exit_criteria: ((r.exit_criteria as Gate[] | null) ?? []) as Gate[],
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function rowToTransition(r: Record<string, unknown>): WorkflowTransition {
  return {
    id: r.id as string,
    workspace_id: r.workspace_id as string,
    project_id: r.project_id as string,
    from_status_id: r.from_status_id as string,
    to_status_id: r.to_status_id as string,
    permission: (r.permission as WorkflowTransition["permission"]) ?? "anyone",
    allowed_role: (r.allowed_role as string | null) ?? null,
    gates: ((r.gates as Gate[] | null) ?? []) as Gate[],
    actions: ((r.actions as WorkflowAction[] | null) ?? []) as WorkflowAction[],
    button_label: (r.button_label as string | null) ?? null,
    confirmation_message: (r.confirmation_message as string | null) ?? null,
  };
}

/** Loads the resolved workflow (statuses) for a project. */
export function useProjectWorkflow(projectId: string | undefined) {
  return useQuery({
    queryKey: ["workflow", "statuses", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<WorkflowStatus[]> => {
      const { data, error } = await supabase
        .from("workflow_statuses")
        .select("*")
        .eq("project_id", projectId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => rowToStatus(r as Record<string, unknown>));
    },
  });
}

export function useProjectTransitions(projectId: string | undefined) {
  return useQuery({
    queryKey: ["workflow", "transitions", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<WorkflowTransition[]> => {
      const { data, error } = await supabase
        .from("workflow_transitions")
        .select("*")
        .eq("project_id", projectId!);
      if (error) throw error;
      return (data ?? []).map((r) => rowToTransition(r as Record<string, unknown>));
    },
  });
}

export function findStatus(
  workflow: WorkflowStatus[],
  id: string | null | undefined,
): WorkflowStatus | undefined {
  if (!id) return undefined;
  return workflow.find((s) => s.id === id) ?? workflow.find((s) => s.name.toLowerCase() === String(id).toLowerCase());
}

export function isDoneStatus(workflow: WorkflowStatus[], id: string | null | undefined): boolean {
  const s = findStatus(workflow, id);
  return s?.category === "done";
}

export function isTerminalStatus(workflow: WorkflowStatus[], id: string | null | undefined): boolean {
  const s = findStatus(workflow, id);
  return !!s?.is_terminal || s?.category === "done" || s?.category === "cancelled";
}

// ============================================================================
// Status mutations
// ============================================================================

export function useCreateWorkflowStatus(projectId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<WorkflowStatus> & { name: string; category: StatusCategory }) => {
      if (!ws) throw new Error("No workspace");
      const { data: existing } = await supabase
        .from("workflow_statuses")
        .select("order_index")
        .eq("project_id", projectId)
        .order("order_index", { ascending: false })
        .limit(1);
      const nextOrder = existing && existing.length > 0 ? Number(existing[0].order_index) + 1 : 0;

      const { data, error } = await supabase
        .from("workflow_statuses")
        .insert({
          workspace_id: ws.id,
          project_id: projectId,
          name: input.name,
          color: input.color ?? "#94a3b8",
          icon: input.icon ?? "circle",
          category: input.category,
          order_index: nextOrder,
          is_start: input.is_start ?? false,
          is_terminal: input.is_terminal ?? false,
          wip_limit: input.wip_limit ?? null,
          sla_hours: input.sla_hours ?? null,
          entry_criteria: (input.entry_criteria ?? []) as never,
          exit_criteria: (input.exit_criteria ?? []) as never,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return rowToStatus(data as Record<string, unknown>);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow", "statuses", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateWorkflowStatus(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<WorkflowStatus> & { id: string }) => {
      const { error } = await supabase
        .from("workflow_statuses")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow", "statuses", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteWorkflowStatus(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workflow_statuses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow", "statuses", projectId] });
      qc.invalidateQueries({ queryKey: ["workflow", "transitions", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReorderWorkflowStatuses(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Update each status's order_index. Done sequentially to avoid unique conflicts.
      // Since `unique(project_id, order_index)` was NOT added in this build, parallel-safe.
      await Promise.all(
        orderedIds.map((id, idx) =>
          supabase.from("workflow_statuses").update({ order_index: idx } as never).eq("id", id),
        ),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow", "statuses", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================================
// Transition mutations
// ============================================================================

export function useUpsertTransition(projectId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<WorkflowTransition> & { from_status_id: string; to_status_id: string }) => {
      if (!ws) throw new Error("No workspace");
      const payload = {
        workspace_id: ws.id,
        project_id: projectId,
        from_status_id: input.from_status_id,
        to_status_id: input.to_status_id,
        permission: input.permission ?? "anyone",
        allowed_role: input.allowed_role ?? null,
        gates: (input.gates ?? []) as never,
        actions: (input.actions ?? []) as never,
        button_label: input.button_label ?? null,
        confirmation_message: input.confirmation_message ?? null,
      };
      if (input.id) {
        const { error } = await supabase
          .from("workflow_transitions")
          .update(payload as never)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("workflow_transitions")
          .upsert(payload as never, { onConflict: "project_id,from_status_id,to_status_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow", "transitions", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTransition(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workflow_transitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow", "transitions", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================================
// Approvals
// ============================================================================

export function usePendingApprovalsForTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ["workflow", "approvals", taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<TransitionApproval[]> => {
      const { data, error } = await supabase
        .from("transition_approvals")
        .select("*")
        .eq("task_id", taskId!)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TransitionApproval[];
    },
  });
}

export function useMyPendingApprovals() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["workflow", "my-approvals", ws?.id],
    enabled: !!ws?.id,
    queryFn: async (): Promise<TransitionApproval[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("transition_approvals")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("approver_id", u.user.id)
        .eq("status", "pending")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TransitionApproval[];
    },
  });
}

export function useRequestApproval() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      task_id: string;
      transition_id: string;
      approver_ids: string[];
    }) => {
      if (!ws) throw new Error("No workspace");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const rows = input.approver_ids.map((aid) => ({
        workspace_id: ws.id,
        task_id: input.task_id,
        transition_id: input.transition_id,
        requested_by: u.user!.id,
        approver_id: aid,
        status: "pending" as const,
      }));
      const { error } = await supabase
        .from("transition_approvals")
        .upsert(rows as never, { onConflict: "task_id,transition_id,approver_id" });
      if (error) throw error;

      // Notify each approver
      const notifs = input.approver_ids
        .filter((aid) => aid !== u.user!.id)
        .map((aid) => ({
          workspace_id: ws.id,
          recipient_id: aid,
          actor_id: u.user!.id,
          type: "approval_requested",
          title: "Approval requested",
          body: "A status transition needs your approval.",
          link: null,
          task_id: input.task_id,
        }));
      if (notifs.length > 0) {
        await supabase.from("notifications").insert(notifs as never);
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["workflow", "approvals", vars.task_id] });
      qc.invalidateQueries({ queryKey: ["workflow", "my-approvals"] });
      toast.success("Approval requested");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: "approved" | "rejected"; comment?: string }) => {
      const { error } = await supabase
        .from("transition_approvals")
        .update({
          status: input.status,
          comment: input.comment ?? null,
          decided_at: new Date().toISOString(),
        } as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow", "approvals"] });
      qc.invalidateQueries({ queryKey: ["workflow", "my-approvals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================================
// History (for SLA aging)
// ============================================================================

export function useTaskStatusHistory(taskId: string | undefined) {
  return useQuery({
    queryKey: ["workflow", "history", taskId],
    enabled: !!taskId,
    queryFn: async (): Promise<TaskStatusHistoryRow[]> => {
      const { data, error } = await supabase
        .from("task_status_history")
        .select("*")
        .eq("task_id", taskId!)
        .order("entered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TaskStatusHistoryRow[];
    },
  });
}

/**
 * Fetches "current dwell time" per task in the project: how long each task
 * has been sitting in its current status. Used for SLA tinting on cards.
 */
export function useProjectDwellTimes(projectId: string | undefined) {
  return useQuery({
    queryKey: ["workflow", "dwell", projectId],
    enabled: !!projectId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Map<string, number>> => {
      // Pull the latest open history rows for this project's tasks.
      const { data: tasks, error: tErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("project_id", projectId!);
      if (tErr) throw tErr;
      const ids = (tasks ?? []).map((t) => t.id);
      if (ids.length === 0) return new Map();
      const { data, error } = await supabase
        .from("task_status_history")
        .select("task_id, entered_at, left_at")
        .in("task_id", ids)
        .is("left_at", null);
      if (error) throw error;
      const now = Date.now();
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        const enteredMs = new Date(row.entered_at as string).getTime();
        const hours = (now - enteredMs) / 3_600_000;
        const prev = map.get(row.task_id as string);
        if (prev === undefined || hours > prev) map.set(row.task_id as string, hours);
      }
      return map;
    },
  });
}
