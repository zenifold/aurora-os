export interface TeamMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  seniority: string | null;
  weekly_capacity_hours: number;
  hourly_cost: number | null;
  hourly_bill_rate: number | null;
  skills: string[];
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeLog {
  id: string;
  workspace_id: string;
  task_id: string;
  project_id: string;
  user_id: string;
  sprint_id: string | null;
  hours: number;
  log_date: string;
  description: string | null;
  is_billable: boolean;
  hourly_rate_snapshot: number | null;
  created_at: string;
  updated_at: string;
}

export const TEAM_ROLES = [
  "designer",
  "developer",
  "pm",
  "strategist",
  "qa",
  "contributor",
  "lead",
] as const;

export const SENIORITY_LEVELS = ["junior", "mid", "senior", "lead", "principal"] as const;
