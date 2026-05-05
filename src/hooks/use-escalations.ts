import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type {
  Escalation,
  EscalationRule,
  EscalationStatus,
} from "@/lib/escalation-types";

export function useEscalations(opts?: { projectId?: string; status?: EscalationStatus | "open" }) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["escalations", ws?.id, opts?.projectId, opts?.status],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("escalations" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false });
      if (opts?.projectId) q = q.eq("project_id", opts.projectId);
      if (opts?.status === "open") q = q.in("status", ["active", "acknowledged"]);
      else if (opts?.status) q = q.eq("status", opts.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Escalation[];
    },
  });
}

export function useEscalation(id: string | undefined) {
  return useQuery({
    queryKey: ["escalation", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escalations" as never)
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as Escalation;
    },
  });
}

export function useCreateEscalation() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Escalation> & { project_id: string; tier: number; title: string }) => {
      if (!ws) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("escalations" as never)
        .insert({ workspace_id: ws.id, ...input } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Escalation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escalations"] });
      toast.success("Escalation created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateEscalation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      id,
      action,
      patch,
    }: {
      id: string;
      action?: "acknowledge" | "resolve" | "escalate";
      patch?: Partial<Escalation>;
    }) => {
      const update: Record<string, unknown> = { ...(patch ?? {}) };
      if (action === "acknowledge") {
        update.status = "acknowledged";
        update.acknowledged_by = user?.id ?? null;
        update.acknowledged_at = new Date().toISOString();
      } else if (action === "resolve") {
        update.status = "resolved";
        update.resolved_by = user?.id ?? null;
        update.resolved_at = new Date().toISOString();
      } else if (action === "escalate") {
        update.status = "escalated_further";
      }
      const { error } = await supabase
        .from("escalations" as never)
        .update(update as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["escalations"] });
      qc.invalidateQueries({ queryKey: ["escalation", vars.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEscalationRules() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["escalation_rules", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escalation_rules" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("tier");
      if (error) throw error;
      return (data ?? []) as unknown as EscalationRule[];
    },
  });
}
