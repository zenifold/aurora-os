/**
 * Auto-discovered backlinks: given an anchor record (kind + id), probe known
 * foreign-key columns across the schema and surface every record that points
 * to it. Read-only intelligence — complements the explicit entity_links system.
 */
import type { EntityKind } from "@/lib/entity-link-types";

export interface BacklinkProbe {
  /** Where to look. */
  table: string;
  /** FK column on `table` pointing at the anchor. */
  fkColumn: string;
  /** Column used for the row title. */
  titleColumn: string;
  /** Optional subtitle column (e.g. status, kind). */
  subtitleColumn?: string;
  /** Workspace-scope column on `table`. */
  workspaceColumn?: string;
  /** Logical kind for grouping/iconography. */
  asKind: EntityKind;
  /** Optional human label override for the group ("Tasks", "Deals", ...). */
  groupLabel?: string;
}

/**
 * Per-anchor-kind list of foreign-key probes. Order controls panel order.
 * Keep entries here in sync with the database schema (types.ts is the source
 * of truth) — adding a probe is safe even if the FK is missing on some rows;
 * Supabase just returns an empty result.
 */
export const BACKLINK_PROBES: Partial<Record<EntityKind, BacklinkProbe[]>> = {
  project: [
    { table: "tasks", fkColumn: "project_id", titleColumn: "title", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "task" },
    { table: "milestones", fkColumn: "project_id", titleColumn: "name", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "milestone" },
    { table: "meetings", fkColumn: "project_id", titleColumn: "title", workspaceColumn: "workspace_id", asKind: "meeting" },
    { table: "invoices", fkColumn: "project_id", titleColumn: "invoice_number", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "invoice" },
    { table: "sows", fkColumn: "project_id", titleColumn: "title", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "sow" },
    { table: "raid_items", fkColumn: "project_id", titleColumn: "title", subtitleColumn: "kind", workspaceColumn: "workspace_id", asKind: "risk" },
    { table: "contracts", fkColumn: "project_id", titleColumn: "title", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "sow", groupLabel: "Contracts" },
    { table: "calendar_events", fkColumn: "linked_project_id", titleColumn: "title", workspaceColumn: "workspace_id", asKind: "meeting", groupLabel: "Calendar events" },
  ],
  client: [
    { table: "projects", fkColumn: "client_account_id", titleColumn: "name", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "project" },
    { table: "deals", fkColumn: "client_account_id", titleColumn: "title", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "deal" },
    { table: "sows", fkColumn: "client_account_id", titleColumn: "title", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "sow" },
    { table: "contracts", fkColumn: "client_account_id", titleColumn: "title", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "sow", groupLabel: "Contracts" },
    { table: "invoices", fkColumn: "client_account_id", titleColumn: "invoice_number", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "invoice" },
    { table: "client_request_bundles", fkColumn: "client_account_id", titleColumn: "title", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "record", groupLabel: "Request bundles" },
    { table: "client_plans", fkColumn: "client_account_id", titleColumn: "name", workspaceColumn: "workspace_id", asKind: "record", groupLabel: "Plans" },
  ],
  contact: [
    { table: "deals", fkColumn: "contact_id", titleColumn: "title", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "deal" },
  ],
  deal: [
    { table: "proposals", fkColumn: "deal_id", titleColumn: "title", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "sow", groupLabel: "Proposals" },
  ],
  meeting: [
    { table: "tasks", fkColumn: "source_meeting_id", titleColumn: "title", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "task", groupLabel: "Tasks created from this meeting" },
  ],
  sow: [
    { table: "invoices", fkColumn: "sow_id", titleColumn: "invoice_number", subtitleColumn: "status", workspaceColumn: "workspace_id", asKind: "invoice" },
  ],
};
