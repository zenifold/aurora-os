import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import type { TeamMember, TimeLog } from "@/lib/team-types";

export function useTeamMembers() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["team_members", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TeamMember[];
    },
  });
}

export function useUpsertTeamMember() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<TeamMember> & { user_id: string }) => {
      if (!ws) throw new Error("No workspace");
      const { error } = await supabase
        .from("team_members" as never)
        .upsert(
          { workspace_id: ws.id, ...input } as never,
          { onConflict: "workspace_id,user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_members", ws?.id] });
      toast.success("Team profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTimeLogs(opts: { sprintId?: string; userId?: string; from?: string; to?: string } = {}) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["time_logs", ws?.id, opts],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("time_logs" as never)
        .select("*")
        .eq("workspace_id", ws!.id);
      if (opts.sprintId) q = q.eq("sprint_id", opts.sprintId);
      if (opts.userId) q = q.eq("user_id", opts.userId);
      if (opts.from) q = q.gte("log_date", opts.from);
      if (opts.to) q = q.lte("log_date", opts.to);
      const { data, error } = await q.order("log_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TimeLog[];
    },
  });
}
