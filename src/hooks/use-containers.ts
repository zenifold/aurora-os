// Containers are the spine of the new client-first sidebar.
// A container is a client_accounts row with kind ∈ { 'client', 'personal', 'internal' }.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";

export type ContainerKind = "client" | "personal" | "internal";

export interface Container {
  id: string;
  workspace_id: string;
  name: string;
  kind: ContainerKind;
  owner_user_id: string | null;
  health: string;
  status: string;
  tier: string;
  created_at: string;
}

export function useContainers() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["containers", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id, workspace_id, name, kind, owner_user_id, health, status, tier, created_at")
        .eq("workspace_id", ws!.id)
        .order("kind", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown) as Container[];
    },
  });
}

/** The current user's personal container in the active workspace. */
export function useMyPersonalContainer() {
  const { data: containers = [] } = useContainers();
  const { user } = useAuth();
  return containers.find((c) => c.kind === "personal" && c.owner_user_id === user?.id) ?? null;
}

/** The workspace's single Internal container. */
export function useInternalContainer() {
  const { data: containers = [] } = useContainers();
  return containers.find((c) => c.kind === "internal") ?? null;
}

/** All client (non-personal, non-internal) containers. */
export function useClientContainers() {
  const { data: containers = [] } = useContainers();
  return containers.filter((c) => c.kind === "client");
}
