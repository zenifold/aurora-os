// Drives which top-level nav items are visible based on workspace_mode.
// Solo users should not see CRM, Deals, Invoices, Sales, Delivery, etc.
// Clients stays visible for every workspace member so empty workspaces can add
// their first client from the nav.
// Client_services shows everything (back-compat default).

import type { WorkspaceMode } from "@/stores/workspace-store";

// Keys correspond to NAV_DEFS ids in AppSidebar, AppLauncher app keys, and
// the labeled items in MobileDrawer. Anything not listed here is always visible.
const HIDDEN_BY_MODE: Record<WorkspaceMode, Set<string>> = {
  solo: new Set([
    "crm",
    "contacts",
    "deals",
    "invoices",
    "pipeline-analytics",
    "finance",
    "forecast",
    "executive",
    "resources",
    "capacity",
    "escalations",
    "portfolio-status",
  ]),
  internal_team: new Set([
    // Internal teams have no customers by default — same hides as solo except they keep
    // team-wide rollups like resources/capacity/executive.
    "crm",
    "contacts",
    "deals",
    "invoices",
    "pipeline-analytics",
  ]),
  client_services: new Set(),
};

export function isNavHiddenByMode(
  navKey: string,
  mode: WorkspaceMode | null | undefined,
  hasAnyClient: boolean = false,
): boolean {
  const m: WorkspaceMode = mode ?? "client_services";
  if (navKey === "clients") return false;
  // Once any client exists, reveal related client-facing nav even in solo/internal modes.
  if (hasAnyClient && (navKey === "clients" || navKey === "crm" || navKey === "contacts")) {
    return false;
  }
  return HIDDEN_BY_MODE[m].has(navKey);
}
