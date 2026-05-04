import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";

export function useWorkspaceRole() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workspace-role", ws?.id, user?.id],
    enabled: !!ws && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("workspace_id", ws!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as "owner" | "member" | null) ?? null;
    },
  });
}

export function useIsWorkspaceOwner() {
  const { data } = useWorkspaceRole();
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  // Workspace owner_id is also a fallback signal
  return data === "owner" || (!!ws && !!user && ws.owner_id === user.id);
}
