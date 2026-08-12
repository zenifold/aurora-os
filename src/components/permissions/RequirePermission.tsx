import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import type { Permission } from "@/lib/permissions";

interface RequirePermissionProps {
  permission: Permission | Permission[];
  /** Require all listed permissions (default: any). */
  all?: boolean;
  /** What to render when the user lacks permission. */
  fallback?: ReactNode;
  /** Hide entirely instead of showing the default lock UI. */
  hideWhenDenied?: boolean;
  children: ReactNode;
}

/**
 * Gates a UI region behind one or more workspace permissions.
 * By default shows a clean "no permission" panel so admins can see what
 * features exist even when they can't use them. Pass hideWhenDenied to
 * suppress the panel entirely.
 */
export function RequirePermission({
  permission,
  all = false,
  fallback,
  hideWhenDenied = false,
  children,
}: RequirePermissionProps) {
  const { can, canAll, canAny, isLoading } = usePermissions();

  if (isLoading) return null;

  const perms = Array.isArray(permission) ? permission : [permission];
  const allowed =
    perms.length === 1
      ? can(perms[0])
      : all
        ? canAll(...perms)
        : canAny(...perms);

  if (allowed) return <>{children}</>;
  if (hideWhenDenied) return null;
  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">You don't have permission</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Ask a workspace admin to grant access to this section.
      </p>
    </div>
  );
}
