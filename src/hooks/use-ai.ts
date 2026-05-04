import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { listOpenRouterModels } from "@/server/openrouter.functions";

export function useOpenRouterModels() {
  return useQuery({
    queryKey: ["openrouter-models"],
    staleTime: 1000 * 60 * 60, // 1h
    queryFn: () => listOpenRouterModels(),
  });
}

export interface AiAgent {
  id: string;
  workspace_id: string;
  name: string;
  avatar_emoji: string | null;
  description: string | null;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
  created_at: string;
}

export interface AiTaskAssignment {
  id: string;
  workspace_id: string;
  task_id: string;
  agent_id: string;
  status: "queued" | "running" | "review_needed" | "completed" | "failed" | "cancelled";
  instructions: string | null;
  output: string | null;
  error_message: string | null;
  tokens_used: number | null;
  model_used: string | null;
  iterations: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export function useAiAgents() {
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  return useQuery({
    queryKey: ["ai-agents", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AiAgent[];
    },
  });
}

export function useUpsertAgent() {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  return useMutation({
    mutationFn: async (agent: Partial<AiAgent> & { name: string }) => {
      if (!workspaceId) throw new Error("No workspace");
      const payload = {
        workspace_id: workspaceId,
        name: agent.name,
        avatar_emoji: agent.avatar_emoji ?? "🤖",
        description: agent.description ?? null,
        system_prompt: agent.system_prompt ?? "You are a helpful AI assistant working on tasks.",
        model: agent.model ?? "xiaomi/mimo-v2-flash",
        temperature: agent.temperature ?? 0.7,
        max_tokens: agent.max_tokens ?? 2000,
        is_active: agent.is_active ?? true,
      };
      if (agent.id) {
        const { error } = await supabase.from("ai_agents").update(payload).eq("id", agent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_agents").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-agents", workspaceId] }),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-agents", workspaceId] }),
  });
}

export function useTaskAiAssignments(taskId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ai-assignments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_task_assignments")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AiTaskAssignment[];
    },
  });

  // Realtime updates
  useEffect(() => {
    if (!taskId) return;
    const channel = supabase
      .channel(`ai-assignments-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_task_assignments", filter: `task_id=eq.${taskId}` },
        () => qc.invalidateQueries({ queryKey: ["ai-assignments", taskId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [taskId, qc]);

  return query;
}

export function useWorkspaceAiKey() {
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  return useQuery({
    queryKey: ["workspace-ai-key", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_ai_secrets")
        .select("openrouter_api_key, updated_at")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      return data ?? null;
    },
  });
}

export function useSetWorkspaceAiKey() {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  return useMutation({
    mutationFn: async (apiKey: string | null) => {
      if (!workspaceId) throw new Error("No workspace");
      const { data: existing } = await supabase
        .from("workspace_ai_secrets")
        .select("workspace_id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("workspace_ai_secrets")
          .update({ openrouter_api_key: apiKey, updated_at: new Date().toISOString() })
          .eq("workspace_id", workspaceId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("workspace_ai_secrets")
          .insert({ workspace_id: workspaceId, openrouter_api_key: apiKey });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-ai-key", workspaceId] }),
  });
}
