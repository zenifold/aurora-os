export type EscalationTier = 1 | 2 | 3 | 4 | 5;
export type EscalationStatus =
  | "active"
  | "acknowledged"
  | "resolved"
  | "escalated_further";

export interface EscalationConditions {
  margin_below_percent?: number;
  days_overdue?: number;
  client_deliverable_overdue?: boolean;
  budget_overrun_percent?: number;
  schedule_slip_days?: number;
  revision_count_exceeded?: number;
  client_satisfaction_score_below?: number;
  consecutive_l1_alerts?: number;
}

export interface EscalationActions {
  notify_roles?: string[];
  create_task?: { title: string; assignee?: string };
  schedule_meeting?: { type: string; attendees?: string[] };
  freeze_scope?: boolean;
  require_approval_for?: string[];
}

export interface EscalationRule {
  id: string;
  workspace_id: string;
  name: string;
  tier: EscalationTier;
  conditions: EscalationConditions;
  actions: EscalationActions;
  cooldown_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EscalationImpact {
  resolve_by?: string;
  schedule_slip_days?: number;
  revenue_at_risk?: number;
  margin_delta_pp?: number;
  notes?: string;
}

export interface EscalationActionPlanItem {
  id: string;
  text: string;
  done?: boolean;
}

export interface Escalation {
  id: string;
  workspace_id: string;
  rule_id: string | null;
  project_id: string;
  tier: EscalationTier;
  title: string;
  detail: string | null;
  triggered_by: Record<string, unknown>;
  impact: EscalationImpact;
  action_plan: EscalationActionPlanItem[];
  status: EscalationStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export const TIER_LABELS: Record<EscalationTier, string> = {
  1: "L1 · Project Alert",
  2: "L2 · Delivery Intervention",
  3: "L3 · PMO Governance",
  4: "L4 · Commercial Action",
  5: "L5 · Executive",
};

export const TIER_COLORS: Record<EscalationTier, string> = {
  1: "oklch(0.75 0.17 80)",
  2: "oklch(0.7 0.18 50)",
  3: "oklch(0.65 0.2 35)",
  4: "oklch(0.6 0.22 25)",
  5: "oklch(0.55 0.24 15)",
};
