import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import type { Task } from "@/lib/types";
import { toast } from "sonner";
import { useTriggerAutomations } from "@/hooks/use-automations";

export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

const TRACKED_FIELDS = new Set([
  "title",
  "status",
  "priority",
  "due_date",
  "start_date",
  "description",
  "assignee_ids",
]);

async function logActivity(input: {
  workspace_id: string;
  actor_id: string | null;
  entity_id: string;
  action: "created" | "updated" | "deleted";
  changes?: Record<string, unknown> | null;
}) {
  await supabase.from("activity_log").insert({
    workspace_id: input.workspace_id,
    actor_id: input.actor_id,
    entity_type: "task",
    entity_id: input.entity_id,
    action: input.action,
    changes: (input.changes ?? null) as never,
  });
}

export function useCreateTask(projectId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  const triggerAutomations = useTriggerAutomations();
  return useMutation({
    mutationFn: async (input: { title: string; status?: string }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data: existing } = await supabase
        .from("tasks")
        .select("position")
        .eq("project_id", projectId)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = existing && existing.length > 0 ? Number(existing[0].position) + 1000 : 0;

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          workspace_id: ws.id,
          project_id: projectId,
          title: input.title,
          status: input.status ?? "todo",
          position: nextPos,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      await logActivity({
        workspace_id: ws.id,
        actor_id: user.id,
        entity_id: (data as Task).id,
        action: "created",
        changes: { title: { to: input.title } },
      });
      void triggerAutomations({ task_id: (data as Task).id, event: "task.created" });
      return data as Task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTask(projectId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  const triggerAutomations = useTriggerAutomations();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      const prev = qc.getQueryData<Task[]>(["tasks", projectId])?.find((t) => t.id === id);
      const { error } = await supabase.from("tasks").update(patch as never).eq("id", id);
      if (error) throw error;

      if (ws && user) {
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        for (const [k, v] of Object.entries(patch)) {
          if (!TRACKED_FIELDS.has(k)) continue;
          const from = prev ? (prev as unknown as Record<string, unknown>)[k] : undefined;
          if (JSON.stringify(from) === JSON.stringify(v)) continue;
          changes[k] = { from: k === "description" ? "…" : from, to: k === "description" ? "…" : v };
        }
        if (Object.keys(changes).length > 0) {
          await logActivity({
            workspace_id: ws.id,
            actor_id: user.id,
            entity_id: id,
            action: "updated",
            changes,
          });
        }
      }

      // Trigger automations
      const statusChanged = "status" in patch && prev && prev.status !== patch.status;
      const event = statusChanged ? "task.status_changed" : "task.updated";
      const prevSnapshot = prev ? (prev as unknown as Record<string, unknown>) : null;
      void triggerAutomations({ task_id: id, event, prev: prevSnapshot });
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["tasks", projectId] });
      const prev = qc.getQueryData<Task[]>(["tasks", projectId]);
      qc.setQueryData<Task[]>(["tasks", projectId], (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, ...patch } as Task : t))
      );
      return { prev };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks", projectId], ctx.prev);
      toast.error(e.message);
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["task", vars.id] });
      qc.invalidateQueries({ queryKey: ["activity", "task", vars.id] });
    },
  });
}

export function useDeleteTask(projectId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (ws && user) {
        await logActivity({ workspace_id: ws.id, actor_id: user.id, entity_id: id, action: "deleted" });
      }
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      toast.success("Task deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBulkUpdateTasks(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<Task> }) => {
      const { error } = await supabase.from("tasks").update(patch as never).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      toast.success(`Updated ${vars.ids.length} tasks`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
