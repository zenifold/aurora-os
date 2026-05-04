import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import type { Task } from "@/lib/types";
import { toast } from "sonner";

export function useSubtasks(parentTaskId: string | null) {
  return useQuery({
    queryKey: ["subtasks", parentTaskId],
    enabled: !!parentTaskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("parent_task_id", parentTaskId!)
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
    mutationFn: async (title: string) => {
      if (!ws || !user) throw new Error("Not signed in");
      const { data: existing } = await supabase
        .from("tasks")
        .select("position")
        .eq("parent_task_id", parent.id)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = existing && existing.length > 0 ? Number(existing[0].position) + 1000 : 0;
      const { error } = await supabase.from("tasks").insert({
        workspace_id: ws.id,
        project_id: parent.project_id,
        parent_task_id: parent.id,
        title,
        status: "todo",
        position: nextPos,
        created_by: user.id,
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
