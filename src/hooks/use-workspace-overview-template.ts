import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateWorkspaceOverviewTemplate } from "@/server/overview.functions";
import { DEFAULT_OVERVIEW_SECTIONS, type OverviewSectionDef } from "@/lib/overview-types";

export function useWorkspaceOverviewTemplate(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace-overview-template", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<OverviewSectionDef[]> => {
      const { data } = await supabase
        .from("workspace_overview_templates" as never)
        .select("sections")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      const row = data as { sections: OverviewSectionDef[] } | null;
      return row?.sections && row.sections.length > 0 ? row.sections : DEFAULT_OVERVIEW_SECTIONS;
    },
  });
}

export function useUpdateWorkspaceOverviewTemplate(workspaceId: string) {
  const fn = useServerFn(updateWorkspaceOverviewTemplate);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sections: OverviewSectionDef[]) => {
      const res = await fn({ data: { workspace_id: workspaceId, sections } });
      if (res && typeof res === "object" && "error" in res) {
        throw new Error(String((res as { error: unknown }).error));
      }
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-overview-template", workspaceId] }),
  });
}
