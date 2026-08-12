import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useWorkspaceRole, useIsWorkspaceOwner } from "@/hooks/use-workspace-role";
import { Loader2 } from "lucide-react";

export type WorkspaceRole = "owner" | "manager" | "member";

const RANK: Record<WorkspaceRole, number> = { member: 0, manager: 1, owner: 2 };

export function useHasRole(min: WorkspaceRole): { allowed: boolean; loading: boolean; role: WorkspaceRole } {
  const isOwner = useIsWorkspaceOwner();
  const { data: role, isLoading } = useWorkspaceRole();
  const effective: WorkspaceRole = isOwner ? "owner" : ((role as WorkspaceRole) ?? "member");
  return {
    allowed: RANK[effective] >= RANK[min],
    loading: isLoading && !isOwner,
    role: effective,
  };
}

export function RoleGuard({
  min,
  children,
  fallbackTo = "/app/settings",
}: {
  min: WorkspaceRole;
  children: React.ReactNode;
  fallbackTo?: string;
}) {
  const { allowed, loading } = useHasRole(min);
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !allowed) {
      toast.error("You don't have permission to view this page");
      navigate({ to: fallbackTo as never });
    }
  }, [allowed, loading, navigate, fallbackTo]);
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!allowed) return null;
  return <>{children}</>;
}
