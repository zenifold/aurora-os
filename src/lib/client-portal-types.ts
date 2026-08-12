export type ClientRole = "viewer" | "contributor" | "stakeholder";

export type DeliverableType =
  | "approval"
  | "review"
  | "feedback"
  | "content_upload"
  | "data_provision"
  | "signature"
  | "payment"
  | "decision";

export type DeliverableReviewStatus =
  | "pending"
  | "submitted"
  | "needs_revision"
  | "approved"
  | "rejected";

export interface ClientPortalAccess {
  id: string;
  workspace_id: string;
  project_id: string;
  email: string;
  name: string;
  company: string | null;
  avatar_url: string | null;
  role: ClientRole;
  access_token: string;
  token_expires_at: string | null;
  visible_task_types: string[];
  can_see_financials: boolean;
  can_see_team_names: boolean;
  can_see_timeline: boolean;
  can_see_invoices: boolean;
  can_see_documents: boolean;

  custom_brand_color: string | null;
  is_active: boolean;
  last_login_at: string | null;
  invited_by: string | null;
  invited_at: string;
  created_at: string;
  updated_at: string;
}

export interface ClientDeliverable {
  id: string;
  workspace_id: string;
  project_id: string;
  task_id: string;
  client_portal_access_id: string | null;
  deliverable_type: DeliverableType;
  client_instructions: string | null;
  client_deadline: string | null;
  impact_description: string | null;
  downstream_task_ids: string[];
  submitted_at: string | null;
  submitted_by: string | null;
  submitted_content: { files?: string[]; comments?: string; decision?: string } | null;
  review_status: DeliverableReviewStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  revision_count: number;
  max_revisions: number;
  created_at: string;
  updated_at: string;
}

export const DELIVERABLE_TYPE_LABELS: Record<DeliverableType, string> = {
  approval: "Approval",
  review: "Review",
  feedback: "Feedback",
  content_upload: "Content upload",
  data_provision: "Data provision",
  signature: "Signature",
  payment: "Payment",
  decision: "Decision",
};

export const ROLE_LABELS: Record<ClientRole, string> = {
  viewer: "Viewer — read-only",
  contributor: "Contributor — complete tasks, comment, upload",
  stakeholder: "Stakeholder — contributor + financial summary",
};

export const REVIEW_STATUS_LABELS: Record<DeliverableReviewStatus, string> = {
  pending: "Awaiting client",
  submitted: "Submitted",
  needs_revision: "Needs revision",
  approved: "Approved",
  rejected: "Rejected",
};
