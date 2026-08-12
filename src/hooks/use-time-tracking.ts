import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";

export interface TimeLog {
  id: string;
  workspace_id: string;
  task_id: string;
  project_id: string;
  user_id: string;
  hours: number;
  log_date: string;
  description: string | null;
  is_billable: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActiveTimer {
  user_id: string;
  workspace_id: string;
  task_id: string;
  project_id: string;
  started_at: string;
  description: string | null;
  is_billable: boolean;
}

const TABLE_TIME_LOGS = "time_logs" as never;
const TABLE_ACTIVE_TIMERS = "active_timers" as never;

export function useTaskTimeLogs(taskId: string | null) {
  return useQuery({
    queryKey: ["time_logs", "task", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE_TIME_LOGS)
        .select("*")
        .eq("task_id", taskId!)
        .order("log_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TimeLog[];
    },
  });
}

export function useActiveTimer() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["active_timer", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE_ACTIVE_TIMERS)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ActiveTimer | null) ?? null;
    },
    refetchInterval: 60_000,
  });
}

export function useStartTimer() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const ws = useWorkspaceStore((s) => s.current);
  return useMutation({
    mutationFn: async (input: { taskId: string; projectId: string; description?: string; isBillable?: boolean }) => {
      if (!user || !ws) throw new Error("not ready");
      // upsert (one timer per user via PK)
      const { error } = await supabase.from(TABLE_ACTIVE_TIMERS).upsert({
        user_id: user.id,
        workspace_id: ws.id,
        task_id: input.taskId,
        project_id: input.projectId,
        started_at: new Date().toISOString(),
        description: input.description ?? null,
        is_billable: input.isBillable ?? true,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active_timer"] });
      toast.success("Timer started");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useStopTimer() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (timer: ActiveTimer) => {
      if (!user) throw new Error("not authenticated");
      const elapsedMs = Date.now() - new Date(timer.started_at).getTime();
      const hours = Math.max(0.0167, elapsedMs / (1000 * 60 * 60)); // min 1 minute
      const { error: insErr } = await supabase.from(TABLE_TIME_LOGS).insert({
        workspace_id: timer.workspace_id,
        task_id: timer.task_id,
        project_id: timer.project_id,
        user_id: timer.user_id,
        hours: Number(hours.toFixed(2)),
        log_date: new Date().toISOString().slice(0, 10),
        description: timer.description,
        is_billable: timer.is_billable,
      } as never);
      if (insErr) throw insErr;
      const { error: delErr } = await supabase.from(TABLE_ACTIVE_TIMERS).delete().eq("user_id", user.id);
      if (delErr) throw delErr;
      return hours;
    },
    onSuccess: (hours) => {
      qc.invalidateQueries({ queryKey: ["active_timer"] });
      qc.invalidateQueries({ queryKey: ["time_logs"] });
      toast.success(`Logged ${hours.toFixed(2)}h`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelTimer() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not authenticated");
      const { error } = await supabase.from(TABLE_ACTIVE_TIMERS).delete().eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active_timer"] });
      toast.success("Timer discarded");
    },
  });
}

export function useLogTime() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const ws = useWorkspaceStore((s) => s.current);
  return useMutation({
    mutationFn: async (input: {
      taskId: string;
      projectId: string;
      hours: number;
      logDate: string;
      description?: string;
      isBillable?: boolean;
    }) => {
      if (!user || !ws) throw new Error("not ready");
      if (!(input.hours > 0)) throw new Error("Hours must be greater than zero");
      const { error } = await supabase.from(TABLE_TIME_LOGS).insert({
        workspace_id: ws.id,
        task_id: input.taskId,
        project_id: input.projectId,
        user_id: user.id,
        hours: input.hours,
        log_date: input.logDate,
        description: input.description ?? null,
        is_billable: input.isBillable ?? true,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time_logs"] });
      toast.success("Time logged");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTimeLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE_TIME_LOGS).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time_logs"] });
      toast.success("Entry removed");
    },
  });
}

export function useMyWeekTimeLogs(weekStart: string, weekEndExclusive: string) {
  const { user } = useAuth();
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["time_logs", "week", user?.id, ws?.id, weekStart, weekEndExclusive],
    enabled: !!user?.id && !!ws?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE_TIME_LOGS)
        .select("*")
        .eq("user_id", user!.id)
        .eq("workspace_id", ws!.id)
        .gte("log_date", weekStart)
        .lt("log_date", weekEndExclusive);
      if (error) throw error;
      return (data ?? []) as unknown as TimeLog[];
    },
  });
}
