import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { CustomFieldDef, FieldType, SelectOption } from "@/lib/types";
import { toast } from "sonner";

export function useCustomFields() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["custom-fields", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_field_defs")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("order_index");
      if (error) throw error;
      return (data ?? []) as unknown as CustomFieldDef[];
    },
  });
}

export function useCreateCustomField() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; field_type: FieldType; options?: SelectOption[] }) => {
      if (!ws) throw new Error("No workspace");
      const { data: existing } = await supabase
        .from("custom_field_defs")
        .select("order_index")
        .eq("workspace_id", ws.id)
        .order("order_index", { ascending: false })
        .limit(1);
      const nextIdx = existing && existing.length > 0 ? existing[0].order_index + 1 : 0;
      const { data, error } = await supabase
        .from("custom_field_defs")
        .insert({
          workspace_id: ws.id,
          name: input.name,
          field_type: input.field_type,
          options: (input.options ?? null) as never,
          order_index: nextIdx,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-fields", ws?.id] });
      toast.success("Field added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCustomField() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_field_defs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-fields", ws?.id] });
      toast.success("Field removed");
    },
  });
}
