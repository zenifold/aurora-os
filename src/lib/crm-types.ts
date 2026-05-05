export interface Contact {
  id: string;
  workspace_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  avatar_url: string | null;
  notes: string | null;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type DealStageType = "open" | "won" | "lost";

export interface DealStage {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  order_index: number;
  stage_type: DealStageType;
  default_probability: number;
  created_at: string;
}

export type DealStatus = "open" | "won" | "lost";

export interface Deal {
  id: string;
  workspace_id: string;
  stage_id: string;
  contact_id: string | null;
  owner_id: string | null;
  title: string;
  description: string | null;
  value: number | null;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  source: string | null;
  tags: string[];
  position: number;
  status: DealStatus;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  handed_off_project_id: string | null;
  handed_off_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type DealActivityType =
  | "note"
  | "call"
  | "email"
  | "meeting"
  | "stage_change"
  | "system";

export interface DealActivity {
  id: string;
  workspace_id: string;
  deal_id: string;
  author_id: string | null;
  activity_type: DealActivityType;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function formatDealValue(amount: number | null | undefined, currency = "USD") {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}
