import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";

export interface WorkspaceActivityEntry {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: Record<string, unknown> | null;
  created_at: string;
  actor?: { id: string; display_name: string | null; avatar_url: string | null };
}

export interface WorkspaceActivityFilters {
  entityTypes?: string[];
  actorId?: string | null;
  limit?: number;
}

export function useWorkspaceActivity(filters: WorkspaceActivityFilters = {}) {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  const { entityTypes, actorId, limit = 100 } = filters;

  const query = useQuery({
    queryKey: ["workspace-activity", ws?.id, entityTypes, actorId, limit],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("activity_log")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (entityTypes && entityTypes.length > 0) q = q.in("entity_type", entityTypes);
      if (actorId) q = q.eq("actor_id", actorId);
      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as WorkspaceActivityEntry[];
      const ids = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[]));
      if (ids.length === 0) return rows;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        actor: r.actor_id ? byId.get(r.actor_id) ?? undefined : undefined,
      }));
    },
  });

  useEffect(() => {
    if (!ws) return;
    const ch = supabase
      .channel(`activity:${ws.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log", filter: `workspace_id=eq.${ws.id}` },
        () => qc.invalidateQueries({ queryKey: ["workspace-activity", ws.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [ws, qc]);

  return query;
}
