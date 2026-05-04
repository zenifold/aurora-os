export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "user"
  | "checkbox"
  | "url"
  | "email";

export interface SelectOption {
  id: string;
  label: string;
  color: string;
}

export interface CustomFieldDef {
  id: string;
  workspace_id: string;
  name: string;
  field_type: FieldType;
  options: SelectOption[] | null;
  default_value: unknown;
  is_required: boolean;
  order_index: number;
}

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval: number;
  until?: string | null; // ISO date
  next_status?: string;
}

export interface Task {
  id: string;
  project_id: string;
  workspace_id: string;
  title: string;
  description: unknown;
  status: TaskStatus | string;
  priority: TaskPriority;
  assignee_ids: string[];
  due_date: string | null;
  start_date: string | null;
  parent_task_id: string | null;
  custom_values: Record<string, unknown>;
  tags: string[];
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  recurrence?: RecurrenceRule | null;
  recurrence_parent_id?: string | null;
  task_type?: "initiative" | "epic" | "task" | "subtask";
  hierarchy_path?: string[];
  child_count?: number;
  completed_child_count?: number;
  rollup_progress?: number | null;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  parent_id: string | null;
  is_archived: boolean;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface View {
  id: string;
  project_id: string;
  workspace_id: string;
  name: string;
  view_type: "table" | "kanban" | "canvas" | "calendar" | "timeline";
  config: ViewConfig;
  filters: Filter[];
  sorts: Sort[];
  group_by: string | null;
  is_default: boolean;
}

export interface ViewColumnConfig {
  key: string;
  width?: number;
  visible?: boolean;
  order?: number;
}

export interface ColorRule {
  id: string;
  field: "priority" | "status" | "due_date";
  match: string; // value or "overdue" / "today" / "this_week"
  color: string; // hex / oklch / css color
}

export interface ViewConfig {
  columns?: ViewColumnConfig[];
  /** Kanban: which compact fields to render on each card */
  cardFields?: Array<"priority" | "due_date" | "assignees" | "tags">;
  /** Kanban: collapsed column ids */
  collapsedColumns?: string[];
  /** Color row/card by this field */
  colorBy?: "none" | "priority" | "status" | "due_date";
  colorRules?: ColorRule[];
  /** When true, only workspace owners can edit filters/sorts/config; others must duplicate. */
  locked?: boolean;
  /** Canvas view: persisted x/y positions per task id */
  canvasPositions?: Record<string, { x: number; y: number }>;
}

export interface Filter {
  id: string;
  field: string;
  operator: "is" | "is_not" | "contains" | "before" | "after" | "is_empty" | "is_not_empty";
  value: unknown;
}

export interface Sort {
  field: string;
  direction: "asc" | "desc";
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  joined_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  role?: "owner" | "member";
}

export const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: "todo", label: "Todo", color: "var(--status-todo)" },
  { value: "in_progress", label: "In Progress", color: "var(--status-progress)" },
  { value: "review", label: "Review", color: "var(--status-review)" },
  { value: "done", label: "Done", color: "var(--status-done)" },
  { value: "cancelled", label: "Cancelled", color: "var(--status-cancelled)" },
];

export const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "oklch(0.7 0.05 240)" },
  { value: "medium", label: "Medium", color: "oklch(0.7 0.12 80)" },
  { value: "high", label: "High", color: "oklch(0.65 0.18 30)" },
  { value: "urgent", label: "Urgent", color: "oklch(0.6 0.22 25)" },
];

export type RelationType = "blocks" | "blocked_by" | "relates_to" | "duplicates" | "follows";

export interface TaskRelation {
  id: string;
  workspace_id: string;
  source_task_id: string;
  target_task_id: string;
  relation_type: RelationType;
  lag_days: number;
  created_by: string | null;
  created_at: string;
}

export const RELATION_LABELS: Record<RelationType, { label: string; inverse: RelationType; description: string }> = {
  blocks:       { label: "Blocks",       inverse: "blocked_by", description: "must finish before" },
  blocked_by:   { label: "Blocked by",   inverse: "blocks",     description: "waits on" },
  relates_to:   { label: "Relates to",   inverse: "relates_to", description: "related to" },
  duplicates:   { label: "Duplicates",   inverse: "duplicates", description: "duplicate of" },
  follows:      { label: "Follows",      inverse: "follows",    description: "comes after" },
};
