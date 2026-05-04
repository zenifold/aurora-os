import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import type { Filter, Sort, View } from "@/lib/types";
import { toast } from "sonner";

export function useViews(projectId: string | undefined) {
  return useQuery({
    queryKey: ["views", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("views")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as View[];
    },
  });
}

export function useCreateView(projectId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; filters?: Filter[]; sorts?: Sort[]; group_by?: string | null }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("views")
        .insert({
          workspace_id: ws.id,
          project_id: projectId,
          name: input.name,
          view_type: "table",
          filters: (input.filters ?? []) as never,
          sorts: (input.sorts ?? []) as never,
          group_by: input.group_by ?? null,
          config: {},
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", projectId] });
      toast.success("View saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateView(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; filters?: Filter[]; sorts?: Sort[]; group_by?: string | null }) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.filters !== undefined) dbPatch.filters = patch.filters;
      if (patch.sorts !== undefined) dbPatch.sorts = patch.sorts;
      if (patch.group_by !== undefined) dbPatch.group_by = patch.group_by;
      const { error } = await supabase.from("views").update(dbPatch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", projectId] });
    },
  });
}

export function useDeleteView(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("views").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", projectId] });
      toast.success("View deleted");
    },
  });
}
