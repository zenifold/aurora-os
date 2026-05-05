export type SprintStatus = "planning" | "active" | "completed" | "cancelled";

export interface Sprint {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  start_date: string;
  end_date: string;
  capacity_hours: number | null;
  planned_hours: number;
  logged_hours: number;
  capacity_points: number | null;
  planned_points: number;
  completed_points: number;
  budget_allocated: number | null;
  budget_spent: number;
  health_score: number | null;
  risk_flags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SprintTask {
  sprint_id: string;
  task_id: string;
  workspace_id: string;
  added_at: string;
  added_by: string | null;
  is_committed: boolean;
  original_estimate: number | null;
}

export interface SprintBurndownPoint {
  id: string;
  sprint_id: string;
  workspace_id: string;
  snapshot_date: string;
  remaining_hours: number | null;
  remaining_points: number | null;
  completed_tasks: number | null;
  total_tasks: number | null;
  ideal_remaining: number | null;
}

export const SPRINT_STATUS_META: Record<
  SprintStatus,
  { label: string; tone: string }
> = {
  planning: { label: "Planning", tone: "bg-muted text-muted-foreground" },
  active: { label: "Active", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  completed: { label: "Completed", tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  cancelled: { label: "Cancelled", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
};
