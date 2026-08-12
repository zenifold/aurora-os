// Role-aware sidebar defaults. Maps profile.primary_role to nav items that
// should be hidden by default, plus a default landing route for /app.

export type PrimaryRole =
  | "partner"
  | "sales"
  | "account_manager"
  | "pm"
  | "delivery"
  | "client_user";

// Top-nav `id`s (see AppSidebar NAV_DEFS) and `visibilityKey`s that are
// non-essential for the given role.
export const ROLE_HIDDEN_NAV: Record<PrimaryRole, string[]> = {
  partner: [],
  sales: ["my-tasks", "approvals"],
  account_manager: [],
  pm: [],
  delivery: [],
  client_user: ["approvals", "my-tasks"],
};

// Gated analytics/finance items the role should NOT see by default
// (these are the keys understood by use-nav-visibility GATED_NAV_ITEMS).
export const ROLE_HIDDEN_GATED: Record<PrimaryRole, string[]> = {
  partner: [],
  sales: ["capacity", "resources", "escalations"],
  account_manager: ["capacity", "resources", "forecast"],
  pm: ["finance", "forecast", "executive", "pipeline-analytics"],
  delivery: ["finance", "forecast", "executive", "pipeline-analytics", "escalations"],
  client_user: ["finance", "forecast", "executive", "pipeline-analytics", "escalations", "capacity", "resources"],
};

export const ROLE_DEFAULT_LANDING: Record<PrimaryRole, string> = {
  partner: "/app/executive",
  sales: "/app/crm",
  account_manager: "/app/clients",
  pm: "/app",
  delivery: "/app/my-tasks",
  client_user: "/app/my-tasks",
};

export const ROLE_LABEL: Record<PrimaryRole, string> = {
  partner: "Partner",
  sales: "Sales",
  account_manager: "Account Manager",
  pm: "Project Manager",
  delivery: "Delivery",
  client_user: "Client",
};

export function isRoleHidden(role: PrimaryRole | null | undefined, navId: string): boolean {
  if (!role) return false;
  return ROLE_HIDDEN_NAV[role]?.includes(navId)
    || ROLE_HIDDEN_GATED[role]?.includes(navId)
    || false;
}
