import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import type { Project } from "@/lib/types";
import { toast } from "sonner";

export function useProjects() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["projects", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data as Project;
    },
  });
}

export function useCreateProject() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; parent_id?: string | null; color?: string }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data: proj, error } = await supabase
        .from("projects")
        .insert({
          workspace_id: ws.id,
          name: input.name,
          parent_id: input.parent_id ?? null,
          color: input.color ?? "#8b5cf6",
          icon: "folder",
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Create a default table view
      await supabase.from("views").insert({
        workspace_id: ws.id,
        project_id: proj.id,
        name: "All tasks",
        view_type: "table",
        is_default: true,
        config: {},
        filters: [],
        sorts: [],
        created_by: user.id,
      });

      return proj as Project;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", ws?.id] });
      toast.success("Project created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateProject() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Project> & { id: string }) => {
      const { error } = await supabase.from("projects").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projects", ws?.id] });
      qc.invalidateQueries({ queryKey: ["project", vars.id] });
    },
  });
}

export function useDeleteProject() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", ws?.id] });
      toast.success("Project deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
