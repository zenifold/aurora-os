import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { Project } from "@/lib/types";

export interface DeliveryDeliverable {
  id: string;
  task_id: string;
  project_id: string;
  deliverable_type: string;
  client_deadline: string | null;
  review_status: string;
  submitted_at: string | null;
}

export interface DeliveryAlert {
  id: string;
  level: "critical" | "warning" | "info";
  projectId: string;
  projectName: string;
  title: string;
  detail: string;
  ts: string;
}

export interface DeliveryProjectStats {
  project: Project;
  taskTotal: number;
  taskDone: number;
  progressPct: number;
  contractValue: number;
  burnPct: number;
  marginPct: number | null;
  targetMarginPct: number | null;
  pendingDeliverables: DeliveryDeliverable[];
  overdueDeliverables: DeliveryDeliverable[];
  alerts: DeliveryAlert[];
}

/**
 * Aggregate workspace-wide delivery snapshot in a single payload.
 */
export function useDeliverySnapshot() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["delivery-snapshot", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data: projects, error: pErr } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false);
      if (pErr) throw pErr;

      const clientProjects = ((projects ?? []) as Project[]).filter(
        (p) => p.is_client_project,
      );
      const ids = clientProjects.map((p) => p.id);

      const [tasksRes, delivRes, finRes, logsRes] = await Promise.all([
        ids.length === 0
          ? { data: [] as { project_id: string; status: string }[], error: null }
          : await supabase
              .from("tasks")
              .select("project_id, status")
              .in("project_id", ids),
        ids.length === 0
          ? { data: [] as DeliveryDeliverable[], error: null }
          : await supabase
              .from("client_deliverables")
              .select("id, task_id, project_id, deliverable_type, client_deadline, review_status, submitted_at")
              .in("project_id", ids),
        ids.length === 0
          ? { data: [] as { project_id: string; contract_value: number | null; default_bill_rate: number | null; default_cost_rate: number | null }[], error: null }
          : await supabase
              .from("project_financials")
              .select("project_id, contract_value, default_bill_rate, default_cost_rate")
              .in("project_id", ids),
        ids.length === 0
          ? { data: [] as { project_id: string; hours: number; is_billable: boolean; hourly_rate_snapshot: number | null }[], error: null }
          : await supabase
              .from("time_logs" as never)
              .select("project_id, hours, is_billable, hourly_rate_snapshot")
              .in("project_id", ids),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (delivRes.error) throw delivRes.error;
      if (finRes.error) throw finRes.error;

      const tasks = (tasksRes.data ?? []) as { project_id: string; status: string }[];
      const deliverables = (delivRes.data ?? []) as DeliveryDeliverable[];
      const fins = (finRes.data ?? []) as Array<{
        project_id: string;
        contract_value: number | null;
        default_bill_rate: number | null;
        default_cost_rate: number | null;
      }>;
      const logs = (logsRes.data ?? []) as Array<{
        project_id: string;
        hours: number;
        is_billable: boolean;
        hourly_rate_snapshot: number | null;
      }>;

      const today = new Date().toISOString().slice(0, 10);

      const stats: DeliveryProjectStats[] = clientProjects.map((p) => {
        const projectTasks = tasks.filter((t) => t.project_id === p.id);
        const taskTotal = projectTasks.length;
        const taskDone = projectTasks.filter(
          (t) => t.status === "done" || t.status === "cancelled",
        ).length;
        const progressPct = taskTotal === 0 ? 0 : Math.round((taskDone / taskTotal) * 100);

        const fin = fins.find((f) => f.project_id === p.id);
        const contractValue = Number(fin?.contract_value ?? 0);

        let revenue = 0;
        let cost = 0;
        const billRate = Number(fin?.default_bill_rate ?? 0);
        const costRate = Number(fin?.default_cost_rate ?? 0);
        for (const log of logs.filter((l) => l.project_id === p.id)) {
          const hours = Number(log.hours) || 0;
          if (log.is_billable) {
            revenue += hours * (Number(log.hourly_rate_snapshot) || billRate);
          }
          cost += hours * costRate;
        }
        const marginPct = revenue > 0 ? ((revenue - cost) / revenue) * 100 : null;
        const burnPct = contractValue > 0 ? (cost / contractValue) * 100 : 0;

        const projDelivs = deliverables.filter((d) => d.project_id === p.id);
        const pending = projDelivs.filter(
          (d) => d.review_status === "pending" || d.review_status === "submitted",
        );
        const overdue = pending.filter(
          (d) => !!d.client_deadline && d.client_deadline < today,
        );

        const alerts: DeliveryAlert[] = [];
        for (const d of overdue) {
          alerts.push({
            id: `overdue-${d.id}`,
            level: "critical",
            projectId: p.id,
            projectName: p.name,
            title: `Client deliverable overdue`,
            detail: `${d.deliverable_type} · due ${d.client_deadline}`,
            ts: d.client_deadline ?? "",
          });
        }
        if (
          marginPct !== null &&
          p.target_margin_pct !== null &&
          p.target_margin_pct !== undefined &&
          marginPct < p.target_margin_pct
        ) {
          alerts.push({
            id: `margin-${p.id}`,
            level: "warning",
            projectId: p.id,
            projectName: p.name,
            title: `Margin below target`,
            detail: `${marginPct.toFixed(0)}% vs ${p.target_margin_pct}% target`,
            ts: new Date().toISOString(),
          });
        }
        if (p.health === "critical") {
          alerts.push({
            id: `health-${p.id}`,
            level: "critical",
            projectId: p.id,
            projectName: p.name,
            title: "Project flagged critical",
            detail: "Manual flag set on project",
            ts: p.updated_at,
          });
        } else if (p.health === "at_risk") {
          alerts.push({
            id: `health-${p.id}`,
            level: "warning",
            projectId: p.id,
            projectName: p.name,
            title: "Project flagged at risk",
            detail: "Manual flag set on project",
            ts: p.updated_at,
          });
        }

        return {
          project: p,
          taskTotal,
          taskDone,
          progressPct,
          contractValue,
          burnPct,
          marginPct,
          targetMarginPct: p.target_margin_pct ?? null,
          pendingDeliverables: pending,
          overdueDeliverables: overdue,
          alerts,
        };
      });

      const allAlerts = stats
        .flatMap((s) => s.alerts)
        .sort((a, b) => {
          const order = { critical: 0, warning: 1, info: 2 } as const;
          if (order[a.level] !== order[b.level]) return order[a.level] - order[b.level];
          return (b.ts || "").localeCompare(a.ts || "");
        });

      const atRisk = stats.filter((s) => s.project.health === "at_risk" || s.project.health === "critical");
      const totalContract = stats.reduce((sum, s) => sum + s.contractValue, 0);

      // On-time delivery: % of approved deliverables that were on time
      const approved = deliverables.filter((d) => d.review_status === "approved");
      const onTime = approved.filter((d) => {
        if (!d.client_deadline || !d.submitted_at) return true;
        return d.submitted_at.slice(0, 10) <= d.client_deadline;
      });
      const onTimePct = approved.length === 0 ? 100 : Math.round((onTime.length / approved.length) * 100);

      return {
        stats,
        alerts: allAlerts,
        kpis: {
          activeCount: stats.length,
          atRiskCount: atRisk.length,
          atRiskNames: atRisk.map((s) => s.project.client_name || s.project.name),
          onTimePct,
          totalContract,
          deliverablesNeedingAction: deliverables.filter((d) => d.review_status === "pending").length,
          deliverablesReviewing: deliverables.filter((d) => d.review_status === "submitted").length,
          deliverablesApproved: deliverables.filter((d) => d.review_status === "approved").length,
        },
      };
    },
  });
}
