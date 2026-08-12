import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import type { Permission, WorkspaceRoleSlug } from "@/lib/permissions";

type PermissionData = {
  permissions: string[];
  roleSlug: WorkspaceRoleSlug | null;
  customRoleId: string | null;
};

const EMPTY: PermissionData = { permissions: [], roleSlug: null, customRoleId: null };

/**
 * Returns the current user's permission set for the active workspace.
 * Permissions are computed from their assigned role (system or custom) +
 * the role_permissions table. The owner enum role short-circuits to all.
 */
export function usePermissions() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["permissions", ws?.id, user?.id],
    enabled: !!ws && !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<PermissionData> => {
      if (!ws || !user) return EMPTY;

      const { data: roleRows, error: roleErr } = await supabase
        .from("user_roles")
        .select("role, role_definition_id")
        .eq("workspace_id", ws.id)
        .eq("user_id", user.id);
      if (roleErr) throw roleErr;
      if (!roleRows || roleRows.length === 0) return EMPTY;

      const row = roleRows[0] as { role: WorkspaceRoleSlug; role_definition_id: string | null };
      const roleSlug = row.role;
      const customRoleId = row.role_definition_id;

      // Owner enum short-circuit
      if (roleSlug === "owner") {
        return {
          roleSlug,
          customRoleId,
          permissions: ["*"],
        };
      }

      // Find the role_definition (custom or system)
      let roleId: string | null = customRoleId;
      if (!roleId) {
        const { data: defRow } = await supabase
          .from("role_definitions" as never)
          .select("id")
          .is("workspace_id", null)
          .eq("slug", roleSlug)
          .maybeSingle();
        roleId = (defRow as { id: string } | null)?.id ?? null;
      }

      if (!roleId) return { ...EMPTY, roleSlug, customRoleId };

      const { data: permRows } = await supabase
        .from("role_permissions" as never)
        .select("permission")
        .eq("role_id", roleId);

      const permissions = ((permRows ?? []) as Array<{ permission: string }>).map((p) => p.permission);

      return { permissions, roleSlug, customRoleId };
    },
  });

  const data = query.data ?? EMPTY;
  const perms = data.permissions ?? [];
  const hasWildcard = perms.includes("*");

  return {
    ...query,
    roleSlug: data.roleSlug,
    customRoleId: data.customRoleId,
    /** True if owner (wildcard) or permission explicitly granted. */
    can: (permission: Permission): boolean =>
      hasWildcard || perms.includes(permission),
    /** True if any of the listed permissions are granted. */
    canAny: (...permsToCheck: Permission[]): boolean =>
      hasWildcard || permsToCheck.some((p) => perms.includes(p)),
    /** True if all listed permissions are granted. */
    canAll: (...permsToCheck: Permission[]): boolean =>
      hasWildcard || permsToCheck.every((p) => perms.includes(p)),
  };
}

/** Convenience single-permission hook. */
export function useCan(permission: Permission): boolean {
  return usePermissions().can(permission);
}
