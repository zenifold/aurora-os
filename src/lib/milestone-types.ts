export type MilestoneType = "delivery" | "payment" | "gate" | "review";
export type MilestoneStatus = "upcoming" | "at_risk" | "completed" | "missed" | "cancelled";
export type SignoffStatus = "not_required" | "pending" | "requested" | "approved" | "rejected";

export interface Milestone {
  id: string;
  requires_signoff?: boolean;
  signoff_status?: SignoffStatus;
  signoff_requested_at?: string | null;
  signoff_requested_by?: string | null;
  signoff_signed_at?: string | null;
  signoff_signed_by_portal_access_id?: string | null;
  signoff_signed_name?: string | null;
  signoff_signature_text?: string | null;
  signoff_notes?: string | null;
  signoff_rejection_reason?: string | null;
  workspace_id: string;
  project_id: string;
  name: string;
  description: string | null;
  milestone_type: MilestoneType;
  status: MilestoneStatus;
  target_date: string;
  actual_date: string | null;
  payment_amount: number | null;
  payment_currency: string | null;
  is_paid: boolean;
  completion_criteria: string | null;
  depends_on_ids: string[];
  order_index: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const MILESTONE_TYPE_META: Record<MilestoneType, { label: string; tone: string }> = {
  delivery: { label: "Delivery", tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  payment: { label: "Payment", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  gate: { label: "Gate", tone: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  review: { label: "Review", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
};

export const MILESTONE_STATUS_META: Record<MilestoneStatus, { label: string; tone: string }> = {
  upcoming: { label: "Upcoming", tone: "bg-muted text-muted-foreground" },
  at_risk: { label: "At risk", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  completed: { label: "Completed", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  missed: { label: "Missed", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  cancelled: { label: "Cancelled", tone: "bg-muted text-muted-foreground line-through" },
};

export const SIGNOFF_STATUS_META: Record<SignoffStatus, { label: string; tone: string }> = {
  not_required: { label: "Sign-off not required", tone: "bg-muted text-muted-foreground" },
  pending: { label: "Sign-off pending", tone: "bg-muted text-muted-foreground" },
  requested: { label: "Awaiting client sign-off", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  approved: { label: "Client approved", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "Changes requested", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
};
