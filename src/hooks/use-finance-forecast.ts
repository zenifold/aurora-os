import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { addDays, format, startOfWeek } from "date-fns";
import type { Resource, ResourceAllocation } from "@/lib/resource-types";
import type { ProjectFinancials } from "@/lib/financial-types";
import type { TeamMember } from "@/lib/team-types";
import type { Project } from "@/lib/types";

export interface ForecastWeek {
  weekStart: string;          // yyyy-MM-dd Mon
  label: string;              // "MMM d"
  capacityHours: number;      // total team+resource capacity (hrs)
  bookedHours: number;        // sum of allocations
  utilizationPct: number;
  forecastRevenue: number;    // bookedHours * bill rate
  forecastCost: number;       // bookedHours * cost rate
  projectedMargin: number;
  perProject: Array<{ project_id: string; project_name: string; hours: number; revenue: number; cost: number }>;
}

export interface ForecastResult {
  weeks: ForecastWeek[];
  totals: {
    capacityHours: number;
    bookedHours: number;
    forecastRevenue: number;
    forecastCost: number;
    projectedMargin: number;
    utilizationPct: number;
  };
  currency: string;
}

export function useFinanceForecast(weeksCount = 8) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["finance_forecast", ws?.id, weeksCount],
    enabled: !!ws,
    queryFn: async (): Promise<ForecastResult> => {
      const wsId = ws!.id;
      const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
      const horizonEnd = addDays(monday, weeksCount * 7 - 1);
      const fromStr = format(monday, "yyyy-MM-dd");
      const toStr = format(horizonEnd, "yyyy-MM-dd");

      const [allocRes, resRes, teamRes, finRes, projRes] = await Promise.all([
        supabase.from("resource_allocations" as never).select("*").eq("workspace_id", wsId)
          .or(`end_date.is.null,end_date.gte.${fromStr}`).lte("start_date", toStr),
        supabase.from("resources" as never).select("*").eq("workspace_id", wsId),
        supabase.from("team_members" as never).select("*").eq("workspace_id", wsId).eq("is_active", true),
        supabase.from("project_financials" as never).select("*").eq("workspace_id", wsId),
        supabase.from("projects").select("*").eq("workspace_id", wsId),
      ]);
      if (allocRes.error) throw allocRes.error;

      const allocations = (allocRes.data ?? []) as unknown as ResourceAllocation[];
      const resources = (resRes.data ?? []) as unknown as Resource[];
      const teamMembers = (teamRes.data ?? []) as unknown as TeamMember[];
      const finByProject = new Map(
        ((finRes.data ?? []) as unknown as ProjectFinancials[]).map((f) => [f.project_id, f]),
      );
      const projects = (projRes.data ?? []) as Project[];
      const projectMap = new Map(projects.map((p) => [p.id, p]));

      const capacityFor = (a: ResourceAllocation): number => {
        // weekly capacity for the allocated entity
        if (a.team_member_user_id) {
          const tm = teamMembers.find((t) => t.user_id === a.team_member_user_id);
          return Number(tm?.weekly_capacity_hours ?? 40);
        }
        if (a.resource_id) {
          const r = resources.find((x) => x.id === a.resource_id);
          return Number(r?.weekly_capacity_hours ?? 40);
        }
        return 40;
      };

      const ratesFor = (a: ResourceAllocation): { bill: number; cost: number } => {
        const fin = finByProject.get(a.project_id);
        const billOverride = a.bill_rate_override != null ? Number(a.bill_rate_override) : null;
        const costOverride = a.cost_rate_override != null ? Number(a.cost_rate_override) : null;
        let bill = billOverride ?? Number(fin?.default_bill_rate ?? 0);
        let cost = costOverride ?? Number(fin?.default_cost_rate ?? 0);
        if (a.team_member_user_id) {
          const tm = teamMembers.find((t) => t.user_id === a.team_member_user_id);
          if (!billOverride && tm?.hourly_bill_rate != null) bill = Number(tm.hourly_bill_rate);
          if (!costOverride && tm?.hourly_cost != null) cost = Number(tm.hourly_cost);
        } else if (a.resource_id) {
          const r = resources.find((x) => x.id === a.resource_id);
          if (!billOverride && r?.bill_rate_amount != null) bill = Number(r.bill_rate_amount);
          if (!costOverride && r?.cost_rate_amount != null) cost = Number(r.cost_rate_amount);
        }
        return { bill, cost };
      };

      // Total weekly capacity (team + active resources)
      const totalWeeklyCapacity =
        teamMembers.reduce((s, t) => s + Number(t.weekly_capacity_hours ?? 40), 0) +
        resources.filter((r) => r.is_active).reduce((s, r) => s + Number(r.weekly_capacity_hours ?? 40), 0);

      const totals = {
        capacityHours: 0, bookedHours: 0, forecastRevenue: 0,
        forecastCost: 0, projectedMargin: 0, utilizationPct: 0,
      };

      const weeks: ForecastWeek[] = [];
      for (let w = 0; w < weeksCount; w++) {
        const wkStart = addDays(monday, w * 7);
        const wkEnd = addDays(wkStart, 6);
        const wkStartStr = format(wkStart, "yyyy-MM-dd");
        const wkEndStr = format(wkEnd, "yyyy-MM-dd");

        const projAgg = new Map<string, { hours: number; revenue: number; cost: number }>();
        let bookedHours = 0;
        let forecastRevenue = 0;
        let forecastCost = 0;

        for (const a of allocations) {
          // overlaps with this week?
          if (a.start_date > wkEndStr) continue;
          if (a.end_date && a.end_date < wkStartStr) continue;
          const cap = capacityFor(a);
          let weekHours = 0;
          if (a.allocation_type === "full_time") weekHours = cap;
          else if (a.allocation_type === "percentage") weekHours = (cap * (a.percentage ?? 0)) / 100;
          else if (a.allocation_type === "fixed_hours") {
            const start = new Date(a.start_date).getTime();
            const end = new Date(a.end_date ?? wkEndStr).getTime();
            const totalDays = Math.max(1, (end - start) / 86400000 + 1);
            const perDay = Number(a.fixed_hours ?? 0) / totalDays;
            // count overlap days within this week (max 7)
            const ovStart = Math.max(start, wkStart.getTime());
            const ovEnd = Math.min(end, wkEnd.getTime());
            const ovDays = Math.max(0, (ovEnd - ovStart) / 86400000 + 1);
            weekHours = perDay * ovDays;
          }
          if (weekHours <= 0) continue;

          const { bill, cost } = ratesFor(a);
          const rev = a.billable ? weekHours * bill : 0;
          const cst = weekHours * cost;
          bookedHours += weekHours;
          forecastRevenue += rev;
          forecastCost += cst;
          const cur = projAgg.get(a.project_id) ?? { hours: 0, revenue: 0, cost: 0 };
          cur.hours += weekHours; cur.revenue += rev; cur.cost += cst;
          projAgg.set(a.project_id, cur);
        }

        const perProject = Array.from(projAgg.entries()).map(([pid, v]) => ({
          project_id: pid,
          project_name: projectMap.get(pid)?.name ?? "Project",
          hours: v.hours, revenue: v.revenue, cost: v.cost,
        })).sort((a, b) => b.hours - a.hours);

        const week: ForecastWeek = {
          weekStart: wkStartStr,
          label: format(wkStart, "MMM d"),
          capacityHours: totalWeeklyCapacity,
          bookedHours,
          utilizationPct: totalWeeklyCapacity > 0 ? (bookedHours / totalWeeklyCapacity) * 100 : 0,
          forecastRevenue,
          forecastCost,
          projectedMargin: forecastRevenue - forecastCost,
          perProject,
        };
        weeks.push(week);

        totals.capacityHours += totalWeeklyCapacity;
        totals.bookedHours += bookedHours;
        totals.forecastRevenue += forecastRevenue;
        totals.forecastCost += forecastCost;
      }

      totals.projectedMargin = totals.forecastRevenue - totals.forecastCost;
      totals.utilizationPct = totals.capacityHours > 0 ? (totals.bookedHours / totals.capacityHours) * 100 : 0;

      // Pick most common currency from project financials
      const ccyCounts = new Map<string, number>();
      for (const f of finByProject.values()) {
        ccyCounts.set(f.currency, (ccyCounts.get(f.currency) ?? 0) + 1);
      }
      let currency = "USD"; let best = 0;
      for (const [c, n] of ccyCounts) if (n > best) { best = n; currency = c; }

      return { weeks, totals, currency };
    },
  });
}
