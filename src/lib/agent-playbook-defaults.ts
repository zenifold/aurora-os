// Default agent playbooks seeded into every workspace.
// Each playbook becomes a one-click "agent brief" that runs through the
// existing agent runtime and respects the approval inbox.

export type PlaybookStage = "presales" | "fulfillment";
export type PlaybookTargetKind = "deal" | "sow" | "project" | "client";
export type PlaybookAutonomy = "suggest" | "bounded" | "autonomous";

export interface PlaybookSeed {
  slug: string;
  name: string;
  description: string;
  stage: PlaybookStage;
  target_kind: PlaybookTargetKind;
  goal_template: string;
  autonomy_override: PlaybookAutonomy;
  sort_order: number;
}

export const DEFAULT_PLAYBOOKS: PlaybookSeed[] = [
  // ─── Pre-sales ────────────────────────────────────────────────
  {
    slug: "qualify_lead",
    name: "Qualify lead",
    description: "Research the company, summarise fit, and recommend next step.",
    stage: "presales",
    target_kind: "deal",
    autonomy_override: "bounded",
    sort_order: 10,
    goal_template:
      "Qualify the deal '{{deal_title}}' (value {{deal_value}} {{deal_currency}}, stage probability {{deal_probability}}%) for client {{client_name}} ({{client_industry}}, website {{client_website}}). " +
      "Research available signals, summarise fit on a 1–5 scale, list 3 specific risks, and recommend the single next action. " +
      "Save the summary as a memory tagged 'lead-qual:{{deal_id}}'.",
  },
  {
    slug: "draft_discovery_email",
    name: "Draft discovery email",
    description: "Drafts an outreach email + meeting agenda; queued for human approval before send.",
    stage: "presales",
    target_kind: "deal",
    autonomy_override: "suggest",
    sort_order: 20,
    goal_template:
      "Draft a short, warm discovery email to the primary contact on deal '{{deal_title}}' for {{client_name}}. " +
      "Include a 4-question discovery agenda. Propose sending via send_email — the human will approve before it goes out. " +
      "Notes from the deal: {{deal_description}}",
  },
  {
    slug: "draft_proposal_outline",
    name: "Draft proposal outline",
    description: "Produces a proposal skeleton (problem, approach, scope, milestones, pricing model).",
    stage: "presales",
    target_kind: "deal",
    autonomy_override: "bounded",
    sort_order: 30,
    goal_template:
      "Create a proposal outline for deal '{{deal_title}}' ({{client_name}}). Sections: Problem, Approach, Scope, Out of scope, Milestones, Pricing model, Assumptions. " +
      "Use generate_document with kind='proposal-outline'. Reference value {{deal_value}} {{deal_currency}}.",
  },
  {
    slug: "draft_sow_outline",
    name: "Draft SOW outline",
    description: "Skeleton SOW: executive summary, scope, deliverables, assumptions, terms.",
    stage: "presales",
    target_kind: "sow",
    autonomy_override: "bounded",
    sort_order: 40,
    goal_template:
      "Draft an SOW outline for '{{sow_title}}' (client {{client_name}}, deal {{deal_title}}). " +
      "Sections: Executive summary, Scope, Deliverables, Assumptions, Acceptance criteria, Commercial terms. " +
      "Use generate_document with kind='sow-outline'. Existing scope notes: {{sow_scope}}",
  },

  // ─── Fulfillment ──────────────────────────────────────────────
  {
    slug: "kickoff_plan",
    name: "Generate kickoff plan",
    description: "Drafts a kickoff plan with workstreams, milestones, and week-1 tasks on the project.",
    stage: "fulfillment",
    target_kind: "project",
    autonomy_override: "bounded",
    sort_order: 10,
    goal_template:
      "Generate a kickoff plan for project '{{project_name}}' ({{client_name}}). " +
      "Propose 3–5 workstreams, key milestones with target dates, and a week-1 task list. " +
      "Use create_task to draft week-1 items on the project. Save plan summary as memory tagged 'kickoff:{{project_id}}'.",
  },
  {
    slug: "weekly_status_update",
    name: "Draft weekly status update",
    description: "Summarises progress, blockers, and next week — queued for approval before posting.",
    stage: "fulfillment",
    target_kind: "project",
    autonomy_override: "suggest",
    sort_order: 20,
    goal_template:
      "Draft this week's status update for '{{project_name}}' ({{client_name}}). " +
      "Pull recent activity via summarize_project. Output: Highlights, Progress, Blockers, Next week. " +
      "Propose post_status_update — the human will approve before it goes to the client.",
  },
  {
    slug: "risk_scan",
    name: "Risk scan",
    description: "Scans overdue tasks and deliverables, surfaces RAID items, notifies the human.",
    stage: "fulfillment",
    target_kind: "project",
    autonomy_override: "bounded",
    sort_order: 30,
    goal_template:
      "Run a RAID scan on project '{{project_name}}'. Use list_overdue_tasks and summarize_project. " +
      "Produce a list of Risks, Assumptions, Issues, Dependencies with severity. Use notify_human for any HIGH severity item.",
  },
  {
    slug: "handover_brief",
    name: "Pre-sales → delivery handover",
    description: "Drafts the handover brief from the closed deal to the delivery team.",
    stage: "fulfillment",
    target_kind: "client",
    autonomy_override: "bounded",
    sort_order: 40,
    goal_template:
      "Draft a pre-sales → delivery handover brief for {{client_name}}. " +
      "Sections: Client snapshot, Commercial scope, Known constraints, Stakeholders, Recommended kickoff agenda. " +
      "Use generate_document with kind='handover-brief'.",
  },
];
