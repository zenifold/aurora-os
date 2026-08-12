import type { MilestoneType } from "@/lib/milestone-types";

export type PlaybookKind = "delivery" | "onboarding" | "audit" | "launch" | "custom";

export interface ProjectPlaybook {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  kind: PlaybookKind;
  default_duration_days: number;
  is_archived: boolean;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaybookMilestone {
  id: string;
  workspace_id: string;
  playbook_id: string;
  name: string;
  description: string | null;
  milestone_type: MilestoneType;
  day_offset: number;
  requires_signoff: boolean;
  order_index: number;
  created_at: string;
}

export interface PlaybookTask {
  id: string;
  workspace_id: string;
  playbook_id: string;
  playbook_milestone_id: string | null;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  task_type: "initiative" | "epic" | "task" | "subtask";
  day_offset_start: number | null;
  day_offset_due: number | null;
  assignee_role_hint: string | null;
  is_customer_task: boolean;
  estimated_hours: number | null;
  tags: string[];
  order_index: number;
  created_at: string;
}

export const PLAYBOOK_KIND_META: Record<PlaybookKind, { label: string; tone: string }> = {
  delivery: { label: "Delivery", tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  onboarding: { label: "Onboarding", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  audit: { label: "Audit", tone: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  launch: { label: "Launch", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  custom: { label: "Custom", tone: "bg-muted text-muted-foreground" },
};
