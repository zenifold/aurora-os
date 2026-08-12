import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";

export interface DeliveryMetrics {
  wip: number;             // tasks currently in progress
  throughput7d: number;    // tasks completed in last 7 days
  throughput30d: number;   // tasks completed in last 30 days
  cycleTimeDays: number | null; // avg days from first in_progress -> done over last 30d
  onTimePct: number | null;     // % of completed tasks finished by due_date over last 30d
  completedRecent: number;
  overdue: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function useDeliveryMetrics() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery<DeliveryMetrics>({
    queryKey: ["delivery-metrics", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const since30 = new Date(Date.now() - 30 * DAY).toISOString();
      const since7 = new Date(Date.now() - 7 * DAY).toISOString();
      const today = new Date().toISOString().slice(0, 10);

      const [{ data: openTasks }, { data: doneTasks }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, status, due_date")
          .eq("workspace_id", ws!.id)
          .in("status", ["in_progress", "in_review"]),
        supabase
          .from("tasks")
          .select("id, status, due_date, completed_at, created_at")
          .eq("workspace_id", ws!.id)
          .eq("status", "done")
          .gte("completed_at", since30),
      ]);

      const openOverdue = (openTasks ?? []).filter(
        (t) => t.due_date && t.due_date < today,
      ).length;
      const wip = (openTasks ?? []).length;

      const recent = (doneTasks ?? []).filter(
        (t) => t.completed_at && t.completed_at >= since30,
      );
      const last7 = recent.filter((t) => (t.completed_at as string) >= since7).length;

      // On-time
      const withDue = recent.filter((t) => t.due_date && t.completed_at);
      const onTime = withDue.filter(
        (t) => (t.completed_at as string).slice(0, 10) <= (t.due_date as string),
      ).length;
      const onTimePct = withDue.length > 0 ? (onTime / withDue.length) * 100 : null;

      // Cycle time: created_at -> completed_at as approximation
      const cycles = recent
        .filter((t) => t.completed_at && t.created_at)
        .map(
          (t) =>
            (new Date(t.completed_at as string).getTime() -
              new Date(t.created_at as string).getTime()) /
            DAY,
        );
      const cycleTimeDays =
        cycles.length > 0
          ? cycles.reduce((a, b) => a + b, 0) / cycles.length
          : null;

      return {
        wip,
        throughput7d: last7,
        throughput30d: recent.length,
        cycleTimeDays,
        onTimePct,
        completedRecent: recent.length,
        overdue: openOverdue,
      };
    },
  });
}
