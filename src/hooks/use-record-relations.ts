// Block A · Phase 5 — cross-object record relations.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { CustomRecord } from "@/lib/object-types";

export type RecordRelation = {
  id: string;
  workspace_id: string;
  from_record_id: string;
  to_record_id: string;
  relation_key: string;
  created_by: string | null;
  created_at: string;
};

export type RelatedRecord = RecordRelation & {
  direction: "outgoing" | "incoming";
  other: CustomRecord;
};

/** Fetch all relations involving the given record (both directions). */
export function useRecordRelations(recordId: string | null) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["record-relations", ws?.id, recordId],
    enabled: !!ws && !!recordId,
    queryFn: async () => {
      const [out, inc] = await Promise.all([
        supabase
          .from("custom_record_relations")
          .select("*, to:custom_records!custom_record_relations_to_record_id_fkey(*)")
          .eq("workspace_id", ws!.id)
          .eq("from_record_id", recordId!),
        supabase
          .from("custom_record_relations")
          .select("*, from:custom_records!custom_record_relations_from_record_id_fkey(*)")
          .eq("workspace_id", ws!.id)
          .eq("to_record_id", recordId!),
      ]);
      if (out.error) throw out.error;
      if (inc.error) throw inc.error;
      const outgoing: RelatedRecord[] = (out.data ?? []).map((r) => ({
        ...(r as unknown as RecordRelation),
        direction: "outgoing",
        other: (r as unknown as { to: CustomRecord }).to,
      }));
      const incoming: RelatedRecord[] = (inc.data ?? []).map((r) => ({
        ...(r as unknown as RecordRelation),
        direction: "incoming",
        other: (r as unknown as { from: CustomRecord }).from,
      }));
      return [...outgoing, ...incoming].filter((r) => r.other);
    },
  });
}

export function useSearchRecords(query: string, excludeId: string | null) {
  const ws = useWorkspaceStore((s) => s.current);
  const q = query.trim();
  return useQuery({
    queryKey: ["record-search", ws?.id, q, excludeId],
    enabled: !!ws && q.length >= 1,
    queryFn: async () => {
      let req = supabase
        .from("custom_records")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false)
        .ilike("title", `%${q}%`)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (excludeId) req = req.neq("id", excludeId);
      const { data, error } = await req;
      if (error) throw error;
      return (data ?? []) as unknown as CustomRecord[];
    },
  });
}

export function useAddRecordRelation() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      from_record_id: string;
      to_record_id: string;
      relation_key?: string;
    }) => {
      if (!ws) throw new Error("No workspace");
      const { error } = await supabase.from("custom_record_relations").insert({
        workspace_id: ws.id,
        from_record_id: input.from_record_id,
        to_record_id: input.to_record_id,
        relation_key: input.relation_key ?? "relates_to",
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["record-relations", ws?.id, vars.from_record_id] });
      qc.invalidateQueries({ queryKey: ["record-relations", ws?.id, vars.to_record_id] });
      toast.success("Linked");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveRecordRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("custom_record_relations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["record-relations"] });
      toast.success("Unlinked");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
