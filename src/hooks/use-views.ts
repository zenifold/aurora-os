import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import type { Filter, Sort, View, ViewConfig } from "@/lib/types";
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
        .order("position")
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
    mutationFn: async (input: { name: string; view_type?: View["view_type"]; filters?: Filter[]; sorts?: Sort[]; group_by?: string | null }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("views")
        .insert({
          workspace_id: ws.id,
          project_id: projectId,
          name: input.name,
          view_type: input.view_type ?? "table",
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
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; filters?: Filter[]; sorts?: Sort[]; group_by?: string | null; config?: ViewConfig; position?: number; is_default?: boolean }) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.filters !== undefined) dbPatch.filters = patch.filters;
      if (patch.sorts !== undefined) dbPatch.sorts = patch.sorts;
      if (patch.group_by !== undefined) dbPatch.group_by = patch.group_by;
      if (patch.config !== undefined) dbPatch.config = patch.config;
      if (patch.position !== undefined) dbPatch.position = patch.position;
      if (patch.is_default !== undefined) dbPatch.is_default = patch.is_default;
      const { error } = await supabase.from("views").update(dbPatch as never).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["views", projectId] });
      const prev = qc.getQueryData<View[]>(["views", projectId]);
      if (prev) {
        qc.setQueryData<View[]>(["views", projectId], prev.map((v) =>
          v.id === id ? { ...v, ...patch } as View : v
        ));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["views", projectId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["views", projectId] });
    },
  });
}

export function useReorderViews(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, idx) =>
          supabase.from("views").update({ position: idx } as never).eq("id", id)
        )
      );
    },
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: ["views", projectId] });
      const prev = qc.getQueryData<View[]>(["views", projectId]);
      if (prev) {
        const map = new Map(prev.map((v) => [v.id, v]));
        const next = orderedIds
          .map((id, idx) => {
            const v = map.get(id);
            return v ? { ...v, position: idx } : null;
          })
          .filter(Boolean) as View[];
        qc.setQueryData<View[]>(["views", projectId], next);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["views", projectId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["views", projectId] });
    },
  });
}

export function useSetDefaultView(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (viewId: string) => {
      // Clear other defaults in this project, then set this one
      await supabase
        .from("views")
        .update({ is_default: false } as never)
        .eq("project_id", projectId)
        .neq("id", viewId);
      const { error } = await supabase
        .from("views")
        .update({ is_default: true } as never)
        .eq("id", viewId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["views", projectId] });
      toast.success("Default view updated");
    },
    onError: (e: Error) => toast.error(e.message),
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
