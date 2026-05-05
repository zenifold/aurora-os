import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { Sprint, SprintTask } from "@/lib/sprint-types";

export function useSprints(projectId: string | undefined) {
  return useQuery({
    queryKey: ["sprints", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sprints" as never)
        .select("*")
        .eq("project_id", projectId!)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Sprint[];
    },
  });
}

export function useSprintTasks(sprintId: string | undefined) {
  return useQuery({
    queryKey: ["sprint_tasks", sprintId],
    enabled: !!sprintId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sprint_tasks" as never)
        .select("*")
        .eq("sprint_id", sprintId!);
      if (error) throw error;
      return (data ?? []) as unknown as SprintTask[];
    },
  });
}

export function useCreateSprint(projectId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      goal?: string | null;
      start_date: string;
      end_date: string;
      capacity_hours?: number | null;
      capacity_points?: number | null;
    }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("sprints" as never)
        .insert({
          workspace_id: ws.id,
          project_id: projectId,
          name: input.name,
          goal: input.goal ?? null,
          start_date: input.start_date,
          end_date: input.end_date,
          capacity_hours: input.capacity_hours ?? null,
          capacity_points: input.capacity_points ?? null,
          created_by: user.id,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Sprint;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints", projectId] });
      toast.success("Sprint created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSprint(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Sprint> & { id: string }) => {
      const { error } = await supabase
        .from("sprints" as never)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSprint(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sprints" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints", projectId] });
      toast.success("Sprint deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddTaskToSprint(sprintId: string, projectId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { task_id: string; is_committed?: boolean }) => {
      if (!ws) throw new Error("No workspace");
      const { error } = await supabase.from("sprint_tasks" as never).insert({
        sprint_id: sprintId,
        task_id: input.task_id,
        workspace_id: ws.id,
        added_by: user?.id ?? null,
        is_committed: input.is_committed ?? true,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint_tasks", sprintId] });
      qc.invalidateQueries({ queryKey: ["sprints", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveTaskFromSprint(sprintId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("sprint_tasks" as never)
        .delete()
        .eq("sprint_id", sprintId)
        .eq("task_id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint_tasks", sprintId] });
      qc.invalidateQueries({ queryKey: ["sprints", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
