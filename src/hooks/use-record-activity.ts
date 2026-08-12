// Block A · Phase 4 — activity log for custom records.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";

export type ActivityEntry = {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: Record<string, unknown> | null;
  created_at: string;
};

export function useRecordActivity(recordId: string | null) {
  return useQuery({
    queryKey: ["record-activity", recordId],
    enabled: !!recordId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("entity_type", "custom_record")
        .eq("entity_id", recordId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ActivityEntry[];
    },
  });
}

export function useLogActivity() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      entity_type: string;
      entity_id: string;
      action: string;
      changes?: Record<string, unknown>;
    }) => {
      if (!ws) return;
      await supabase.from("activity_log").insert({
        workspace_id: ws.id,
        actor_id: user?.id ?? null,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        action: input.action,
        changes: (input.changes ?? null) as never,
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["record-activity", vars.entity_id] });
    },
  });
}
