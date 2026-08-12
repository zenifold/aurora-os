import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { CustomRecord } from "@/lib/object-types";

export function useCustomRecords(objectTypeId: string | null) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["custom-records", ws?.id, objectTypeId],
    enabled: !!ws && !!objectTypeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_records")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("object_type_id", objectTypeId!)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CustomRecord[];
    },
  });
}

export function useCreateCustomRecord() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      object_type_id: string;
      title: string;
      status?: string | null;
      owner_id?: string | null;
      project_id?: string | null;
      values?: Record<string, unknown>;
      tags?: string[];
    }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("custom_records")
        .insert({
          workspace_id: ws.id,
          object_type_id: input.object_type_id,
          title: input.title,
          status: input.status ?? null,
          owner_id: input.owner_id ?? null,
          project_id: input.project_id ?? null,
          values: (input.values ?? {}) as never,
          tags: input.tags ?? null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CustomRecord;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["custom-records", ws?.id, vars.object_type_id] });
      toast.success("Record created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCustomRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CustomRecord> & { id: string }) => {
      const { error } = await supabase
        .from("custom_records")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-records"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCustomRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-records"] });
      toast.success("Record removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
