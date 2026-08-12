// Catalog of post-sale delivery deliverable kinds + default section schemas.

export type SectionKind =
  | "text"
  | "list"
  | "table"
  | "deliverables"
  | "team"
  | "timeline"
  | "financials"
  | "risks";

export type SectionDef = {
  key: string;
  label: string;
  kind: SectionKind;
  required?: boolean;
  ai_prompt?: string;
};

export type DeliveryKind =
  | "project_plan"
  | "kickoff_deck"
  | "status_report"
  | "uat_plan"
  | "training_guide"
  | "runbook"
  | "release_notes"
  | "handover_doc"
  | "change_order"
  | "retrospective"
  | "support_handbook"
  | "qbr"
  | "custom";

export type DeliveryKindDef = {
  kind: DeliveryKind;
  label: string;
  icon: string;
  description: string;
  sections: SectionDef[];
  defaultModel?: string;
};

export const DELIVERY_KINDS: DeliveryKindDef[] = [
  {
    kind: "project_plan",
    label: "Project plan",
    icon: "kanban",
    description: "Phased plan with milestones, deliverables, RACI and dependencies.",
    sections: [
      { key: "overview", label: "Overview", kind: "text", required: true },
      { key: "objectives", label: "Objectives", kind: "list", required: true },
      { key: "scope", label: "In-scope / out-of-scope", kind: "text" },
      { key: "phases", label: "Phases & milestones", kind: "timeline", required: true },
      { key: "deliverables", label: "Deliverables", kind: "deliverables", required: true },
      { key: "team", label: "Team & RACI", kind: "team" },
      { key: "risks", label: "Risks", kind: "risks" },
      { key: "communication_plan", label: "Communication plan", kind: "text" },
      { key: "success_criteria", label: "Success criteria", kind: "list" },
    ],
  },
  {
    kind: "kickoff_deck",
    label: "Kickoff deck",
    icon: "presentation",
    description: "Client-facing kickoff narrative covering goals, plan, team and next steps.",
    sections: [
      { key: "welcome", label: "Welcome & purpose", kind: "text", required: true },
      { key: "goals", label: "Goals & outcomes", kind: "list", required: true },
      { key: "approach", label: "Approach", kind: "text" },
      { key: "timeline", label: "Timeline", kind: "timeline" },
      { key: "team", label: "Team", kind: "team" },
      { key: "ways_of_working", label: "Ways of working", kind: "text" },
      { key: "next_steps", label: "Next steps", kind: "list" },
    ],
  },
  {
    kind: "status_report",
    label: "Status report",
    icon: "activity",
    description: "Weekly/bi-weekly client status update with progress, risks and asks.",
    sections: [
      { key: "headline", label: "Headline", kind: "text", required: true },
      { key: "rag", label: "RAG status", kind: "text" },
      { key: "progress", label: "Progress since last update", kind: "list", required: true },
      { key: "upcoming", label: "Upcoming work", kind: "list" },
      { key: "risks", label: "Risks & issues", kind: "risks" },
      { key: "asks", label: "Decisions / asks", kind: "list" },
      { key: "metrics", label: "Key metrics", kind: "table" },
    ],
  },
  {
    kind: "uat_plan",
    label: "UAT plan",
    icon: "clipboard-check",
    description: "User acceptance test plan with scenarios, entry/exit and sign-off.",
    sections: [
      { key: "overview", label: "Overview", kind: "text", required: true },
      { key: "in_scope", label: "In scope", kind: "list" },
      { key: "entry_criteria", label: "Entry criteria", kind: "list" },
      { key: "exit_criteria", label: "Exit criteria", kind: "list" },
      { key: "scenarios", label: "Test scenarios", kind: "table", required: true },
      { key: "defect_process", label: "Defect process", kind: "text" },
      { key: "signoff", label: "Sign-off", kind: "text" },
    ],
  },
  {
    kind: "training_guide",
    label: "Training guide",
    icon: "graduation-cap",
    description: "End-user training narrative with audiences, modules and exercises.",
    sections: [
      { key: "audience", label: "Audience", kind: "text", required: true },
      { key: "objectives", label: "Learning objectives", kind: "list", required: true },
      { key: "modules", label: "Modules", kind: "table" },
      { key: "exercises", label: "Exercises", kind: "list" },
      { key: "support", label: "Support & resources", kind: "text" },
    ],
  },
  {
    kind: "runbook",
    label: "Runbook",
    icon: "book",
    description: "Operational runbook: components, SOPs, on-call and recovery steps.",
    sections: [
      { key: "overview", label: "Overview", kind: "text", required: true },
      { key: "architecture", label: "Architecture", kind: "text" },
      { key: "components", label: "Components", kind: "table" },
      { key: "sops", label: "Standard operating procedures", kind: "list", required: true },
      { key: "on_call", label: "On-call & escalation", kind: "text" },
      { key: "recovery", label: "Recovery procedures", kind: "list" },
    ],
  },
  {
    kind: "release_notes",
    label: "Release notes",
    icon: "rocket",
    description: "Client-facing release narrative: what shipped, fixes, known issues.",
    sections: [
      { key: "summary", label: "Release summary", kind: "text", required: true },
      { key: "new_features", label: "New features", kind: "list", required: true },
      { key: "improvements", label: "Improvements", kind: "list" },
      { key: "fixes", label: "Fixes", kind: "list" },
      { key: "known_issues", label: "Known issues", kind: "list" },
      { key: "next", label: "What's next", kind: "text" },
    ],
  },
  {
    kind: "handover_doc",
    label: "Handover document",
    icon: "file-output",
    description: "Transition pack to client or internal support: assets, accounts, contacts.",
    sections: [
      { key: "summary", label: "Engagement summary", kind: "text", required: true },
      { key: "assets", label: "Assets & repositories", kind: "list" },
      { key: "accounts", label: "Accounts & credentials", kind: "table" },
      { key: "contacts", label: "Contacts", kind: "table" },
      { key: "open_items", label: "Open items", kind: "list" },
      { key: "support_model", label: "Support model", kind: "text" },
    ],
  },
  {
    kind: "change_order",
    label: "Change order",
    icon: "file-diff",
    description: "Formal scope/price/timeline change request for client approval.",
    sections: [
      { key: "background", label: "Background", kind: "text", required: true },
      { key: "change_summary", label: "Change summary", kind: "text", required: true },
      { key: "impact_scope", label: "Scope impact", kind: "text" },
      { key: "impact_timeline", label: "Timeline impact", kind: "timeline" },
      { key: "impact_financials", label: "Financial impact", kind: "financials", required: true },
      { key: "assumptions", label: "Assumptions", kind: "list" },
      { key: "approval", label: "Approval", kind: "text" },
    ],
  },
  {
    kind: "retrospective",
    label: "Retrospective",
    icon: "rotate-ccw",
    description: "Post-phase or post-project retrospective with insights and actions.",
    sections: [
      { key: "summary", label: "Summary", kind: "text", required: true },
      { key: "what_worked", label: "What worked", kind: "list" },
      { key: "what_didnt", label: "What didn't", kind: "list" },
      { key: "metrics", label: "Metrics", kind: "table" },
      { key: "actions", label: "Action items", kind: "list", required: true },
    ],
  },
  {
    kind: "support_handbook",
    label: "Support handbook",
    icon: "life-buoy",
    description: "Ongoing support model, SLAs, contact channels and ticket flow.",
    sections: [
      { key: "overview", label: "Overview", kind: "text", required: true },
      { key: "scope", label: "Support scope", kind: "text" },
      { key: "slas", label: "SLAs", kind: "table" },
      { key: "channels", label: "Contact channels", kind: "list" },
      { key: "escalation", label: "Escalation path", kind: "text" },
    ],
  },
  {
    kind: "qbr",
    label: "Quarterly business review",
    icon: "bar-chart-3",
    description: "Executive QBR: outcomes delivered, value realized, roadmap, asks.",
    sections: [
      { key: "headline", label: "Headline", kind: "text", required: true },
      { key: "outcomes", label: "Outcomes delivered", kind: "list", required: true },
      { key: "value", label: "Value realized", kind: "text" },
      { key: "metrics", label: "Key metrics", kind: "table" },
      { key: "roadmap", label: "Roadmap & next quarter", kind: "timeline" },
      { key: "risks", label: "Risks", kind: "risks" },
      { key: "asks", label: "Asks", kind: "list" },
    ],
  },
  {
    kind: "custom",
    label: "Custom document",
    icon: "file",
    description: "Empty starting point — define your own sections.",
    sections: [{ key: "body", label: "Body", kind: "text", required: true }],
  },
];

export const DELIVERY_KIND_MAP: Record<string, DeliveryKindDef> =
  Object.fromEntries(DELIVERY_KINDS.map((k) => [k.kind, k]));

export function getDeliveryKindDef(kind: string): DeliveryKindDef | undefined {
  return DELIVERY_KIND_MAP[kind];
}
