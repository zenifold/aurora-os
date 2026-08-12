// Per-user sidebar pins: a flat list of containers (clients) or projects the
// user has pinned to the top of their sidebar in the current workspace.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export type PinTargetType = "client" | "project";

export interface SidebarPin {
  id: string;
  user_id: string;
  workspace_id: string;
  target_type: PinTargetType;
  target_id: string;
  sort_order: number;
  created_at: string;
}

export function useSidebarPins() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sidebar-pins", ws?.id, user?.id],
    enabled: !!ws && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sidebar_pins")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown) as SidebarPin[];
    },
  });
}

export function useTogglePin() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { target_type: PinTargetType; target_id: string; pinned: boolean }) => {
      if (!ws || !user) throw new Error("No workspace");
      if (input.pinned) {
        const { error } = await supabase
          .from("sidebar_pins")
          .delete()
          .eq("user_id", user.id)
          .eq("workspace_id", ws.id)
          .eq("target_type", input.target_type)
          .eq("target_id", input.target_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sidebar_pins").insert({
          user_id: user.id,
          workspace_id: ws.id,
          target_type: input.target_type,
          target_id: input.target_id,
          sort_order: Date.now() % 1_000_000,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sidebar-pins"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Convenience: is the given target currently pinned by the active user? */
export function useIsPinned(target_type: PinTargetType, target_id: string | null | undefined) {
  const { data: pins = [] } = useSidebarPins();
  if (!target_id) return false;
  return pins.some((p) => p.target_type === target_type && p.target_id === target_id);
}
