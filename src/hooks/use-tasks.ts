import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import type { Task } from "@/lib/types";
import { toast } from "sonner";

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

export function useCreateTask(projectId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; status?: string }) => {
      if (!ws || !user) throw new Error("No workspace");
      // Get max position
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
      return data as Task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      const { error } = await supabase.from("tasks").update(patch as never).eq("id", id);
      if (error) throw error;
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
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });
}

export function useDeleteTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
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
