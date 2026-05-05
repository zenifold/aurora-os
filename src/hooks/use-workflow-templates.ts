import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import type { WorkflowTemplate } from "@/lib/workflow-templates";

/**
 * Replace a project's workflow with a template: deletes existing
 * statuses & transitions, then inserts the template's statuses + transitions.
 *
 * Existing tasks keep their `status` text value but their `workflow_status_id`
 * reference will be cleared (the FK cascade nulls it on status delete).
 */
export function useApplyWorkflowTemplate(projectId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: WorkflowTemplate) => {
      if (!ws) throw new Error("No workspace");

      // 1. Delete existing transitions then statuses (transitions FK statuses)
      await supabase.from("workflow_transitions").delete().eq("project_id", projectId);
      await supabase.from("workflow_statuses").delete().eq("project_id", projectId);

      // 2. Insert statuses
      const statusRows = template.statuses.map((s, idx) => ({
        workspace_id: ws.id,
        project_id: projectId,
        name: s.name,
        color: s.color,
        category: s.category,
        order_index: idx,
        is_start: s.is_start ?? idx === 0,
        is_terminal: s.is_terminal ?? false,
        wip_limit: s.wip_limit ?? null,
        sla_hours: s.sla_hours ?? null,
        entry_criteria: [],
        exit_criteria: s.exit_criteria ?? [],
      }));
      const { data: inserted, error: sErr } = await supabase
        .from("workflow_statuses")
        .insert(statusRows as never)
        .select();
      if (sErr) throw sErr;
      const idxToId = new Map<number, string>();
      (inserted ?? []).forEach((r, i) => idxToId.set(i, (r as { id: string }).id));

      // 3. Insert transitions
      const transitions = template.transitions ?? defaultAllPairs(template.statuses.length);
      const txRows = transitions
        .filter((t) => idxToId.has(t.from) && idxToId.has(t.to))
        .map((t) => ({
          workspace_id: ws.id,
          project_id: projectId,
          from_status_id: idxToId.get(t.from)!,
          to_status_id: idxToId.get(t.to)!,
          permission: t.permission ?? "anyone",
          gates: (t.gates ?? []) as never,
          actions: [] as never,
          button_label: t.button_label ?? null,
        }));
      if (txRows.length > 0) {
        const { error: tErr } = await supabase
          .from("workflow_transitions")
          .insert(txRows as never);
        if (tErr) throw tErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow", "statuses", projectId] });
      qc.invalidateQueries({ queryKey: ["workflow", "transitions", projectId] });
      toast.success("Workflow applied");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function defaultAllPairs(n: number): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) out.push({ from: i, to: j });
    }
  }
  return out;
}

/**
 * Seed a project with the default workflow if it has none yet.
 * Idempotent — safe to call from project creation.
 */
export async function seedDefaultWorkflow(workspaceId: string, projectId: string) {
  const { count } = await supabase
    .from("workflow_statuses")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if ((count ?? 0) > 0) return;

  const defaults = [
    { name: "Todo", category: "todo" as const, color: "#94a3b8", is_start: true },
    { name: "In Progress", category: "in_progress" as const, color: "#3b82f6" },
    { name: "Done", category: "done" as const, color: "#10b981", is_terminal: true },
  ];
  const rows = defaults.map((s, idx) => ({
    workspace_id: workspaceId,
    project_id: projectId,
    name: s.name,
    color: s.color,
    category: s.category,
    order_index: idx,
    is_start: s.is_start ?? false,
    is_terminal: s.is_terminal ?? false,
    entry_criteria: [],
    exit_criteria: [],
  }));
  const { data: inserted } = await supabase
    .from("workflow_statuses")
    .insert(rows as never)
    .select();
  // All-pairs transitions
  if (inserted && inserted.length > 0) {
    const ids = inserted.map((r) => (r as { id: string }).id);
    const tx: Record<string, unknown>[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids.length; j++) {
        if (i !== j) {
          tx.push({
            workspace_id: workspaceId,
            project_id: projectId,
            from_status_id: ids[i],
            to_status_id: ids[j],
            permission: "anyone",
            gates: [],
            actions: [],
          });
        }
      }
    }
    if (tx.length > 0) {
      await supabase.from("workflow_transitions").insert(tx as never);
    }
  }
}
