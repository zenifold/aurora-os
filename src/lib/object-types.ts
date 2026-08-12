// Block A · Phase 1 — shared types for the no-code object model.
import type { FieldType, SelectOption } from "@/lib/types";

export interface ObjectType {
  id: string;
  workspace_id: string;
  key: string;
  label: string;
  plural_label: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  system_kind:
    | "task"
    | "project"
    | "note"
    | "meeting"
    | "contact"
    | "raid"
    | "intake"
    | "custom"
    | null;
  is_system: boolean;
  is_archived: boolean;
  sort_order: number;
  default_view_id: string | null;
  created_at: string;
  updated_at: string;
}

// Extended field types supported by the designer. The DB column is text-typed
// so we can safely add new values without an enum migration.
export type ExtendedFieldType =
  | FieldType
  | "formula"
  | "rollup"
  | "lookup"
  | "person"
  | "currency"
  | "percent"
  | "rich_text"
  | "relation"
  | "file";

export interface ObjectFieldDef {
  id: string;
  workspace_id: string;
  object_type_id: string | null;
  name: string;
  field_type: ExtendedFieldType;
  options: SelectOption[] | null;
  default_value: unknown;
  is_required: boolean;
  is_visible_in_table: boolean;
  help_text: string | null;
  formula_expr: string | null;
  rollup_config: Record<string, unknown> | null;
  lookup_config: Record<string, unknown> | null;
  order_index: number;
}

export interface CustomRecord {
  id: string;
  workspace_id: string;
  object_type_id: string;
  title: string;
  status: string | null;
  owner_id: string | null;
  parent_record_id: string | null;
  project_id: string | null;
  tags: string[] | null;
  values: Record<string, unknown>;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ViewKind = "table" | "kanban" | "calendar" | "gallery" | "timeline" | "board";

export const VIEW_KIND_LABELS: Record<ViewKind, string> = {
  table: "Table",
  kanban: "Kanban",
  calendar: "Calendar",
  gallery: "Gallery",
  timeline: "Timeline",
  board: "Board",
};

export const FIELD_TYPE_GROUPS: Array<{
  group: string;
  types: Array<{ value: ExtendedFieldType; label: string; hint?: string }>;
}> = [
  {
    group: "Basic",
    types: [
      { value: "text", label: "Text" },
      { value: "rich_text", label: "Rich text", hint: "Markdown / formatted block" },
      { value: "number", label: "Number" },
      { value: "currency", label: "Currency" },
      { value: "percent", label: "Percent" },
      { value: "date", label: "Date" },
      { value: "checkbox", label: "Checkbox" },
      { value: "url", label: "URL" },
      { value: "email", label: "Email" },
    ],
  },
  {
    group: "Choice",
    types: [
      { value: "select", label: "Select" },
      { value: "multi_select", label: "Multi-select" },
    ],
  },
  {
    group: "People & Files",
    types: [
      { value: "person", label: "Person", hint: "Workspace member" },
      { value: "user", label: "Assignees", hint: "Multiple members" },
      { value: "file", label: "File / attachment" },
    ],
  },
  {
    group: "Advanced",
    types: [
      { value: "relation", label: "Relation", hint: "Link to another record" },
      { value: "lookup", label: "Lookup", hint: "Pull field from a related record" },
      { value: "rollup", label: "Rollup", hint: "Aggregate field across related records" },
      { value: "formula", label: "Formula", hint: "Computed from other fields" },
      { value: "effort", label: "Level of effort", hint: "Hours / days / points" },
    ],
  },
];

export const ALL_FIELD_TYPES: ExtendedFieldType[] = FIELD_TYPE_GROUPS.flatMap((g) =>
  g.types.map((t) => t.value),
);

export function fieldTypeLabel(t: ExtendedFieldType): string {
  for (const g of FIELD_TYPE_GROUPS) {
    const hit = g.types.find((x) => x.value === t);
    if (hit) return hit.label;
  }
  return t;
}

export function fieldTypeNeedsOptions(t: ExtendedFieldType): boolean {
  return t === "select" || t === "multi_select" || t === "effort";
}
