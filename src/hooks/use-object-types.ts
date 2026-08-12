import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import type { ObjectType, ObjectFieldDef, ExtendedFieldType } from "@/lib/object-types";
import type { SelectOption } from "@/lib/types";

export function useObjectTypes(opts: { includeArchived?: boolean } = {}) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["object-types", ws?.id, opts.includeArchived ?? false],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("object_types")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("sort_order");
      if (!opts.includeArchived) q = q.eq("is_archived", false);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ObjectType[];
    },
  });
}

export function useObjectTypeByKey(key: string | undefined) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["object-type-by-key", ws?.id, key],
    enabled: !!ws && !!key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("object_types")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("key", key!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ObjectType | null;
    },
  });
}

export function useCreateObjectType() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      key: string;
      label: string;
      plural_label: string;
      icon?: string | null;
      color?: string | null;
      description?: string | null;
    }) => {
      if (!ws) throw new Error("No workspace");
      const { data: existing } = await supabase
        .from("object_types")
        .select("sort_order")
        .eq("workspace_id", ws.id)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextIdx = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;
      const { data, error } = await supabase
        .from("object_types")
        .insert({
          workspace_id: ws.id,
          key: input.key.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          label: input.label,
          plural_label: input.plural_label,
          icon: input.icon ?? "box",
          color: input.color ?? "#8b5cf6",
          description: input.description ?? null,
          system_kind: "custom",
          is_system: false,
          sort_order: nextIdx,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ObjectType;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["object-types"] });
      toast.success("Object type created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateObjectType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ObjectType> & { id: string }) => {
      const { error } = await supabase
        .from("object_types")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["object-types"] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteObjectType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("object_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["object-types"] });
      toast.success("Object type removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// --- Fields scoped to an object type --------------------------------------

export function useObjectFields(objectTypeId: string | null) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["object-fields", ws?.id, objectTypeId],
    enabled: !!ws && !!objectTypeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_field_defs")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("object_type_id", objectTypeId!)
        .order("order_index");
      if (error) throw error;
      return (data ?? []) as unknown as ObjectFieldDef[];
    },
  });
}

export function useCreateObjectField() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      object_type_id: string;
      name: string;
      field_type: ExtendedFieldType;
      options?: SelectOption[];
      help_text?: string;
      is_required?: boolean;
      is_visible_in_table?: boolean;
      formula_expr?: string;
    }) => {
      if (!ws) throw new Error("No workspace");
      const { data: existing } = await supabase
        .from("custom_field_defs")
        .select("order_index")
        .eq("workspace_id", ws.id)
        .eq("object_type_id", input.object_type_id)
        .order("order_index", { ascending: false })
        .limit(1);
      const nextIdx = existing && existing.length > 0 ? existing[0].order_index + 1 : 0;
      const { data, error } = await supabase
        .from("custom_field_defs")
        .insert({
          workspace_id: ws.id,
          object_type_id: input.object_type_id,
          name: input.name,
          field_type: input.field_type as never,
          options: (input.options ?? null) as never,
          help_text: input.help_text ?? null,
          is_required: input.is_required ?? false,
          is_visible_in_table: input.is_visible_in_table ?? true,
          formula_expr: input.formula_expr ?? null,
          order_index: nextIdx,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ObjectFieldDef;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["object-fields", ws?.id, vars.object_type_id] });
      toast.success("Field added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteObjectField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_field_defs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["object-fields"] });
      toast.success("Field removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
