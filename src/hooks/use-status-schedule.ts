import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getStatusSchedule,
  upsertStatusSchedule,
  deleteStatusSchedule,
  type StatusScheduleInput,
} from "@/server/status-schedules.functions";

export interface StatusSchedule {
  id: string;
  workspace_id: string;
  project_id: string;
  cadence: "weekly" | "biweekly" | "monthly";
  day_of_week: number;
  hour_utc: number;
  visibility: "internal" | "client" | "both";
  auto_publish: boolean;
  active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status_update_id: string | null;
  last_error: string | null;
}

export function useStatusSchedule(projectId: string) {
  const fn = useServerFn(getStatusSchedule);
  return useQuery({
    queryKey: ["status-schedule", projectId],
    queryFn: async () => {
      const r = await fn({ data: { project_id: projectId } });
      if ("error" in r) throw new Error(r.error);
      return (r.schedule as unknown as StatusSchedule | null) ?? null;
    },
    enabled: !!projectId,
  });
}

export function useUpsertStatusSchedule(projectId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(upsertStatusSchedule);
  return useMutation({
    mutationFn: async (input: StatusScheduleInput) => {
      const r = await fn({ data: input });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["status-schedule", projectId] }),
  });
}

export function useDeleteStatusSchedule(projectId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(deleteStatusSchedule);
  return useMutation({
    mutationFn: async () => {
      const r = await fn({ data: { project_id: projectId } });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["status-schedule", projectId] }),
  });
}
