import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivityEntry {
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

export function useTaskActivity(taskId: string | null) {
  return useQuery({
    queryKey: ["activity", "task", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("entity_type", "task")
        .eq("entity_id", taskId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const rows = (data ?? []) as ActivityEntry[];
      const ids = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[]));
      if (ids.length === 0) return rows;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, actor: r.actor_id ? byId.get(r.actor_id) ?? undefined : undefined }));
    },
  });
}
