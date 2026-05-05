export type ResourceType = "contractor" | "ai_agent" | "vendor" | "external";

export interface Resource {
  id: string;
  workspace_id: string;
  name: string;
  type: ResourceType;
  user_id: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
  department: string | null;
  start_date: string | null;
  end_date: string | null;
  weekly_capacity_hours: number;
  daily_capacity_hours: number;
  timezone: string | null;
  work_schedule: Record<string, number>;
  cost_rate_currency: string;
  cost_rate_amount: number | null;
  cost_rate_period: "hourly" | "daily" | "monthly" | "yearly" | null;
  billable: boolean;
  bill_rate_currency: string;
  bill_rate_amount: number | null;
  bill_rate_period: "hourly" | "daily" | "fixed" | null;
  skills: string[];
  tags: string[];
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AllocationType = "fixed_hours" | "percentage" | "full_time" | "scheduled_hours";
export type AllocationStatus = "planned" | "active" | "completed" | "cancelled";

export interface ResourceAllocation {
  id: string;
  workspace_id: string;
  project_id: string;
  team_member_user_id: string | null;
  resource_id: string | null;
  allocation_type: AllocationType;
  percentage: number | null;
  fixed_hours: number | null;
  scheduled_hours: Record<string, number> | null;
  start_date: string;
  end_date: string | null;
  billable: boolean;
  bill_rate_override: number | null;
  cost_rate_override: number | null;
  status: AllocationStatus;
  actual_hours_logged: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type UnavailabilityType = "pto" | "sick" | "holiday" | "training" | "bench" | "other";

export interface ResourceUnavailability {
  id: string;
  workspace_id: string;
  team_member_user_id: string | null;
  resource_id: string | null;
  type: UnavailabilityType;
  start_date: string;
  end_date: string;
  hours_per_day: number;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
}

export type DocumentType =
  | "sow"
  | "contract"
  | "msa"
  | "amendment"
  | "proposal"
  | "invoice"
  | "timesheet"
  | "legal"
  | "compliance"
  | "other";

export type SignatureStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "expired"
  | "declined"
  | "not_required";

export interface ProjectDocument {
  id: string;
  workspace_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  document_type: DocumentType;
  file_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  version: number;
  previous_version_id: string | null;
  contract_value: number | null;
  currency: string | null;
  visibility: "internal" | "client" | "public";
  requires_nda: boolean;
  signature_status: SignatureStatus;
  signed_at: string | null;
  signed_by: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  sow: "SOW",
  contract: "Contract",
  msa: "MSA",
  amendment: "Amendment",
  proposal: "Proposal",
  invoice: "Invoice",
  timesheet: "Timesheet",
  legal: "Legal",
  compliance: "Compliance",
  other: "Other",
};

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  contractor: "Contractor",
  ai_agent: "AI Agent",
  vendor: "Vendor",
  external: "External",
};

export function utilizationColor(pct: number | null | undefined) {
  if (pct == null) return "bg-muted";
  if (pct === 0) return "bg-muted";
  if (pct < 70) return "bg-amber-500/30";
  if (pct <= 90) return "bg-emerald-500/40";
  if (pct <= 100) return "bg-orange-500/40";
  return "bg-red-500/50";
}

export function utilizationLabel(pct: number | null | undefined) {
  if (pct == null) return "—";
  return `${Math.round(pct)}%`;
}
