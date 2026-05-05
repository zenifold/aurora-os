import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import type { Task } from "@/lib/types";
import { toast } from "sonner";

/** Fetch the entire descendant subtree of a parent task using hierarchy_path. */
export function useSubtasks(parentTaskId: string | null) {
  return useQuery({
    queryKey: ["subtasks", parentTaskId],
    enabled: !!parentTaskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .contains("hierarchy_path", [parentTaskId!])
        .order("position");
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useCreateSubtask(parent: Task) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: string | { title: string; parent_task_id?: string }) => {
      if (!ws || !user) throw new Error("Not signed in");
      const title = typeof input === "string" ? input : input.title;
      const parentId =
        typeof input === "string" ? parent.id : input.parent_task_id ?? parent.id;
      const { data: existing } = await supabase
        .from("tasks")
        .select("position")
        .eq("parent_task_id", parentId)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = existing && existing.length > 0 ? Number(existing[0].position) + 1000 : 0;
      const { error } = await supabase.from("tasks").insert({
        workspace_id: ws.id,
        project_id: parent.project_id,
        parent_task_id: parentId,
        title,
        status: "todo",
        position: nextPos,
        created_by: user.id,
        task_type: "task",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subtasks", parent.id] });
      qc.invalidateQueries({ queryKey: ["tasks", parent.project_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleSubtask(parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: done ? "done" : "todo",
          completed_at: done ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subtasks", parentId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSubtask(parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      const { error } = await supabase.from("tasks").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subtasks", parentId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReparentSubtask(parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, new_parent_id }: { id: string; new_parent_id: string }) => {
      // Position to the end of the new parent
      const { data: existing } = await supabase
        .from("tasks")
        .select("position")
        .eq("parent_task_id", new_parent_id)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = existing && existing.length > 0 ? Number(existing[0].position) + 1000 : 0;
      const { error } = await supabase
        .from("tasks")
        .update({ parent_task_id: new_parent_id, position: nextPos })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subtasks", parentId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReorderSubtask(parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, position }: { id: string; position: number }) => {
      const { error } = await supabase.from("tasks").update({ position }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subtasks", parentId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSubtask(parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subtasks", parentId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
