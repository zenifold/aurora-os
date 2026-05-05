import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { Milestone } from "@/lib/milestone-types";

export function useMilestones(projectId: string | undefined) {
  return useQuery({
    queryKey: ["milestones", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestones" as never)
        .select("*")
        .eq("project_id", projectId!)
        .order("target_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Milestone[];
    },
  });
}

export function useCreateMilestone(projectId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Milestone> & { name: string; target_date: string }) => {
      if (!ws) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("milestones" as never)
        .insert({
          workspace_id: ws.id,
          project_id: projectId,
          created_by: user?.id ?? null,
          ...input,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Milestone;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestones", projectId] });
      toast.success("Milestone created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateMilestone(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Milestone> & { id: string }) => {
      const { error } = await supabase
        .from("milestones" as never)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestones", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteMilestone(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("milestones" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestones", projectId] });
      toast.success("Milestone deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
