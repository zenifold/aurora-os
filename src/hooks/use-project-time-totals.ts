import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectTimeTotals {
  /** Total hours logged per task. */
  totals: Map<string, number>;
}

/**
 * Aggregates time_logs hours per task for a project. Single round-trip,
 * shared across rows so the table doesn't fan out N queries.
 */
export function useProjectTimeTotals(projectId: string | undefined) {
  return useQuery({
    queryKey: ["time_logs", "project-totals", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectTimeTotals> => {
      const { data, error } = await supabase
        .from("time_logs")
        .select("task_id, hours")
        .eq("project_id", projectId!);
      if (error) throw error;
      const totals = new Map<string, number>();
      for (const row of (data ?? []) as Array<{ task_id: string; hours: number | string }>) {
        const prev = totals.get(row.task_id) ?? 0;
        totals.set(row.task_id, prev + Number(row.hours || 0));
      }
      return { totals };
    },
  });
}
