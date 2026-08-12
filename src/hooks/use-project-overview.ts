import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getProjectOverview,
  refreshProjectOverview,
  updateProjectOverviewSettings,
} from "@/server/overview.functions";
import type {
  OverviewSectionDef,
  OverviewSnapshot,
  ProjectOverview,
  RefreshCadence,
  WorkspaceOverviewTemplate,
} from "@/lib/overview-types";

export function useProjectOverview(projectId: string | undefined) {
  const fn = useServerFn(getProjectOverview);
  return useQuery({
    queryKey: ["project-overview", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await fn({ data: { project_id: projectId! } });
      if ("error" in res) throw new Error(res.error);
      return res as {
        ok: true;
        template: WorkspaceOverviewTemplate["sections"];
        overview: ProjectOverview;
        snapshots: OverviewSnapshot[];
      };
    },
  });
}

export function useRefreshProjectOverview(projectId: string) {
  const fn = useServerFn(refreshProjectOverview);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fn({ data: { project_id: projectId } });
      if ("error" in res) throw new Error(res.error);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-overview", projectId] }),
  });
}

export function useUpdateProjectOverviewSettings(projectId: string) {
  const fn = useServerFn(updateProjectOverviewSettings);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: {
      refresh_cadence?: RefreshCadence;
      sections_override?: OverviewSectionDef[] | null;
    }) => {
      const res = await fn({ data: { project_id: projectId, ...patch } });
      if ("error" in res) throw new Error(res.error);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-overview", projectId] }),
  });
}
