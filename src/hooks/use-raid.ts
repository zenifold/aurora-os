import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { RaidItem } from "@/lib/raid-types";

export function useRaidItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ["raid", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_raid_items" as never)
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RaidItem[];
    },
  });
}

export function useUpsertRaidItem() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RaidItem> & { project_id: string; item_type: RaidItem["item_type"]; title: string }) => {
      if (!ws || !user) throw new Error("Not signed in");
      const payload = { workspace_id: ws.id, created_by: input.created_by ?? user.id, ...input };
      if (input.id) {
        const { error } = await supabase
          .from("project_raid_items" as never)
          .update(payload as never)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_raid_items" as never)
          .insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["raid", vars.project_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRaidItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; project_id: string }) => {
      const { error } = await supabase
        .from("project_raid_items" as never)
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["raid", vars.project_id] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
