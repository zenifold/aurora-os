import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export interface Comment {
  id: string;
  task_id: string;
  workspace_id: string;
  author_id: string;
  parent_id: string | null;
  content: unknown;
  reactions: Record<string, string[]>;
  resolved_at: string | null;
  resolved_by: string | null;
  mentions: string[];
  created_at: string;
  updated_at: string;
  author?: { id: string; display_name: string | null; avatar_url: string | null };
}

export function useComments(taskId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["comments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []).map((r) => ({
        ...r,
        reactions: (r.reactions ?? {}) as Record<string, string[]>,
        mentions: (r.mentions ?? []) as string[],
      })) as Comment[];

      const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
      if (authorIds.length === 0) return rows;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", authorIds);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((c) => ({ ...c, author: byId.get(c.author_id) ?? undefined }));
    },
  });

  // Realtime — refresh on any change to comments for this task
  useEffect(() => {
    if (!taskId) return;
    const channel = supabase
      .channel(`comments:${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `task_id=eq.${taskId}` },
        () => qc.invalidateQueries({ queryKey: ["comments", taskId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [taskId, qc]);

  return query;
}

export function useCreateComment(taskId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      content: unknown;
      parent_id?: string | null;
      mentions?: string[];
    }) => {
      if (!ws || !user) throw new Error("Not signed in");
      const { error } = await supabase.from("comments").insert({
        task_id: taskId,
        workspace_id: ws.id,
        author_id: user.id,
        parent_id: input.parent_id ?? null,
        content: input.content as never,
        mentions: (input.mentions ?? []) as never,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", taskId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: unknown }) => {
      const { error } = await supabase
        .from("comments")
        .update({ content: content as never, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", taskId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", taskId] });
      toast.success("Comment deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Toggle the current user's reaction on a comment. Optimistically updates the row
 * (server is source of truth via realtime).
 */
export function useToggleReaction(taskId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ comment, emoji }: { comment: Comment; emoji: string }) => {
      if (!user) throw new Error("Not signed in");
      const current = { ...(comment.reactions ?? {}) };
      const list = new Set(current[emoji] ?? []);
      if (list.has(user.id)) list.delete(user.id);
      else list.add(user.id);
      if (list.size === 0) delete current[emoji];
      else current[emoji] = Array.from(list);
      const { error } = await supabase
        .from("comments")
        .update({ reactions: current as never })
        .eq("id", comment.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", taskId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResolveComment(taskId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const { error } = await supabase
        .from("comments")
        .update({
          resolved_at: resolved ? new Date().toISOString() : null,
          resolved_by: resolved ? user?.id ?? null : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", taskId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * List of workspace members for @mention autocomplete.
 */
export function useWorkspaceMembers() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["workspace-members-profiles", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("workspace_id", ws!.id);
      if (error) throw error;
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      return (profiles ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[];
    },
  });
}
