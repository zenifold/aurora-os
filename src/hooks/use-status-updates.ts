import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  aiDraftStatusUpdate,
  deleteStatusUpdate,
  getStatusUpdate,
  listProjectCsat,
  listStatusUpdates,
  publishStatusUpdate,
  saveStatusUpdate,
  type StatusUpdateInput,
} from "@/server/status-updates.functions";

export type StatusHealth = "on_track" | "at_risk" | "off_track" | "complete";

export interface StatusUpdateListItem {
  id: string;
  period_start: string | null;
  period_end: string | null;
  health: StatusHealth;
  headline: string | null;
  summary: string | null;
  status: "draft" | "published";
  visibility: "internal" | "client" | "both";
  ai_generated: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useStatusUpdates(projectId: string) {
  const fn = useServerFn(listStatusUpdates);
  return useQuery({
    queryKey: ["status-updates", projectId],
    queryFn: async () => {
      const r = await fn({ data: { project_id: projectId } });
      if ("error" in r) throw new Error(r.error);
      return r.updates as StatusUpdateListItem[];
    },
    enabled: !!projectId,
  });
}

export function useStatusUpdate(projectId: string, id: string | null) {
  const fn = useServerFn(getStatusUpdate);
  return useQuery({
    queryKey: ["status-update", projectId, id],
    queryFn: async () => {
      if (!id) return null;
      const r = await fn({ data: { id, project_id: projectId } });
      if ("error" in r) throw new Error(r.error);
      return r.update as Record<string, unknown>;
    },
    enabled: !!projectId && !!id,
  });
}

export function useSaveStatusUpdate(projectId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(saveStatusUpdate);
  return useMutation({
    mutationFn: async (input: StatusUpdateInput) => {
      const r = await fn({ data: input });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status-updates", projectId] });
    },
  });
}

export function usePublishStatusUpdate(projectId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(publishStatusUpdate);
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fn({ data: { id, project_id: projectId } });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status-updates", projectId] });
    },
  });
}

export function useDeleteStatusUpdate(projectId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(deleteStatusUpdate);
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fn({ data: { id, project_id: projectId } });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status-updates", projectId] });
    },
  });
}

export function useAiDraftStatusUpdate() {
  const fn = useServerFn(aiDraftStatusUpdate);
  return useMutation({
    mutationFn: async (input: { project_id: string; period_start?: string; period_end?: string }) => {
      const r = await fn({ data: input });
      if ("error" in r) throw new Error(r.error);
      return r.draft;
    },
  });
}

export function useProjectCsat(projectId: string) {
  const fn = useServerFn(listProjectCsat);
  return useQuery({
    queryKey: ["project-csat", projectId],
    queryFn: async () => {
      const r = await fn({ data: { project_id: projectId, limit: 50 } });
      if ("error" in r) throw new Error(r.error);
      return {
        responses: r.responses as Array<{
          id: string;
          score: number;
          comment: string | null;
          source: string;
          respondent_name: string | null;
          respondent_email: string | null;
          milestone_id: string | null;
          status_update_id: string | null;
          created_at: string;
        }>,
        avg: r.avg as number | null,
        count: r.count as number,
      };
    },
    enabled: !!projectId,
  });
}
