import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export type FavoriteItemType = "folder" | "project" | "division";

export interface SidebarFavorite {
  id: string;
  user_id: string;
  workspace_id: string;
  item_type: FavoriteItemType;
  item_id: string;
  sort_order: number;
  created_at: string;
}

export function useSidebarFavorites() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sidebar-favorites", ws?.id, user?.id],
    enabled: !!ws && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sidebar_favorites")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as SidebarFavorite[];
    },
  });
}

export function useToggleFavorite() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { item_type: FavoriteItemType; item_id: string; pinned: boolean }) => {
      if (!ws || !user) throw new Error("No workspace");
      if (input.pinned) {
        const { error } = await supabase
          .from("sidebar_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("workspace_id", ws.id)
          .eq("item_type", input.item_type)
          .eq("item_id", input.item_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sidebar_favorites").insert({
          user_id: user.id,
          workspace_id: ws.id,
          item_type: input.item_type,
          item_id: input.item_id,
          sort_order: Date.now() % 1_000_000,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sidebar-favorites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReorderFavorites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orders: { id: string; sort_order: number }[]) => {
      await Promise.all(
        orders.map((o) =>
          supabase.from("sidebar_favorites").update({ sort_order: o.sort_order }).eq("id", o.id)
        )
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sidebar-favorites"] }),
  });
}
