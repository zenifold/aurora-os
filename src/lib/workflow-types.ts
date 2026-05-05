export type StatusCategory =
  | "backlog"
  | "todo"
  | "in_progress"
  | "review"
  | "done"
  | "cancelled";

export type GateType =
  | "field_required"
  | "approval_required"
  | "all_blockers_resolved"
  | "subtasks_status"
  | "checklist_min"
  | "time_logged"
  | "no_open_blockers"
  | "child_tasks_status"
  | "custom_field";

export type GateBehavior = "block" | "warn" | "request_approval";

export interface GateBase {
  id: string;
  type: GateType;
  message?: string;
  behavior?: GateBehavior; // default block
}

export interface FieldRequiredGate extends GateBase {
  type: "field_required";
  field: string; // built-in (assignee_ids, due_date, ...) or custom field name
}

export interface ApprovalRequiredGate extends GateBase {
  type: "approval_required";
  approver_ids: string[]; // user ids
  min_approvals: number;
  allow_self_approve?: boolean;
}

export interface SubtasksStatusGate extends GateBase {
  type: "subtasks_status";
  statuses: StatusCategory[]; // by category
}

export interface ChecklistMinGate extends GateBase {
  type: "checklist_min";
  percent: number; // 0-100
}

export interface TimeLoggedGate extends GateBase {
  type: "time_logged";
  min_hours: number;
}

export interface BlockersResolvedGate extends GateBase {
  type: "all_blockers_resolved" | "no_open_blockers";
}

export interface ChildTasksStatusGate extends GateBase {
  type: "child_tasks_status";
  statuses: StatusCategory[];
  allow_percent?: number; // default 100
}

export interface CustomFieldGate extends GateBase {
  type: "custom_field";
  field_id: string;
  operator: "is" | "is_not" | "is_empty" | "is_not_empty" | "contains";
  value?: unknown;
}

export type Gate =
  | FieldRequiredGate
  | ApprovalRequiredGate
  | SubtasksStatusGate
  | ChecklistMinGate
  | TimeLoggedGate
  | BlockersResolvedGate
  | ChildTasksStatusGate
  | CustomFieldGate;

export type ActionType =
  | "notify"
  | "set_field"
  | "create_subtask"
  | "webhook"
  | "run_workflow";

export interface WorkflowAction {
  id: string;
  type: ActionType;
  // arbitrary config; consumers handle the supported subset
  config: Record<string, unknown>;
}

export type TransitionPermission =
  | "anyone"
  | "assignee"
  | "creator"
  | "admin"
  | "manager"
  | "role_specific";

export interface WorkflowStatus {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  color: string;
  icon: string;
  category: StatusCategory;
  order_index: number;
  is_start: boolean;
  is_terminal: boolean;
  wip_limit: number | null;
  sla_hours: number | null;
  auto_assign_to: Record<string, unknown> | null;
  entry_criteria: Gate[];
  exit_criteria: Gate[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowTransition {
  id: string;
  workspace_id: string;
  project_id: string;
  from_status_id: string;
  to_status_id: string;
  permission: TransitionPermission;
  allowed_role: string | null;
  gates: Gate[];
  actions: WorkflowAction[];
  button_label: string | null;
  confirmation_message: string | null;
}

export interface TransitionApproval {
  id: string;
  workspace_id: string;
  task_id: string;
  transition_id: string;
  requested_by: string;
  requested_at: string;
  approver_id: string;
  status: "pending" | "approved" | "rejected";
  comment: string | null;
  decided_at: string | null;
}

export interface TaskStatusHistoryRow {
  id: string;
  workspace_id: string;
  task_id: string;
  from_status_id: string | null;
  to_status_id: string | null;
  from_status_name: string | null;
  to_status_name: string | null;
  transition_id: string | null;
  triggered_by: { type?: string; id?: string };
  entered_at: string;
  left_at: string | null;
}

export interface GateResult {
  passed: boolean;
  blocking: boolean;
  message: string;
  missing: string[];
  needsApproval?: boolean;
  approvalGate?: ApprovalRequiredGate;
}

export const CATEGORY_LABEL: Record<StatusCategory, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  review: "In Review",
  done: "Done",
  cancelled: "Cancelled",
};

export const STATUS_ICONS = [
  "circle",
  "inbox",
  "play",
  "eye",
  "check",
  "x",
  "clock",
  "flag",
  "rocket",
  "shield",
  "code",
  "beaker",
] as const;

export const STATUS_PRESET_COLORS = [
  "#94a3b8",
  "#64748b",
  "#3b82f6",
  "#a855f7",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#8b5cf6",
];
