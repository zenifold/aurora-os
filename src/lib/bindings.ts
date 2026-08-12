// Live data bindings for Pages.
// A binding is an inline atom node in the Tiptap doc that renders a piece of live
// data from the system (project, task, workspace, user, date). All resolution
// happens at render time via React Query inside the node view, so the value
// stays current as the source data changes.

import { format, formatDistanceToNow } from "date-fns";

export type BindingSource = "project" | "task" | "workspace" | "me" | "date";

export interface BindingAttrs {
  source: BindingSource;
  /** UUID of the source row (project/task). Null for workspace/me/date. */
  targetId: string | null;
  /** Field key on the source — e.g. "name", "status", "due_date". */
  field: string;
  /** Optional value transform pipeline applied to the raw value. */
  transform?: BindingTransform | null;
  /** Display fallback when the value is missing/null. */
  fallback?: string | null;
  /** Optional human label cached at insert time (used as offline fallback). */
  label?: string | null;
}

export type BindingTransform =
  | "currency"
  | "date"
  | "date_short"
  | "date_long"
  | "relative"
  | "percent"
  | "uppercase"
  | "lowercase";

export interface BindingFieldDef {
  key: string;
  label: string;
  /** Hint about expected raw type — used to default the transform. */
  kind: "text" | "number" | "money" | "date" | "percent";
}

export interface BindingSourceDef {
  source: BindingSource;
  label: string;
  /** Whether this source needs a targetId picked. */
  needsTarget: boolean;
  fields: BindingFieldDef[];
}

export const BINDING_SOURCES: BindingSourceDef[] = [
  {
    source: "project",
    label: "Project",
    needsTarget: true,
    fields: [
      { key: "name", label: "Name", kind: "text" },
      { key: "key", label: "Key", kind: "text" },
      { key: "client_name", label: "Client", kind: "text" },
      { key: "phase", label: "Phase", kind: "text" },
      { key: "health", label: "Health", kind: "text" },
      { key: "start_date", label: "Start date", kind: "date" },
      { key: "target_end_date", label: "Target end date", kind: "date" },
      { key: "target_margin_pct", label: "Target margin %", kind: "percent" },
    ],
  },
  {
    source: "task",
    label: "Task",
    needsTarget: true,
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "status", label: "Status", kind: "text" },
      { key: "priority", label: "Priority", kind: "text" },
      { key: "due_date", label: "Due date", kind: "date" },
      { key: "start_date", label: "Start date", kind: "date" },
      { key: "estimated_hours", label: "Estimated hours", kind: "number" },
    ],
  },
  {
    source: "workspace",
    label: "Workspace",
    needsTarget: false,
    fields: [
      { key: "name", label: "Name", kind: "text" },
      { key: "slug", label: "Slug", kind: "text" },
    ],
  },
  {
    source: "me",
    label: "Me (signed-in user)",
    needsTarget: false,
    fields: [
      { key: "display_name", label: "My name", kind: "text" },
      { key: "email", label: "My email", kind: "text" },
    ],
  },
  {
    source: "date",
    label: "Date",
    needsTarget: false,
    fields: [
      { key: "today", label: "Today", kind: "date" },
      { key: "now", label: "Now (timestamp)", kind: "date" },
    ],
  },
];

export function defaultTransformFor(kind: BindingFieldDef["kind"]): BindingTransform | null {
  switch (kind) {
    case "money":
      return "currency";
    case "date":
      return "date";
    case "percent":
      return "percent";
    default:
      return null;
  }
}

export function applyTransform(value: unknown, transform: BindingTransform | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || value === "") return "";
  const str = typeof value === "string" ? value : String(value);
  switch (transform) {
    case "currency": {
      const n = Number(value);
      if (!Number.isFinite(n)) return str;
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
      } catch {
        return `${currency} ${n.toFixed(0)}`;
      }
    }
    case "percent": {
      const n = Number(value);
      if (!Number.isFinite(n)) return str;
      return `${n}%`;
    }
    case "date":
      return safeDate(value, "MMM d, yyyy");
    case "date_short":
      return safeDate(value, "M/d/yy");
    case "date_long":
      return safeDate(value, "EEEE, MMMM d, yyyy");
    case "relative": {
      const d = parseDate(value);
      return d ? formatDistanceToNow(d, { addSuffix: true }) : str;
    }
    case "uppercase":
      return str.toUpperCase();
    case "lowercase":
      return str.toLowerCase();
    default:
      return str;
  }
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function safeDate(value: unknown, fmt: string): string {
  const d = parseDate(value);
  if (!d) return String(value ?? "");
  try {
    return format(d, fmt);
  } catch {
    return d.toISOString();
  }
}

export const ALL_TRANSFORMS: { value: BindingTransform; label: string }[] = [
  { value: "currency", label: "Currency" },
  { value: "date", label: "Date (Aug 12, 2026)" },
  { value: "date_short", label: "Date (short)" },
  { value: "date_long", label: "Date (long)" },
  { value: "relative", label: "Relative time" },
  { value: "percent", label: "Percent" },
  { value: "uppercase", label: "UPPERCASE" },
  { value: "lowercase", label: "lowercase" },
];

/** Build a human-readable summary, e.g. "Project · Acme Co · Target end date". */
export function describeBinding(attrs: BindingAttrs, targetName?: string | null): string {
  const src = BINDING_SOURCES.find((s) => s.source === attrs.source);
  const field = src?.fields.find((f) => f.key === attrs.field);
  const parts = [src?.label ?? attrs.source];
  if (src?.needsTarget) parts.push(targetName ?? attrs.label ?? "—");
  parts.push(field?.label ?? attrs.field);
  return parts.join(" · ");
}
