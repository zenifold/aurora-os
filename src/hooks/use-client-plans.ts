import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export type ClientPlanLayout = "timeline" | "list" | "board";

export interface ClientPlan {
  id: string;
  workspace_id: string;
  client_account_id: string;
  name: string;
  description: string | null;
  layout: ClientPlanLayout;
  config: {
    project_ids?: string[];
    group_by?: "engagement" | "phase" | "owner" | "status";
    filters?: {
      status?: string[];
      owner_id?: string | null;
      due?: "this_week" | "overdue" | "blocked" | null;
    };
  };
  baseline: unknown | null;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientPlans(clientAccountId: string | undefined) {
  return useQuery({
    queryKey: ["client-plans", clientAccountId],
    enabled: !!clientAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_plans" as never)
        .select("*")
        .eq("client_account_id", clientAccountId!)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClientPlan[];
    },
  });
}

export function useCreateClientPlan(clientAccountId: string) {
  const qc = useQueryClient();
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      layout?: ClientPlanLayout;
      config?: ClientPlan["config"];
    }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("client_plans" as never)
        .insert({
          workspace_id: ws.id,
          client_account_id: clientAccountId,
          name: input.name,
          description: input.description ?? null,
          layout: input.layout ?? "timeline",
          config: input.config ?? {},
          created_by: user.id,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ClientPlan;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-plans", clientAccountId] });
      toast.success("Plan created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateClientPlan(clientAccountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ClientPlan> & { id: string }) => {
      const { error } = await supabase
        .from("client_plans" as never)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-plans", clientAccountId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteClientPlan(clientAccountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_plans" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-plans", clientAccountId] });
      toast.success("Plan deleted");
    },
  });
}

/** Fetch all milestones + tasks across the given project ids for timeline rendering. */
export function usePlanTimelineData(projectIds: string[]) {
  return useQuery({
    queryKey: ["client-plan-timeline", projectIds.slice().sort().join(",")],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const [{ data: ms }, { data: tasks }] = await Promise.all([
        supabase
          .from("milestones" as never)
          .select("id,name,project_id,target_date,status,payment_amount,payment_currency,milestone_type")
          .in("project_id", projectIds)
          .order("target_date", { ascending: true }),
        supabase
          .from("tasks")
          .select("id,title,project_id,due_date,start_date,status,priority,assignee_ids")
          .in("project_id", projectIds)
          .not("due_date", "is", null)
          .order("due_date", { ascending: true })
          .limit(500),
      ]);
      return {
        milestones: (ms ?? []) as Array<{
          id: string;
          name: string;
          project_id: string;
          target_date: string | null;
          status: string;
          payment_amount: number | null;
          payment_currency: string | null;
          milestone_type: string;
        }>,
        tasks: (tasks ?? []) as Array<{
          id: string;
          title: string;
          project_id: string;
          due_date: string | null;
          start_date: string | null;
          status: string;
          priority: string | null;
          assignee_ids: string[] | null;
        }>,
      };
    },
  });
}

