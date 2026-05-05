import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { ChangeOrder } from "@/lib/change-order-types";

export function useChangeOrders(projectId: string | undefined) {
  return useQuery({
    queryKey: ["change_orders", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("change_orders" as never)
        .select("*")
        .eq("project_id", projectId!)
        .order("number", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ChangeOrder[];
    },
  });
}

export function useCreateChangeOrder(projectId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ChangeOrder> & { title: string }) => {
      if (!ws || !user) throw new Error("No workspace");
      // determine next number
      const { data: existing } = await supabase
        .from("change_orders" as never)
        .select("number")
        .eq("project_id", projectId)
        .order("number", { ascending: false })
        .limit(1);
      const nextNum = ((existing?.[0] as unknown as { number: number } | undefined)?.number ?? 0) + 1;
      const { data, error } = await supabase
        .from("change_orders" as never)
        .insert({
          workspace_id: ws.id,
          project_id: projectId,
          requested_by: user.id,
          number: nextNum,
          status: "draft",
          ...input,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ChangeOrder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change_orders", projectId] });
      toast.success("Change order created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateChangeOrder(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ChangeOrder> & { id: string }) => {
      const { error } = await supabase
        .from("change_orders" as never)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["change_orders", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteChangeOrder(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("change_orders" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change_orders", projectId] });
      toast.success("Change order deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export async function applyChangeOrderToProject(co: ChangeOrder) {
  // Bump contract value on project_financials by cost_impact
  const { data: pf } = await supabase
    .from("project_financials" as never)
    .select("contract_value, currency")
    .eq("project_id", co.project_id)
    .maybeSingle();
  const current = (pf as unknown as { contract_value: number | null; currency: string } | null);
  const newValue = (current?.contract_value ?? 0) + Number(co.cost_impact ?? 0);
  if (current) {
    await supabase
      .from("project_financials" as never)
      .update({ contract_value: newValue } as never)
      .eq("project_id", co.project_id);
  } else {
    await supabase.from("project_financials" as never).insert({
      project_id: co.project_id,
      workspace_id: co.workspace_id,
      contract_value: newValue,
      currency: co.currency,
    } as never);
  }
}
