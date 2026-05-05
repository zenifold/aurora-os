import type { Milestone } from "./milestone-types";
import type { Sprint } from "./sprint-types";
import type { TeamMember } from "./team-types";
import type { Task } from "./types";
import type { FinancialSummary } from "@/hooks/use-project-financials";

export type HealthDim = "schedule" | "scope" | "budget" | "quality" | "team";

export interface HealthDimension {
  key: HealthDim;
  label: string;
  score: number; // 0-100
  weight: number; // 0-1
  insight: string;
  action: string | null;
}

export interface HealthReport {
  overall: number; // weighted 0-100
  band: "excellent" | "good" | "warning" | "critical";
  dimensions: HealthDimension[];
  flags: string[];
}

const WEIGHTS: Record<HealthDim, number> = {
  schedule: 0.25,
  scope: 0.2,
  budget: 0.25,
  quality: 0.15,
  team: 0.15,
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function band(score: number): HealthReport["band"] {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "warning";
  return "critical";
}

export const BAND_META: Record<HealthReport["band"], { label: string; tone: string }> = {
  excellent: { label: "Excellent", tone: "text-emerald-600 dark:text-emerald-400" },
  good: { label: "On track", tone: "text-blue-600 dark:text-blue-400" },
  warning: { label: "At risk", tone: "text-amber-600 dark:text-amber-400" },
  critical: { label: "Critical", tone: "text-rose-600 dark:text-rose-400" },
};

export function computeHealthReport(input: {
  milestones: Milestone[];
  sprints: Sprint[];
  tasks: Task[];
  members: TeamMember[];
  financial: FinancialSummary;
}): HealthReport {
  const today = new Date().toISOString().slice(0, 10);
  const flags: string[] = [];

  // 1. Schedule: % of non-cancelled milestones not missed/at_risk
  const relevantMs = input.milestones.filter((m) => m.status !== "cancelled");
  const lateMs = relevantMs.filter(
    (m) =>
      m.status === "missed" ||
      m.status === "at_risk" ||
      (m.status !== "completed" && m.target_date < today),
  );
  const scheduleScore = relevantMs.length === 0
    ? 80
    : clamp(100 - (lateMs.length / relevantMs.length) * 100);
  if (lateMs.length > 0) flags.push(`${lateMs.length} milestone${lateMs.length > 1 ? "s" : ""} at risk or missed`);

  // 2. Scope: active sprint planned vs capacity
  const activeSprint = input.sprints.find((s) => s.status === "active");
  let scopeScore = 75;
  let scopeInsight = "No active sprint";
  if (activeSprint) {
    const cap = Number(activeSprint.capacity_hours) || 0;
    const planned = Number(activeSprint.planned_hours) || 0;
    if (cap > 0) {
      const ratio = planned / cap;
      // Best when planned is 70-95% of capacity
      if (ratio > 1) {
        scopeScore = clamp(100 - (ratio - 1) * 200);
        scopeInsight = `Sprint overcommitted (${Math.round(ratio * 100)}% of capacity)`;
        flags.push("Sprint overcommitted");
      } else if (ratio < 0.5) {
        scopeScore = 60;
        scopeInsight = `Sprint underused (${Math.round(ratio * 100)}% of capacity)`;
      } else {
        scopeScore = clamp(60 + ratio * 40);
        scopeInsight = `Sprint loaded at ${Math.round(ratio * 100)}% of capacity`;
      }
    } else {
      scopeInsight = "Active sprint has no capacity set";
    }
  }

  // 3. Budget: margin and burn
  let budgetScore = 75;
  let budgetInsight = "No financial data";
  let budgetAction: string | null = null;
  const { marginPct, burnPct, contractValue, loggedRevenue } = input.financial;
  if (loggedRevenue > 0 || contractValue > 0) {
    let s = 75;
    if (loggedRevenue > 0) {
      // 40%+ margin = great, 20% = ok, <0 = bad
      s = clamp(50 + marginPct);
      budgetInsight = `Margin trending to ${Math.round(marginPct)}%`;
    }
    if (contractValue > 0 && burnPct > 90) {
      s = Math.min(s, clamp(100 - (burnPct - 90) * 5));
      budgetInsight = `Budget ${Math.round(burnPct)}% consumed`;
      budgetAction = "Negotiate change order or reduce non-billable hours";
      flags.push("Budget burn high");
    } else if (marginPct < 20 && loggedRevenue > 0) {
      budgetAction = "Review cost rates or scope reduction";
    }
    budgetScore = clamp(s);
  }

  // 4. Quality: overdue tasks ratio (open, past due_date)
  const openTasks = input.tasks.filter((t) => !t.completed_at);
  const overdueTasks = openTasks.filter((t) => t.due_date && t.due_date < today);
  const qualityScore = openTasks.length === 0
    ? 90
    : clamp(100 - (overdueTasks.length / openTasks.length) * 120);
  if (overdueTasks.length > 0) flags.push(`${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""}`);

  // 5. Team: any over-capacity?
  let teamScore = 85;
  let teamInsight = `${input.members.length} active member${input.members.length === 1 ? "" : "s"}`;
  let teamAction: string | null = null;
  if (activeSprint && input.members.length > 0) {
    // Heuristic: assigned task count per user × 4h vs weekly capacity
    const taskHoursByUser = new Map<string, number>();
    const sprintTaskIds = new Set<string>();
    // We don't have sprint_tasks here directly, fall back to project active tasks
    for (const t of openTasks) {
      for (const u of t.assignee_ids ?? []) {
        taskHoursByUser.set(u, (taskHoursByUser.get(u) ?? 0) + 4);
      }
    }
    const overloaded = input.members.filter((m) => {
      const load = taskHoursByUser.get(m.user_id) ?? 0;
      return m.weekly_capacity_hours > 0 && load > m.weekly_capacity_hours;
    });
    if (overloaded.length > 0) {
      teamScore = clamp(80 - overloaded.length * 20);
      teamInsight = `${overloaded.length} member${overloaded.length > 1 ? "s" : ""} over capacity`;
      teamAction = "Rebalance assignments or extend timeline";
      flags.push("Team overallocated");
    } else {
      teamInsight = `Team load within capacity`;
    }
    void sprintTaskIds;
  }

  const dims: HealthDimension[] = [
    {
      key: "schedule",
      label: "Schedule",
      score: scheduleScore,
      weight: WEIGHTS.schedule,
      insight: relevantMs.length === 0
        ? "No milestones defined"
        : `${relevantMs.length - lateMs.length}/${relevantMs.length} milestones on track`,
      action: lateMs.length > 0 ? "Reschedule at-risk milestones or reduce scope" : null,
    },
    {
      key: "scope",
      label: "Scope",
      score: scopeScore,
      weight: WEIGHTS.scope,
      insight: scopeInsight,
      action: scopeScore < 70 ? "Adjust sprint commitment to match capacity" : null,
    },
    {
      key: "budget",
      label: "Budget",
      score: budgetScore,
      weight: WEIGHTS.budget,
      insight: budgetInsight,
      action: budgetAction,
    },
    {
      key: "quality",
      label: "Quality",
      score: qualityScore,
      weight: WEIGHTS.quality,
      insight: openTasks.length === 0
        ? "No open tasks"
        : `${overdueTasks.length}/${openTasks.length} tasks overdue`,
      action: overdueTasks.length > 0 ? "Triage overdue tasks and update due dates" : null,
    },
    {
      key: "team",
      label: "Team",
      score: teamScore,
      weight: WEIGHTS.team,
      insight: teamInsight,
      action: teamAction,
    },
  ];

  const overall = clamp(
    Math.round(dims.reduce((acc, d) => acc + d.score * d.weight, 0)),
  );

  return { overall, band: band(overall), dimensions: dims, flags };
}
