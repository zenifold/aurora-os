export type ChangeOrderStatus =
  | "draft"
  | "pending_internal"
  | "pending_client"
  | "approved"
  | "rejected"
  | "applied";

export interface ChangeOrder {
  id: string;
  workspace_id: string;
  project_id: string;
  number: number;
  title: string;
  description: string | null;
  reason: string | null;
  status: ChangeOrderStatus;
  cost_impact: number;
  timeline_impact_days: number;
  currency: string;
  requested_by: string | null;
  internal_approved_by: string | null;
  internal_approved_at: string | null;
  client_approved_by: string | null;
  client_approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export const CO_STATUS_META: Record<ChangeOrderStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  pending_internal: { label: "Pending internal", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  pending_client: { label: "Pending client", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  approved: { label: "Approved", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "Rejected", color: "bg-red-500/15 text-red-600 dark:text-red-400" },
  applied: { label: "Applied", color: "bg-primary/15 text-primary" },
};
