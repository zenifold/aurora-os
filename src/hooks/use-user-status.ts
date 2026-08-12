import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";

export interface UserStatusRow {
  user_id: string;
  workspace_id: string | null;
  emoji: string | null;
  text: string | null;
  clear_at: string | null;
  dnd_until: string | null;
  ooo_until: string | null;
  ooo_delegate_id: string | null;
  ooo_message: string | null;
  updated_at: string;
}

export function useMyStatus() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["my-status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_status")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as UserStatusRow | null;
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel(`user-status:${user.id}:${Math.random().toString(36).slice(2)}`);
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_status", filter: `user_id=eq.${user.id}` },
      () => qc.invalidateQueries({ queryKey: ["my-status", user.id] }),
    ).subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id, qc]);

  return query;
}

export function useTeamStatuses() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["team-statuses", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_status")
        .select("*")
        .eq("workspace_id", ws!.id);
      if (error) throw error;
      const map = new Map<string, UserStatusRow>();
      for (const r of (data ?? []) as UserStatusRow[]) map.set(r.user_id, r);
      return map;
    },
  });

  useEffect(() => {
    if (!ws?.id) return;
    const ch = supabase.channel(`team-statuses:${ws.id}:${Math.random().toString(36).slice(2)}`);
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_status", filter: `workspace_id=eq.${ws.id}` },
      () => qc.invalidateQueries({ queryKey: ["team-statuses", ws.id] }),
    ).subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [ws?.id, qc]);

  return query;
}

export function useUpdateMyStatus() {
  const { user } = useAuth();
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Omit<UserStatusRow, "user_id" | "workspace_id" | "updated_at">>) => {
      if (!user) throw new Error("Not signed in");
      // Only include workspace_id when we have one — otherwise upsert would
      // wipe the existing value and break workspace-scoped queries.
      const payload: Partial<UserStatusRow> & { user_id: string } = {
        user_id: user.id,
        ...input,
      };
      if (ws?.id) payload.workspace_id = ws.id;

      const { error } = await supabase
        .from("user_status")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-status", user?.id] });
      qc.invalidateQueries({ queryKey: ["team-statuses", ws?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}


export function useClearMyStatus() {
  const update = useUpdateMyStatus();
  return () =>
    update.mutate({
      emoji: null,
      text: null,
      clear_at: null,
    });
}

export function isStatusActive(s: UserStatusRow | null | undefined): boolean {
  if (!s) return false;
  if (!s.emoji && !s.text) return false;
  if (s.clear_at && new Date(s.clear_at).getTime() < Date.now()) return false;
  return true;
}

export function isDndActive(s: UserStatusRow | null | undefined): boolean {
  if (!s?.dnd_until) return false;
  return new Date(s.dnd_until).getTime() > Date.now();
}

export function isOooActive(s: UserStatusRow | null | undefined): boolean {
  if (!s?.ooo_until) return false;
  return new Date(s.ooo_until).getTime() > Date.now();
}
