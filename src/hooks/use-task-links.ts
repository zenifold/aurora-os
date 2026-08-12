import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TaskLink {
  id: string;
  task_id: string;
  link_kind: "page" | "plan" | "canvas" | "document" | "task";
  target_id: string;
  label: string | null;
  created_at: string;
  target?: { title: string; icon: string | null; page_type?: string | null };
}

export function useTaskLinks(taskId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["task-links", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_links")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const links = (data ?? []) as unknown as TaskLink[];
      const pageIds = links
        .filter((l) => ["page", "plan", "canvas"].includes(l.link_kind))
        .map((l) => l.target_id);
      if (pageIds.length) {
        const { data: pages } = await supabase
          .from("pages")
          .select("id, title, icon, page_type")
          .in("id", pageIds);
        const map = new Map((pages ?? []).map((p) => [p.id, p]));
        for (const l of links) {
          const p = map.get(l.target_id);
          if (p) l.target = { title: p.title, icon: p.icon, page_type: p.page_type };
        }
      }
      return links;
    },
  });

  useEffect(() => {
    if (!taskId) return;
    const channel = supabase
      .channel(`task-links-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_links", filter: `task_id=eq.${taskId}` },
        () => qc.invalidateQueries({ queryKey: ["task-links", taskId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [taskId, qc]);

  return query;
}

export function useUnlinkFromTask(taskId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-links", taskId] }),
  });
}
