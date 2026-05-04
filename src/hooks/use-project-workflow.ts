import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_OPTIONS, type TaskStatus } from "@/lib/types";
import { toast } from "sonner";

export type StatusCategory = "todo" | "in_progress" | "done" | "cancelled";

export interface WorkflowStatus {
  id: string; // stable key used as task.status
  name: string;
  color: string; // CSS color (oklch / hex / var)
  category: StatusCategory;
  wip_limit: number | null;
}

export const DEFAULT_WORKFLOW: WorkflowStatus[] = STATUS_OPTIONS.map((s) => ({
  id: s.value,
  name: s.label,
  color: s.color,
  category:
    s.value === "todo" ? "todo"
    : s.value === "in_progress" ? "in_progress"
    : s.value === "review" ? "in_progress"
    : s.value === "done" ? "done"
    : "cancelled",
  wip_limit: null,
}));

interface ProjectSettings {
  status_workflow?: WorkflowStatus[] | null;
}

/**
 * Returns the resolved status workflow for a project (custom or default).
 */
export function useProjectWorkflow(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-workflow", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<WorkflowStatus[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("settings")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      const settings = (data?.settings ?? {}) as ProjectSettings;
      const wf = settings.status_workflow;
      if (Array.isArray(wf) && wf.length > 0) return wf;
      return DEFAULT_WORKFLOW;
    },
  });
}

export function useUpdateProjectWorkflow(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workflow: WorkflowStatus[]) => {
      // Read settings, merge, write back
      const { data, error: readErr } = await supabase
        .from("projects")
        .select("settings")
        .eq("id", projectId)
        .single();
      if (readErr) throw readErr;
      const settings = (data?.settings ?? {}) as ProjectSettings;
      const next = { ...settings, status_workflow: workflow };
      const { error } = await supabase
        .from("projects")
        .update({ settings: next as never })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-workflow", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Workflow saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Helper: lookup a status by id with safe fallback. */
export function findStatus(workflow: WorkflowStatus[], id: string): WorkflowStatus | undefined {
  return workflow.find((s) => s.id === id) ?? DEFAULT_WORKFLOW.find((s) => s.id === id);
}

export function isDoneStatus(workflow: WorkflowStatus[], id: TaskStatus | string): boolean {
  const s = findStatus(workflow, id);
  return s?.category === "done";
}
