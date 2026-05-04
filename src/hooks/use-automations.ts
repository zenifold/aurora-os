import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { triggerTaskAutomations } from "@/server/automations.functions";

export type AutomationCondition = {
  field: string;
  op: "eq" | "neq" | "contains" | "in" | "is_empty" | "is_not_empty" | "changed_to";
  value?: unknown;
};

export type ApplyAction = "comment" | "description_append" | "tag" | "none";

export interface AiAutomation {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_event: "task.created" | "task.updated" | "task.status_changed";
  conditions: AutomationCondition[];
  agent_id: string;
  instructions_template: string | null;
  apply_action: ApplyAction;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
}

export interface AutomationRun {
  id: string;
  automation_id: string;
  task_id: string | null;
  status: string;
  trigger_event: string | null;
  output: string | null;
  error_message: string | null;
  duration_ms: number | null;
  tokens_used: number | null;
  created_at: string;
}

export function useAutomations() {
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  return useQuery({
    queryKey: ["automations", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_automations")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AiAutomation[];
    },
  });
}

export function useUpsertAutomation() {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (a: Partial<AiAutomation> & { name: string; agent_id: string }) => {
      if (!workspaceId) throw new Error("No workspace");
      const payload = {
        workspace_id: workspaceId,
        name: a.name,
        description: a.description ?? null,
        is_active: a.is_active ?? true,
        trigger_event: a.trigger_event ?? "task.created",
        conditions: (a.conditions ?? []) as never,
        agent_id: a.agent_id,
        instructions_template: a.instructions_template ?? null,
        apply_action: a.apply_action ?? "comment",
        created_by: user?.id ?? null,
      };
      if (a.id) {
        const { error } = await supabase.from("ai_automations").update(payload).eq("id", a.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_automations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations", workspaceId] }),
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations", workspaceId] }),
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("ai_automations").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations", workspaceId] }),
  });
}

export function useAutomationRuns(automationId: string | null) {
  return useQuery({
    queryKey: ["automation-runs", automationId],
    enabled: !!automationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_automation_runs")
        .select("*")
        .eq("automation_id", automationId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AutomationRun[];
    },
  });
}

export function useTriggerAutomations() {
  const fn = useServerFn(triggerTaskAutomations);
  return (input: {
    task_id: string;
    event: "task.created" | "task.updated" | "task.status_changed";
    prev?: Record<string, unknown> | null;
  }) => {
    // Fire-and-forget: never await, never let rejections bubble.
    // Automations are background work — they must never crash the UI.
    Promise.resolve()
      .then(() => fn({ data: input }))
      .catch((err) => {
        console.warn("Automation trigger failed:", err);
      });
    return { ran: 0, skipped: 0 };
  };
}
