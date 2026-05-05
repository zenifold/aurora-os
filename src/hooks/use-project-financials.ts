import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import type { ProjectFinancials } from "@/lib/financial-types";
import type { TimeLog, TeamMember } from "@/lib/team-types";

export function useProjectFinancials(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project_financials", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_financials" as never)
        .select("*")
        .eq("project_id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ProjectFinancials | null;
    },
  });
}

export function useUpsertProjectFinancials(projectId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ProjectFinancials>) => {
      if (!ws) throw new Error("No workspace");
      const { error } = await supabase
        .from("project_financials" as never)
        .upsert(
          {
            project_id: projectId,
            workspace_id: ws.id,
            ...input,
          } as never,
          { onConflict: "project_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_financials", projectId] });
      toast.success("Financial settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useProjectTimeLogs(projectId: string | undefined) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["time_logs", "project", projectId],
    enabled: !!ws && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_logs" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("project_id", projectId!)
        .order("log_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TimeLog[];
    },
  });
}

export interface FinancialSummary {
  contractValue: number;
  paidRevenue: number;
  invoicedRevenue: number; // completed payment milestones (paid + unpaid)
  outstanding: number; // invoiced - paid
  loggedRevenue: number; // sum of time_logs hours * bill rate
  loggedCost: number; // sum of time_logs hours * cost rate
  billableHours: number;
  nonBillableHours: number;
  margin: number; // loggedRevenue - loggedCost
  marginPct: number; // margin / loggedRevenue
  burnPct: number; // loggedCost / contractValue
}

export function computeSummary(
  financials: ProjectFinancials | null,
  logs: TimeLog[],
  members: TeamMember[],
  paymentMilestones: { payment_amount: number | null; is_paid: boolean; status: string }[],
): FinancialSummary {
  const memberById = new Map(members.map((m) => [m.user_id, m]));
  const defaultBill = financials?.default_bill_rate ?? 0;
  const defaultCost = financials?.default_cost_rate ?? 0;

  let loggedRevenue = 0;
  let loggedCost = 0;
  let billableHours = 0;
  let nonBillableHours = 0;

  for (const log of logs) {
    const m = memberById.get(log.user_id);
    const billRate = log.hourly_rate_snapshot ?? m?.hourly_bill_rate ?? defaultBill ?? 0;
    const costRate = m?.hourly_cost ?? defaultCost ?? 0;
    const hours = Number(log.hours) || 0;
    if (log.is_billable) {
      billableHours += hours;
      loggedRevenue += hours * Number(billRate);
    } else {
      nonBillableHours += hours;
    }
    loggedCost += hours * Number(costRate);
  }

  let invoicedRevenue = 0;
  let paidRevenue = 0;
  for (const ms of paymentMilestones) {
    const amt = Number(ms.payment_amount) || 0;
    if (ms.is_paid) {
      paidRevenue += amt;
      invoicedRevenue += amt;
    } else if (ms.status === "completed") {
      invoicedRevenue += amt;
    }
  }

  const contractValue = Number(financials?.contract_value) || 0;
  const margin = loggedRevenue - loggedCost;
  const marginPct = loggedRevenue > 0 ? (margin / loggedRevenue) * 100 : 0;
  const burnPct = contractValue > 0 ? (loggedCost / contractValue) * 100 : 0;

  return {
    contractValue,
    paidRevenue,
    invoicedRevenue,
    outstanding: invoicedRevenue - paidRevenue,
    loggedRevenue,
    loggedCost,
    billableHours,
    nonBillableHours,
    margin,
    marginPct,
    burnPct,
  };
}
