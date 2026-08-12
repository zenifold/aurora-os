/**
 * Branded document kinds. These extend the Page system — a Page with
 * `is_template = true` and a `doc_kind` is a template; without the flag and
 * with `client_account_id` set it's a real client document.
 */

export type DocKind =
  | "proposal"
  | "sow"
  | "contract"
  | "brief"
  | "recap"
  | "status_report"
  | "case_study"
  | "report"
  | "generic";

export type DocStatus = "draft" | "review" | "sent" | "signed" | "archived";

export interface DocKindDef {
  kind: DocKind;
  label: string;
  plural: string;
  icon: string;
  category: "sales" | "delivery" | "marketing";
  description: string;
}

export const DOC_KINDS: Record<DocKind, DocKindDef> = {
  proposal: {
    kind: "proposal",
    label: "Proposal",
    plural: "Proposals",
    icon: "💼",
    category: "sales",
    description: "Persuasive pitch outlining value, approach, and next steps.",
  },
  sow: {
    kind: "sow",
    label: "Statement of Work",
    plural: "SOWs",
    icon: "📜",
    category: "sales",
    description: "Scope, deliverables, timeline, and commercials.",
  },
  contract: {
    kind: "contract",
    label: "Contract",
    plural: "Contracts",
    icon: "⚖️",
    category: "sales",
    description: "Master services agreement or addendum.",
  },
  brief: {
    kind: "brief",
    label: "Project Brief",
    plural: "Briefs",
    icon: "🎯",
    category: "delivery",
    description: "Concise summary of objectives, audience, and success criteria.",
  },
  recap: {
    kind: "recap",
    label: "Meeting Recap",
    plural: "Recaps",
    icon: "🎤",
    category: "delivery",
    description: "Summary of conversation, decisions, and actions.",
  },
  status_report: {
    kind: "status_report",
    label: "Status Report",
    plural: "Status Reports",
    icon: "📊",
    category: "delivery",
    description: "Progress, risks, and what's next.",
  },
  case_study: {
    kind: "case_study",
    label: "Case Study",
    plural: "Case Studies",
    icon: "🏆",
    category: "marketing",
    description: "How an engagement created measurable impact.",
  },
  report: {
    kind: "report",
    label: "Report",
    plural: "Reports",
    icon: "📈",
    category: "marketing",
    description: "Findings, analysis, and recommendations.",
  },
  generic: {
    kind: "generic",
    label: "Document",
    plural: "Documents",
    icon: "📄",
    category: "delivery",
    description: "Blank branded document.",
  },
};

export const DOC_KIND_LIST: DocKindDef[] = Object.values(DOC_KINDS);

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  draft: "Draft",
  review: "In review",
  sent: "Sent",
  signed: "Signed",
  archived: "Archived",
};

export const DOC_STATUS_TONE: Record<DocStatus, string> = {
  draft: "bg-muted text-foreground",
  review: "bg-amber-500/10 text-amber-600",
  sent: "bg-blue-500/10 text-blue-600",
  signed: "bg-emerald-500/10 text-emerald-600",
  archived: "bg-muted text-muted-foreground",
};

export interface BrandKit {
  id: string;
  workspace_id: string;
  client_account_id: string | null;
  name: string;
  logo_url: string | null;
  cover_url: string | null;
  primary_color: string;
  accent_color: string;
  text_color: string;
  font_heading: string;
  font_body: string;
  footer_text: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientDocument {
  id: string;
  workspace_id: string;
  client_account_id: string | null;
  title: string;
  icon: string | null;
  doc_kind: DocKind | null;
  doc_status: DocStatus;
  template_source_id: string | null;
  brand_kit_id: string | null;
  is_template: boolean;
  updated_at: string;
  created_at: string;
}
