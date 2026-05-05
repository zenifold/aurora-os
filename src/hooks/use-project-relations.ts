import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RelationType } from "@/lib/types";

export interface DependencyEdge {
  id: string;
  from: string; // predecessor (must finish first)
  to: string; // successor (waits)
  lagDays: number;
}

const key = (projectId: string) => ["project-dependency-edges", projectId];

/** Returns normalized blocks-style edges (from = predecessor, to = successor). */
export function useProjectDependencyEdges(projectId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: key(projectId ?? ""),
    enabled: !!projectId,
    queryFn: async () => {
      const { data: ts, error: tErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("project_id", projectId!);
      if (tErr) throw tErr;
      const ids = (ts ?? []).map((t: { id: string }) => t.id);
      if (ids.length === 0) return [] as DependencyEdge[];

      const { data: rels, error: rErr } = await supabase
        .from("task_relations")
        .select("id, source_task_id, target_task_id, relation_type, lag_days")
        .in("relation_type", ["blocks", "blocked_by"])
        .or(`source_task_id.in.(${ids.join(",")}),target_task_id.in.(${ids.join(",")})`);
      if (rErr) throw rErr;

      const edges: DependencyEdge[] = (rels ?? []).map(
        (r: {
          id: string;
          source_task_id: string;
          target_task_id: string;
          relation_type: RelationType;
          lag_days: number | null;
        }) => {
          // Normalize "blocked_by" so from = predecessor
          const from = r.relation_type === "blocks" ? r.source_task_id : r.target_task_id;
          const to = r.relation_type === "blocks" ? r.target_task_id : r.source_task_id;
          return { id: r.id, from, to, lagDays: r.lag_days ?? 0 };
        },
      );
      // Dedupe identical from->to
      const seen = new Map<string, DependencyEdge>();
      for (const e of edges) {
        const k = `${e.from}->${e.to}`;
        if (!seen.has(k)) seen.set(k, e);
      }
      return Array.from(seen.values());
    },
  });

  useEffect(() => {
    if (!projectId) return;
    const ch = supabase
      .channel(`project-deps:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_relations" },
        () => qc.invalidateQueries({ queryKey: key(projectId) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [projectId, qc]);

  return query;
}
