import type { StatusCategory, Gate, TransitionPermission } from "./workflow-types";

export interface TemplateStatus {
  name: string;
  category: StatusCategory;
  color: string;
  is_start?: boolean;
  is_terminal?: boolean;
  wip_limit?: number | null;
  sla_hours?: number | null;
  exit_criteria?: Gate[];
}

export interface TemplateTransition {
  /** Index into statuses[] */
  from: number;
  to: number;
  permission?: TransitionPermission;
  button_label?: string;
  gates?: Gate[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;
  statuses: TemplateStatus[];
  /** If omitted, all-pairs transitions are created. */
  transitions?: TemplateTransition[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "default",
    name: "Simple",
    emoji: "✳️",
    description: "Three statuses. Move freely between them.",
    statuses: [
      { name: "Todo", category: "todo", color: "#94a3b8", is_start: true },
      { name: "In Progress", category: "in_progress", color: "#3b82f6" },
      { name: "Done", category: "done", color: "#10b981", is_terminal: true },
    ],
  },
  {
    id: "kanban",
    name: "Kanban",
    emoji: "📋",
    description: "Backlog → Ready → In Progress (WIP 3) → Review → Done",
    statuses: [
      { name: "Backlog", category: "backlog", color: "#64748b", is_start: true },
      { name: "Ready", category: "todo", color: "#94a3b8" },
      { name: "In Progress", category: "in_progress", color: "#3b82f6", wip_limit: 3 },
      { name: "Review", category: "review", color: "#a855f7", wip_limit: 5 },
      { name: "Done", category: "done", color: "#10b981", is_terminal: true },
    ],
    transitions: [
      { from: 0, to: 1 },
      { from: 1, to: 2, button_label: "Start" },
      { from: 2, to: 3, button_label: "Submit for review" },
      { from: 3, to: 2, button_label: "Send back" },
      { from: 3, to: 4, button_label: "Approve & close" },
      { from: 1, to: 0 },
      { from: 2, to: 1 },
    ],
  },
  {
    id: "scrum",
    name: "Scrum",
    emoji: "🏃",
    description: "Backlog → Sprint → In Progress → Code Review → QA → Done",
    statuses: [
      { name: "Backlog", category: "backlog", color: "#64748b", is_start: true },
      { name: "Sprint", category: "todo", color: "#94a3b8" },
      { name: "In Progress", category: "in_progress", color: "#3b82f6", sla_hours: 72 },
      { name: "Code Review", category: "review", color: "#a855f7", sla_hours: 24 },
      { name: "QA", category: "review", color: "#ec4899", sla_hours: 48 },
      { name: "Done", category: "done", color: "#10b981", is_terminal: true },
    ],
    transitions: [
      { from: 0, to: 1, button_label: "Add to sprint" },
      { from: 1, to: 2, button_label: "Start work" },
      { from: 2, to: 3, button_label: "Submit for review" },
      { from: 3, to: 2, button_label: "Request changes" },
      { from: 3, to: 4, button_label: "Approve" },
      { from: 4, to: 2, button_label: "Reopen" },
      { from: 4, to: 5, button_label: "Ship it" },
      { from: 1, to: 0 },
    ],
  },
  {
    id: "bug",
    name: "Bug Tracker",
    emoji: "🐛",
    description: "Open → Triaged → In Progress → Verifying → Resolved / Closed",
    statuses: [
      { name: "Open", category: "todo", color: "#ef4444", is_start: true },
      { name: "Triaged", category: "todo", color: "#f59e0b" },
      { name: "In Progress", category: "in_progress", color: "#3b82f6" },
      { name: "Verifying", category: "review", color: "#a855f7" },
      { name: "Resolved", category: "done", color: "#10b981" },
      { name: "Closed", category: "done", color: "#64748b", is_terminal: true },
      { name: "Won't Fix", category: "cancelled", color: "#94a3b8", is_terminal: true },
    ],
    transitions: [
      { from: 0, to: 1, button_label: "Triage" },
      { from: 0, to: 6, button_label: "Won't fix" },
      { from: 1, to: 2, button_label: "Start fix" },
      { from: 1, to: 6, button_label: "Won't fix" },
      { from: 2, to: 3, button_label: "Ready to verify" },
      { from: 3, to: 2, button_label: "Reopen" },
      { from: 3, to: 4, button_label: "Mark resolved" },
      { from: 4, to: 5, button_label: "Close" },
      { from: 4, to: 2, button_label: "Reopen" },
    ],
  },
  {
    id: "approval",
    name: "Approval Pipeline",
    emoji: "✅",
    description: "Draft → In Review → Approved / Rejected with required reviewer",
    statuses: [
      { name: "Draft", category: "todo", color: "#94a3b8", is_start: true },
      { name: "In Review", category: "review", color: "#a855f7", sla_hours: 48 },
      { name: "Approved", category: "done", color: "#10b981", is_terminal: true },
      { name: "Rejected", category: "cancelled", color: "#ef4444", is_terminal: true },
    ],
    transitions: [
      {
        from: 0,
        to: 1,
        button_label: "Submit for review",
        gates: [
          {
            id: "g_assignee",
            type: "field_required",
            field: "assignee_ids",
            message: "Assign a reviewer before submitting",
          },
        ],
      },
      { from: 1, to: 2, button_label: "Approve", permission: "assignee" },
      { from: 1, to: 3, button_label: "Reject", permission: "assignee" },
      { from: 1, to: 0, button_label: "Send back to draft" },
    ],
  },
];
