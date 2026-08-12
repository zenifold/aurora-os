// Workspace permission catalog — keep in sync with role_permissions seeds (Phase 1 migration).

export const PERMISSIONS = {
  // Workspace
  WORKSPACE_MANAGE_SETTINGS: "workspace.manage_settings",
  WORKSPACE_MANAGE_BILLING: "workspace.manage_billing",
  WORKSPACE_MANAGE_MEMBERS: "workspace.manage_members",
  WORKSPACE_VIEW_AUDIT_LOG: "workspace.view_audit_log",
  WORKSPACE_MANAGE_DOMAINS: "workspace.manage_domains",
  WORKSPACE_MANAGE_ROLES: "workspace.manage_roles",
  WORKSPACE_DELETE: "workspace.delete",

  // Projects
  PROJECTS_CREATE: "projects.create",
  PROJECTS_EDIT_ALL: "projects.edit_all",
  PROJECTS_DELETE: "projects.delete",
  PROJECTS_ARCHIVE: "projects.archive",
  PROJECTS_VIEW: "projects.view",

  // Finance
  FINANCE_VIEW: "finance.view",
  FINANCE_EDIT: "finance.edit",
  FINANCE_APPROVE_INVOICES: "finance.approve_invoices",

  // CRM
  CRM_VIEW_CLIENTS: "crm.view_clients",
  CRM_EDIT_CLIENTS: "crm.edit_clients",
  CRM_DELETE_CLIENTS: "crm.delete_clients",

  // Members
  MEMBERS_INVITE: "members.invite",
  MEMBERS_REMOVE: "members.remove",
  MEMBERS_CHANGE_ROLE: "members.change_role",
  MEMBERS_SUSPEND: "members.suspend",

  // Sharing
  SHARING_MANAGE: "sharing.manage",
  SHARING_CREATE_EXTERNAL_LINK: "sharing.create_external_link",
  SHARING_INVITE_GUEST: "sharing.invite_guest",


  // Audit
  AUDIT_VIEW: "audit.view",
  AUDIT_EXPORT: "audit.export",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_GROUPS: Array<{
  label: string;
  description: string;
  permissions: Array<{ key: Permission; label: string; description: string }>;
}> = [
  {
    label: "Workspace",
    description: "Settings, billing, domains, and role management.",
    permissions: [
      { key: PERMISSIONS.WORKSPACE_MANAGE_SETTINGS, label: "Manage settings", description: "Workspace name, branding, customization" },
      { key: PERMISSIONS.WORKSPACE_MANAGE_BILLING, label: "Manage billing", description: "Plan, payment methods, invoices" },
      { key: PERMISSIONS.WORKSPACE_MANAGE_DOMAINS, label: "Manage domains", description: "Email domains that auto-join" },
      { key: PERMISSIONS.WORKSPACE_MANAGE_ROLES, label: "Manage custom roles", description: "Create and edit role definitions" },
      { key: PERMISSIONS.WORKSPACE_DELETE, label: "Delete workspace", description: "Permanently destroy the workspace" },
    ],
  },
  {
    label: "Members",
    description: "Invite, suspend, and change roles for teammates.",
    permissions: [
      { key: PERMISSIONS.WORKSPACE_MANAGE_MEMBERS, label: "Manage members", description: "Open the members admin console" },
      { key: PERMISSIONS.MEMBERS_INVITE, label: "Invite members", description: "Send invitations" },
      { key: PERMISSIONS.MEMBERS_REMOVE, label: "Remove members", description: "Revoke workspace access" },
      { key: PERMISSIONS.MEMBERS_CHANGE_ROLE, label: "Change roles", description: "Reassign role for a member" },
      { key: PERMISSIONS.MEMBERS_SUSPEND, label: "Suspend members", description: "Temporarily disable access" },
    ],
  },
  {
    label: "Projects",
    description: "Create, edit, archive, and delete projects.",
    permissions: [
      { key: PERMISSIONS.PROJECTS_VIEW, label: "View projects", description: "Read access to all workspace projects" },
      { key: PERMISSIONS.PROJECTS_CREATE, label: "Create projects", description: "Start new projects" },
      { key: PERMISSIONS.PROJECTS_EDIT_ALL, label: "Edit any project", description: "Modify projects you don't own" },
      { key: PERMISSIONS.PROJECTS_ARCHIVE, label: "Archive projects", description: "Move projects out of the active list" },
      { key: PERMISSIONS.PROJECTS_DELETE, label: "Delete projects", description: "Permanently delete projects" },
    ],
  },
  {
    label: "Finance",
    description: "Invoices, expenses, forecasts, and approvals.",
    permissions: [
      { key: PERMISSIONS.FINANCE_VIEW, label: "View finance", description: "See invoices, expenses, and forecasts" },
      { key: PERMISSIONS.FINANCE_EDIT, label: "Edit finance", description: "Create and modify financial records" },
      { key: PERMISSIONS.FINANCE_APPROVE_INVOICES, label: "Approve invoices", description: "Sign off on outgoing invoices" },
    ],
  },
  {
    label: "CRM",
    description: "Client accounts, contacts, and deals.",
    permissions: [
      { key: PERMISSIONS.CRM_VIEW_CLIENTS, label: "View clients", description: "Read the CRM" },
      { key: PERMISSIONS.CRM_EDIT_CLIENTS, label: "Edit clients", description: "Create and modify client records" },
      { key: PERMISSIONS.CRM_DELETE_CLIENTS, label: "Delete clients", description: "Permanently delete client records" },
    ],
  },
  {
    label: "Sharing",
    description: "External share links and guest invitations.",
    permissions: [
      { key: PERMISSIONS.SHARING_MANAGE, label: "Manage share links", description: "Create, edit, revoke external links" },
      { key: PERMISSIONS.SHARING_CREATE_EXTERNAL_LINK, label: "Create share links", description: "Public links to projects, views, pages" },
      { key: PERMISSIONS.SHARING_INVITE_GUEST, label: "Invite guests", description: "Bring external collaborators into a single resource" },
    ],
  },
  {
    label: "Audit",
    description: "View and export the audit trail.",
    permissions: [
      { key: PERMISSIONS.AUDIT_VIEW, label: "View audit log", description: "See who did what and when" },
      { key: PERMISSIONS.AUDIT_EXPORT, label: "Export audit log", description: "Download CSV for access reviews" },
    ],
  },
];

export type WorkspaceRoleSlug = "owner" | "admin" | "manager" | "member" | "viewer" | "guest";

export const ROLE_META: Record<WorkspaceRoleSlug, { label: string; description: string; accent: string }> = {
  owner: { label: "Owner", description: "Full control — billing, members, and delete", accent: "#ef4444" },
  admin: { label: "Admin", description: "Manage everything except billing and deletion", accent: "#8b5cf6" },
  manager: { label: "Manager", description: "Lead projects and edit most data", accent: "#3b82f6" },
  member: { label: "Member", description: "Create and edit assigned work", accent: "#22c55e" },
  viewer: { label: "Viewer", description: "Read-only access", accent: "#64748b" },
  guest: { label: "Guest", description: "Limited access to specifically shared resources", accent: "#f59e0b" },
};
