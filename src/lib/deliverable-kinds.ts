// Catalog of pre-sales deliverable kinds and their default section schemas.
// Used by the generic agent + UI; templates in DB can override per workspace.

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

export type DeliverableKind =
  | "sow"
  | "proposal"
  | "discovery_report"
  | "tech_architecture"
  | "business_case"
  | "rfp_response"
  | "pricing_options"
  | "security_questionnaire"
  | "mutual_action_plan"
  | "capability_deck"
  | "demo_script"
  | "custom";

export type DeliverableKindDef = {
  kind: DeliverableKind;
  label: string;
  icon: string; // lucide name
  description: string;
  sections: SectionDef[];
  defaultModel?: string;
};

const sowSections: SectionDef[] = [
  { key: "executive_summary", label: "Executive summary", kind: "text", required: true },
  { key: "strategy", label: "Strategic approach", kind: "text" },
  { key: "positioning", label: "Positioning & why us", kind: "text" },
  { key: "value_proposition", label: "Value proposition", kind: "text" },
  { key: "scope", label: "Scope of work", kind: "text", required: true },
  { key: "out_of_scope", label: "Out of scope", kind: "text" },
  { key: "technical_architecture", label: "Technical architecture", kind: "text" },
  { key: "integrations_approach", label: "Integrations approach", kind: "text" },
  { key: "deliverables", label: "Deliverables", kind: "deliverables", required: true },
  { key: "team_composition", label: "Team composition", kind: "team" },
  { key: "timeline", label: "Timeline & phases", kind: "timeline", required: true },
  { key: "financials", label: "Financials", kind: "financials", required: true },
  { key: "assumptions", label: "Assumptions", kind: "list" },
  { key: "risks", label: "Risks & mitigations", kind: "risks" },
  { key: "success_criteria", label: "Success criteria", kind: "list" },
  { key: "terms_conditions", label: "Terms & conditions", kind: "text" },
  { key: "next_steps", label: "Next steps", kind: "text" },
];

export const DELIVERABLE_KINDS: DeliverableKindDef[] = [
  {
    kind: "sow",
    label: "Statement of Work",
    icon: "file-signature",
    description: "Formal contract scope, deliverables, timeline, and price.",
    sections: sowSections,
  },
  {
    kind: "proposal",
    label: "Proposal",
    icon: "file-text",
    description: "Persuasive narrative covering problem, solution, value, and price options.",
    sections: [
      { key: "executive_summary", label: "Executive summary", kind: "text", required: true },
      { key: "problem_statement", label: "Problem statement", kind: "text", required: true },
      { key: "proposed_solution", label: "Proposed solution", kind: "text", required: true },
      { key: "value_proposition", label: "Value proposition", kind: "text" },
      { key: "approach", label: "Approach & methodology", kind: "text" },
      { key: "deliverables", label: "Deliverables", kind: "deliverables" },
      { key: "timeline", label: "Timeline", kind: "timeline" },
      { key: "investment_options", label: "Investment options", kind: "financials" },
      { key: "team", label: "Team", kind: "team" },
      { key: "why_us", label: "Why us", kind: "text" },
      { key: "case_studies", label: "Relevant case studies", kind: "list" },
      { key: "next_steps", label: "Next steps", kind: "text" },
    ],
  },
  {
    kind: "discovery_report",
    label: "Discovery Report",
    icon: "search",
    description: "Synthesized findings from discovery: goals, users, constraints, risks.",
    sections: [
      { key: "summary", label: "Summary", kind: "text", required: true },
      { key: "business_context", label: "Business context", kind: "text" },
      { key: "stakeholders", label: "Stakeholders & users", kind: "text" },
      { key: "current_state", label: "Current state", kind: "text" },
      { key: "desired_outcomes", label: "Desired outcomes & KPIs", kind: "list", required: true },
      { key: "constraints", label: "Constraints", kind: "list" },
      { key: "unknowns", label: "Open questions", kind: "list" },
      { key: "recommendations", label: "Recommendations", kind: "text" },
    ],
  },
  {
    kind: "tech_architecture",
    label: "Technical Architecture Brief",
    icon: "layers",
    description: "Proposed system architecture, integrations, data model, non-functionals.",
    sections: [
      { key: "overview", label: "Overview", kind: "text", required: true },
      { key: "system_diagram", label: "System diagram (description)", kind: "text" },
      { key: "components", label: "Core components", kind: "list", required: true },
      { key: "data_model", label: "Data model", kind: "text" },
      { key: "integrations", label: "Integrations", kind: "list" },
      { key: "non_functionals", label: "Non-functional requirements", kind: "list" },
      { key: "security", label: "Security & compliance", kind: "text" },
      { key: "hosting", label: "Hosting & infrastructure", kind: "text" },
      { key: "risks", label: "Technical risks", kind: "risks" },
    ],
  },
  {
    kind: "business_case",
    label: "Business Case / ROI",
    icon: "trending-up",
    description: "Quantified value: cost, benefit, payback, sensitivity.",
    sections: [
      { key: "summary", label: "Executive summary", kind: "text", required: true },
      { key: "problem_cost", label: "Cost of the problem today", kind: "text" },
      { key: "expected_benefits", label: "Expected benefits", kind: "list", required: true },
      { key: "investment", label: "Investment required", kind: "financials", required: true },
      { key: "roi_model", label: "ROI model & assumptions", kind: "text" },
      { key: "payback", label: "Payback period", kind: "text" },
      { key: "sensitivity", label: "Sensitivity analysis", kind: "text" },
      { key: "risks", label: "Risks to value", kind: "risks" },
    ],
  },
  {
    kind: "rfp_response",
    label: "RFP Response",
    icon: "clipboard-check",
    description: "Structured response to a customer RFP/RFQ/RFI.",
    sections: [
      { key: "cover_letter", label: "Cover letter", kind: "text" },
      { key: "company_overview", label: "Company overview", kind: "text" },
      { key: "requirements_matrix", label: "Requirements compliance matrix", kind: "table", required: true },
      { key: "approach", label: "Approach", kind: "text" },
      { key: "team", label: "Team & credentials", kind: "team" },
      { key: "references", label: "References", kind: "list" },
      { key: "pricing", label: "Pricing", kind: "financials" },
      { key: "assumptions", label: "Assumptions & exceptions", kind: "list" },
    ],
  },
  {
    kind: "pricing_options",
    label: "Pricing Options",
    icon: "dollar-sign",
    description: "Tiered pricing scenarios with trade-offs.",
    sections: [
      { key: "context", label: "Context", kind: "text" },
      { key: "options", label: "Options (Good / Better / Best)", kind: "table", required: true },
      { key: "recommendation", label: "Our recommendation", kind: "text" },
      { key: "assumptions", label: "Assumptions", kind: "list" },
    ],
  },
  {
    kind: "security_questionnaire",
    label: "Security Questionnaire",
    icon: "shield",
    description: "Responses to a customer security/vendor-risk questionnaire.",
    sections: [
      { key: "summary", label: "Security posture summary", kind: "text" },
      { key: "certifications", label: "Certifications", kind: "list" },
      { key: "responses", label: "Question-by-question responses", kind: "table", required: true },
      { key: "policies", label: "Referenced policies", kind: "list" },
    ],
  },
  {
    kind: "mutual_action_plan",
    label: "Mutual Action Plan",
    icon: "list-checks",
    description: "Shared checklist of buyer + seller actions to close.",
    sections: [
      { key: "goal", label: "Shared goal & target date", kind: "text", required: true },
      { key: "milestones", label: "Milestones", kind: "timeline", required: true },
      { key: "buyer_actions", label: "Buyer actions", kind: "list" },
      { key: "seller_actions", label: "Seller actions", kind: "list" },
      { key: "risks", label: "Risks to the close date", kind: "risks" },
    ],
  },
  {
    kind: "capability_deck",
    label: "Capability Deck Outline",
    icon: "presentation",
    description: "Slide-by-slide outline of a tailored capabilities deck.",
    sections: [
      { key: "slides", label: "Slides", kind: "list", required: true },
      { key: "talking_points", label: "Talking points", kind: "text" },
    ],
  },
  {
    kind: "demo_script",
    label: "Demo Script",
    icon: "play",
    description: "Tailored demo flow tied to the customer's discovery findings.",
    sections: [
      { key: "audience", label: "Audience & objectives", kind: "text", required: true },
      { key: "flow", label: "Demo flow", kind: "list", required: true },
      { key: "value_callouts", label: "Value callouts per step", kind: "list" },
      { key: "objections", label: "Anticipated objections & answers", kind: "list" },
    ],
  },
];

export const DELIVERABLE_KIND_MAP: Record<string, DeliverableKindDef> = Object.fromEntries(
  DELIVERABLE_KINDS.map((k) => [k.kind, k]),
);

export function getKindDef(kind: string): DeliverableKindDef | undefined {
  return DELIVERABLE_KIND_MAP[kind];
}
