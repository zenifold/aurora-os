import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { ProjectFinancials } from "@/lib/financial-types";
import type { Invoice } from "@/lib/invoice-types";
import type { TimeLog, TeamMember } from "@/lib/team-types";
import type { Project } from "@/lib/types";


export interface ProjectRollup {
  project: Project;
  financials: ProjectFinancials | null;
  contractValue: number;
  invoicedTotal: number;
  paidTotal: number;
  outstanding: number;
  overdueOutstanding: number;
  loggedRevenue: number;
  loggedCost: number;
  margin: number;
  marginPct: number;
  burnPct: number;
  wip: number; // logged revenue not yet invoiced
  billableHours: number;
  nonBillableHours: number;
  currency: string;
}

export interface AgingBuckets {
  current: number; // not yet due
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
}

export interface PortfolioFinance {
  rows: ProjectRollup[];
  totals: {
    contractValue: number;
    invoiced: number;
    paid: number;
    outstanding: number;
    loggedRevenue: number;
    loggedCost: number;
    margin: number;
    marginPct: number;
    wip: number;
    billableHours: number;
    nonBillableHours: number;
  };
  aging: AgingBuckets;
  invoicesByStatus: { draft: number; sent: number; paid: number; overdue: number; void: number };
  currency: string;
}

const EMPTY: PortfolioFinance = {
  rows: [],
  totals: {
    contractValue: 0, invoiced: 0, paid: 0, outstanding: 0,
    loggedRevenue: 0, loggedCost: 0, margin: 0, marginPct: 0,
    wip: 0, billableHours: 0, nonBillableHours: 0,
  },
  aging: { current: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 },
  invoicesByStatus: { draft: 0, sent: 0, paid: 0, overdue: 0, void: 0 },
  currency: "USD",
};

export function usePortfolioFinance() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["portfolio_finance", ws?.id],
    enabled: !!ws,
    queryFn: async (): Promise<PortfolioFinance> => {
      const wsId = ws!.id;
      const [projectsRes, financialsRes, invoicesRes, logsRes, membersRes, msRes] = await Promise.all([
        supabase.from("projects").select("*").eq("workspace_id", wsId),
        supabase.from("project_financials" as never).select("*").eq("workspace_id", wsId),
        supabase.from("invoices" as never).select("*").eq("workspace_id", wsId),
        supabase.from("time_logs" as never).select("*").eq("workspace_id", wsId),
        supabase.from("team_members" as never).select("*").eq("workspace_id", wsId),
        supabase.from("milestones" as never).select("*").eq("workspace_id", wsId),
      ]);
      if (projectsRes.error) throw projectsRes.error;
      const projects = (projectsRes.data ?? []) as Project[];
      const financials = (financialsRes.data ?? []) as unknown as ProjectFinancials[];
      const invoices = (invoicesRes.data ?? []) as unknown as Invoice[];
      const logs = (logsRes.data ?? []) as unknown as TimeLog[];
      const members = (membersRes.data ?? []) as unknown as TeamMember[];
      const milestones = (msRes.data ?? []) as unknown as unknown[];

      const finByProject = new Map(financials.map((f) => [f.project_id, f]));
      const memberById = new Map(members.map((m) => [m.user_id, m]));
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);

      const aging: AgingBuckets = { current: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
      const invoicesByStatus = { draft: 0, sent: 0, paid: 0, overdue: 0, void: 0 };
      const totals = { ...EMPTY.totals };

      const rows: ProjectRollup[] = projects.map((p) => {
        const fin = finByProject.get(p.id) ?? null;
        const currency = fin?.currency ?? "USD";
        const projLogs = logs.filter((l) => l.project_id === p.id);
        const defaultBill = fin?.default_bill_rate ?? 0;
        const defaultCost = fin?.default_cost_rate ?? 0;

        let loggedRevenue = 0;
        let loggedCost = 0;
        let billableHours = 0;
        let nonBillableHours = 0;
        for (const log of projLogs) {
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

        const projInvoices = invoices.filter((i) => i.project_id === p.id);
        let invoicedTotal = 0;
        let paidTotal = 0;
        let outstanding = 0;
        let overdueOutstanding = 0;
        for (const inv of projInvoices) {
          if (inv.status === "void") continue;
          invoicedTotal += Number(inv.total) || 0;
          paidTotal += Number(inv.amount_paid) || 0;
          const due = Math.max(0, (Number(inv.total) || 0) - (Number(inv.amount_paid) || 0));
          outstanding += due;
          if (due > 0 && inv.due_date && inv.due_date < todayStr) {
            overdueOutstanding += due;
          }
        }

        const contractValue = Number(fin?.contract_value) || 0;
        const margin = loggedRevenue - loggedCost;
        const marginPct = loggedRevenue > 0 ? (margin / loggedRevenue) * 100 : 0;
        const burnPct = contractValue > 0 ? (loggedCost / contractValue) * 100 : 0;
        const wip = Math.max(0, loggedRevenue - invoicedTotal);

        totals.contractValue += contractValue;
        totals.invoiced += invoicedTotal;
        totals.paid += paidTotal;
        totals.outstanding += outstanding;
        totals.loggedRevenue += loggedRevenue;
        totals.loggedCost += loggedCost;
        totals.wip += wip;
        totals.billableHours += billableHours;
        totals.nonBillableHours += nonBillableHours;

        return {
          project: p, financials: fin, contractValue,
          invoicedTotal, paidTotal, outstanding, overdueOutstanding,
          loggedRevenue, loggedCost, margin, marginPct, burnPct, wip,
          billableHours, nonBillableHours, currency,
        };
      });

      totals.margin = totals.loggedRevenue - totals.loggedCost;
      totals.marginPct = totals.loggedRevenue > 0 ? (totals.margin / totals.loggedRevenue) * 100 : 0;

      for (const inv of invoices) {
        const status = inv.status;
        if (status in invoicesByStatus) invoicesByStatus[status as keyof typeof invoicesByStatus] += 1;
        if (status === "void" || status === "paid") continue;
        const due = Math.max(0, (Number(inv.total) || 0) - (Number(inv.amount_paid) || 0));
        if (due <= 0) continue;
        if (!inv.due_date || inv.due_date >= todayStr) {
          aging.current += due;
        } else {
          const diff = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000);
          if (diff <= 30) aging.d0_30 += due;
          else if (diff <= 60) aging.d31_60 += due;
          else if (diff <= 90) aging.d61_90 += due;
          else aging.d90_plus += due;
        }
      }

      // pick most common currency
      const ccyCounts = new Map<string, number>();
      for (const r of rows) ccyCounts.set(r.currency, (ccyCounts.get(r.currency) ?? 0) + 1);
      let currency = "USD";
      let best = 0;
      for (const [c, n] of ccyCounts) if (n > best) { best = n; currency = c; }

      // unused milestones reference (kept for future); suppress lint
      void milestones;

      return { rows, totals, aging, invoicesByStatus, currency };
    },
  });
}
