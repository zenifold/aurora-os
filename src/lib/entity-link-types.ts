/**
 * Registry of object kinds that participate in universal entity_links.
 * Each kind knows where it lives in the DB, how to title it, and where its
 * detail view is (for navigation from a "Related items" panel).
 *
 * Add a new entry here to make a new object type linkable anywhere in the app.
 */

export type EntityKind =
  | "task"
  | "project"
  | "client"
  | "contact"
  | "deal"
  | "invoice"
  | "page"
  | "note"
  | "meeting"
  | "milestone"
  | "risk"
  | "sow"
  | "record";

export interface EntityKindDef {
  kind: EntityKind;
  label: string;
  /** Plural label for headings ("Tasks", "Deals"). */
  plural: string;
  /** Single emoji or short text icon used when no other icon is available. */
  icon: string;
  /** Supabase table the records live in. */
  table: string;
  /** Column on `table` that holds the display title. */
  titleColumn: string;
  /** Optional secondary descriptor (e.g. "status", "company"). */
  subtitleColumn?: string;
  /** Workspace scope column on `table`. */
  workspaceColumn?: string;
  /**
   * Build a relative app URL for a given record id. Return null if the kind
   * has no detail route (panel renders the row as plain text instead).
   */
  href: (id: string) => string | null;
}

export const ENTITY_KINDS: Record<EntityKind, EntityKindDef> = {
  task: {
    kind: "task",
    label: "Task",
    plural: "Tasks",
    icon: "✓",
    table: "tasks",
    titleColumn: "title",
    subtitleColumn: "status",
    workspaceColumn: "workspace_id",
    href: (id) => `/app/t/${id}`,
  },
  project: {
    kind: "project",
    label: "Project",
    plural: "Projects",
    icon: "📁",
    table: "projects",
    titleColumn: "name",
    subtitleColumn: "status",
    workspaceColumn: "workspace_id",
    href: (id) => `/app/p/${id}`,
  },
  client: {
    kind: "client",
    label: "Client",
    plural: "Clients",
    icon: "🏢",
    table: "client_accounts",
    titleColumn: "name",
    workspaceColumn: "workspace_id",
    href: (id) => `/app/clients/${id}`,
  },
  contact: {
    kind: "contact",
    label: "Contact",
    plural: "Contacts",
    icon: "👤",
    table: "contacts",
    titleColumn: "name",
    subtitleColumn: "company",
    workspaceColumn: "workspace_id",
    href: (id) => `/app/contacts?c=${id}`,
  },
  deal: {
    kind: "deal",
    label: "Deal",
    plural: "Deals",
    icon: "💼",
    table: "deals",
    titleColumn: "title",
    subtitleColumn: "status",
    workspaceColumn: "workspace_id",
    href: (id) => `/app/deals?d=${id}`,
  },
  invoice: {
    kind: "invoice",
    label: "Invoice",
    plural: "Invoices",
    icon: "💵",
    table: "invoices",
    titleColumn: "invoice_number",
    subtitleColumn: "status",
    workspaceColumn: "workspace_id",
    href: (id) => `/app/invoices?i=${id}`,
  },
  page: {
    kind: "page",
    label: "Page",
    plural: "Pages",
    icon: "📄",
    table: "pages",
    titleColumn: "title",
    workspaceColumn: "workspace_id",
    href: (id) => `/app/pages?p=${id}`,
  },
  note: {
    kind: "note",
    label: "Note",
    plural: "Notes",
    icon: "📝",
    table: "notes",
    titleColumn: "title",
    workspaceColumn: "workspace_id",
    href: (id) => `/app/notes?n=${id}`,
  },
  meeting: {
    kind: "meeting",
    label: "Meeting",
    plural: "Meetings",
    icon: "📅",
    table: "meetings",
    titleColumn: "title",
    workspaceColumn: "workspace_id",
    href: (id) => `/app/meetings?m=${id}`,
  },
  milestone: {
    kind: "milestone",
    label: "Milestone",
    plural: "Milestones",
    icon: "🏁",
    table: "milestones",
    titleColumn: "name",
    workspaceColumn: "workspace_id",
    href: () => null,
  },
  risk: {
    kind: "risk",
    label: "RAID item",
    plural: "RAID items",
    icon: "⚠️",
    table: "raid_items",
    titleColumn: "title",
    subtitleColumn: "kind",
    workspaceColumn: "workspace_id",
    href: () => null,
  },
  sow: {
    kind: "sow",
    label: "SOW",
    plural: "SOWs",
    icon: "📜",
    table: "sows",
    titleColumn: "title",
    subtitleColumn: "status",
    workspaceColumn: "workspace_id",
    href: (id) => `/app/sales/sows/${id}`,
  },
  record: {
    kind: "record",
    label: "Record",
    plural: "Records",
    icon: "🔗",
    table: "custom_records",
    titleColumn: "title",
    workspaceColumn: "workspace_id",
    href: () => null,
  },
};

export const ENTITY_KIND_LIST: EntityKindDef[] = Object.values(ENTITY_KINDS);

export function entityKindDef(kind: string): EntityKindDef | null {
  return (ENTITY_KINDS as Record<string, EntityKindDef | undefined>)[kind] ?? null;
}
