import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export type ChannelScope = "workspace" | "section" | "project" | "dm";

export interface ChannelRow {
  id: string;
  workspace_id: string;
  scope: ChannelScope;
  scope_id: string | null;
  name: string;
  slug: string;
  topic: string | null;
  is_private: boolean;
  is_archived: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelMessageRow {
  id: string;
  channel_id: string;
  workspace_id: string;
  parent_message_id: string | null;
  author_id: string | null;
  body_md: string | null;
  body_json: unknown;
  mentions: string[];
  attachments: unknown;
  metadata: Record<string, unknown>;
  is_system: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  thread_count?: number;
  thread_last_reply_at?: string | null;
}

export interface ChannelReactionRow {
  message_id: string;
  user_id: string;
  emoji: string;
  workspace_id: string;
  created_at: string;
}

export interface ChannelMemberRow {
  id: string;
  channel_id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  last_read_at: string | null;
  muted: boolean;
  joined_at: string;
}

/* ------------------------------------------------------------------ */
/* Lists                                                              */
/* ------------------------------------------------------------------ */

export function useChannels(opts: { projectId?: string | null } = {}) {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["channels", ws?.id, opts.projectId ?? null],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("channels")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false);
      if (opts.projectId) {
        q = q.eq("scope", "project").eq("scope_id", opts.projectId);
      }
      const { data, error } = await q.order("scope").order("name");
      if (error) throw error;
      return (data ?? []) as ChannelRow[];
    },
  });

  // Realtime: refresh when channels change in this workspace
  useEffect(() => {
    if (!ws?.id) return;
    const ch = supabase
      .channel(`channels:list:${ws.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channels", filter: `workspace_id=eq.${ws.id}` },
        () => qc.invalidateQueries({ queryKey: ["channels", ws.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [ws?.id, qc]);

  return query;
}

/* ------------------------------------------------------------------ */
/* Single channel + messages                                          */
/* ------------------------------------------------------------------ */

export function useChannel(channelId: string | null) {
  return useQuery({
    queryKey: ["channel", channelId],
    enabled: !!channelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("id", channelId!)
        .maybeSingle();
      if (error) throw error;
      return data as ChannelRow | null;
    },
  });
}

export function useChannelMessages(channelId: string | null, limit = 100) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["channel-messages", channelId, limit],
    enabled: !!channelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_messages")
        .select("*")
        .eq("channel_id", channelId!)
        .is("parent_message_id", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as ChannelMessageRow[]).reverse();
    },
  });

  useEffect(() => {
    if (!channelId) return;
    const ch = supabase
      .channel(`channel-msgs:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channel_messages", filter: `channel_id=eq.${channelId}` },
        () => qc.invalidateQueries({ queryKey: ["channel-messages", channelId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channel_reactions" },
        () => qc.invalidateQueries({ queryKey: ["channel-reactions", channelId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [channelId, qc]);

  return query;
}

export function useChannelReactions(
  channelId: string | null,
  messageIds: string[],
) {
  return useQuery({
    queryKey: ["channel-reactions", channelId, messageIds.length, messageIds.join(",")],
    enabled: !!channelId && messageIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_reactions")
        .select("*")
        .in("message_id", messageIds);
      if (error) throw error;
      return (data ?? []) as ChannelReactionRow[];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Mutations                                                          */
/* ------------------------------------------------------------------ */

export function useSendChannelMessage(channelId: string | null) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { body_md: string; parent_message_id?: string | null; mentions?: string[] }) => {
      if (!channelId || !ws || !user) throw new Error("Not ready");
      const { error } = await supabase.from("channel_messages").insert({
        channel_id: channelId,
        workspace_id: ws.id,
        author_id: user.id,
        body_md: input.body_md,
        parent_message_id: input.parent_message_id ?? null,
        mentions: input.mentions ?? [],
      });
      if (error) throw error;
      // Mark as read since the user just posted
      await supabase.rpc("mark_channel_read", { _channel_id: channelId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channel-messages", channelId] });
      qc.invalidateQueries({ queryKey: ["channel-unread", ws?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Extract @mention user ids from a message body using a member lookup. */
export function extractMentions(
  body: string,
  members: Array<{ user_id: string; display_name?: string | null }>,
): string[] {
  if (!body) return [];
  const ids = new Set<string>();
  const lower = body.toLowerCase();
  for (const m of members) {
    const name = (m.display_name ?? "").trim();
    if (!name) continue;
    const handle = name.toLowerCase().replace(/\s+/g, "");
    if (lower.includes("@" + handle)) ids.add(m.user_id);
  }
  return Array.from(ids);
}

export function useEditChannelMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body_md: string; channel_id: string }) => {
      const { error } = await supabase
        .from("channel_messages")
        .update({ body_md: input.body_md, edited_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ["channel-messages", input.channel_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteChannelMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; channel_id: string }) => {
      const { error } = await supabase
        .from("channel_messages")
        .update({ deleted_at: new Date().toISOString(), body_md: null })
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ["channel-messages", input.channel_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleReaction() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { messageId: string; emoji: string; channelId: string; alreadyReacted: boolean }) => {
      if (!ws || !user) throw new Error("Not ready");
      if (input.alreadyReacted) {
        const { error } = await supabase
          .from("channel_reactions")
          .delete()
          .eq("message_id", input.messageId)
          .eq("user_id", user.id)
          .eq("emoji", input.emoji);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("channel_reactions").insert({
          message_id: input.messageId,
          user_id: user.id,
          emoji: input.emoji,
          workspace_id: ws.id,
        });
        if (error) throw error;
      }
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ["channel-reactions", input.channelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateChannel() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      scope: ChannelScope;
      scope_id?: string | null;
      is_private?: boolean;
      topic?: string | null;
    }) => {
      if (!ws || !user) throw new Error("Not ready");
      const slug = input.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 60) || `channel-${Date.now()}`;
      const { data, error } = await supabase
        .from("channels")
        .insert({
          workspace_id: ws.id,
          scope: input.scope,
          scope_id: input.scope_id ?? null,
          name: input.name,
          slug,
          is_private: input.is_private ?? false,
          topic: input.topic ?? null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ChannelRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels", ws?.id] });
      toast.success("Channel created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------------------------------------------------------ */
/* Unread counts + read tracking                                       */
/* ------------------------------------------------------------------ */

export interface UnreadRow {
  channel_id: string;
  unread_count: number;
  has_mention: boolean;
}

export function useChannelUnreadCounts() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["channel-unread", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("channel_unread_counts", {
        _workspace_id: ws!.id,
      });
      if (error) throw error;
      const map: Record<string, UnreadRow> = {};
      for (const r of (data ?? []) as UnreadRow[]) map[r.channel_id] = r;
      return map;
    },
  });

  // Refresh unread counts whenever any channel message is inserted in this workspace
  useEffect(() => {
    if (!ws?.id) return;
    const ch = supabase
      .channel(`channel-unread:${ws.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "channel_messages", filter: `workspace_id=eq.${ws.id}` },
        () => qc.invalidateQueries({ queryKey: ["channel-unread", ws.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [ws?.id, qc]);

  return query;
}

export function useMarkChannelRead() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { error } = await supabase.rpc("mark_channel_read", {
        _channel_id: channelId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channel-unread", ws?.id] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

export function groupReactions(rows: ChannelReactionRow[]) {
  const map = new Map<string, Map<string, { count: number; userIds: string[] }>>();
  for (const r of rows) {
    let byEmoji = map.get(r.message_id);
    if (!byEmoji) {
      byEmoji = new Map();
      map.set(r.message_id, byEmoji);
    }
    const cur = byEmoji.get(r.emoji) ?? { count: 0, userIds: [] };
    cur.count += 1;
    cur.userIds.push(r.user_id);
    byEmoji.set(r.emoji, cur);
  }
  return map;
}

export function useGroupedReactions(channelId: string | null, messageIds: string[]) {
  const { data } = useChannelReactions(channelId, messageIds);
  return useMemo(() => groupReactions(data ?? []), [data]);
}

/* ------------------------------------------------------------------ */
/* Pinned messages                                                    */
/* ------------------------------------------------------------------ */

export interface ChannelPinRow {
  channel_id: string;
  message_id: string;
  pinned_by: string | null;
  pinned_at: string;
}

export function useChannelPins(channelId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["channel-pins", channelId],
    enabled: !!channelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_pins")
        .select("*, message:channel_messages!channel_pins_message_id_fkey(*)")
        .eq("channel_id", channelId!)
        .order("pinned_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<ChannelPinRow & { message: ChannelMessageRow | null }>;
    },
  });

  useEffect(() => {
    if (!channelId) return;
    const ch = supabase
      .channel(`channel-pins:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channel_pins", filter: `channel_id=eq.${channelId}` },
        () => qc.invalidateQueries({ queryKey: ["channel-pins", channelId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [channelId, qc]);

  return query;
}

export function useTogglePin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { channelId: string; messageId: string; pinned: boolean }) => {
      if (input.pinned) {
        const { error } = await supabase
          .from("channel_pins")
          .delete()
          .eq("channel_id", input.channelId)
          .eq("message_id", input.messageId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("channel_pins").insert({
          channel_id: input.channelId,
          message_id: input.messageId,
          pinned_by: user?.id ?? null,
        });
        if (error) throw error;
      }
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ["channel-pins", input.channelId] });
      toast.success(input.pinned ? "Unpinned" : "Pinned to channel");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------------------------------------------------------ */
/* Convert message to task                                            */
/* ------------------------------------------------------------------ */

export function useConvertMessageToTask() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { channelId: string; messageId: string; body: string; projectId: string; assigneeIds?: string[] }) => {
      if (!ws || !user) throw new Error("Not ready");
      const title = input.body.split("\n")[0].slice(0, 200) || "New task from chat";
      const { data: existing } = await supabase
        .from("tasks")
        .select("position")
        .eq("project_id", input.projectId)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = existing && existing.length > 0 ? Number(existing[0].position) + 1000 : 0;
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          workspace_id: ws.id,
          project_id: input.projectId,
          title,
          status: "todo",
          position: nextPos,
          created_by: user.id,
          task_type: "task",
          assignee_ids: input.assigneeIds ?? [],
          custom_values: { source: { type: "chat_message", channel_id: input.channelId, message_id: input.messageId } },
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => {
      toast.success("Task created from message");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------------------------------------------------------ */
/* Thread replies                                                     */
/* ------------------------------------------------------------------ */

export function useThreadReplies(channelId: string | null, parentId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["channel-thread", channelId, parentId],
    enabled: !!channelId && !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_messages")
        .select("*")
        .eq("channel_id", channelId!)
        .eq("parent_message_id", parentId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChannelMessageRow[];
    },
  });

  useEffect(() => {
    if (!channelId || !parentId) return;
    const ch = supabase
      .channel(`channel-thread:${parentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channel_messages", filter: `parent_message_id=eq.${parentId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["channel-thread", channelId, parentId] });
          qc.invalidateQueries({ queryKey: ["channel-messages", channelId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [channelId, parentId, qc]);

  return query;
}

export function useParentMessage(messageId: string | null) {
  return useQuery({
    queryKey: ["channel-message", messageId],
    enabled: !!messageId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_messages")
        .select("*")
        .eq("id", messageId!)
        .maybeSingle();
      if (error) throw error;
      return data as ChannelMessageRow | null;
    },
  });
}
