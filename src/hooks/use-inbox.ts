import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";

export type InboxKind =
  | "mention"
  | "assignment"
  | "due_soon"
  | "approval"
  | "agent"
  | "comment"
  | "channel_message"
  | "portal"
  | "other";

export interface InboxItem {
  id: string;
  kind: InboxKind;
  title: string;
  body: string | null;
  link: string | null;
  actor_id: string | null;
  project_id: string | null;
  task_id: string | null;
  created_at: string;
  read_at: string | null;
  snoozed_until: string | null;
  archived_at: string | null;
  source: "notification" | "task";
}

function classify(type: string): InboxKind {
  if (type.includes("mention")) return "mention";
  if (type.includes("assign")) return "assignment";
  if (type.includes("approval")) return "approval";
  if (type === "agent" || type.startsWith("agent")) return "agent";
  if (type.includes("comment")) return "comment";
  if (type.includes("channel")) return "channel_message";
  if (type.includes("portal") || type.includes("client")) return "portal";
  if (type.includes("due")) return "due_soon";
  return "other";
}

export function useInbox() {
  const { user } = useAuth();
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["inbox", user?.id, ws?.id],
    enabled: !!user && !!ws,
    queryFn: async () => {
      const [{ data: notifs, error: nErr }, { data: tasks, error: tErr }] = await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("recipient_id", user!.id)
          .eq("workspace_id", ws!.id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("tasks")
          .select("id,title,due_date,project_id,workspace_id,assignee_ids,status,completed_at")
          .eq("workspace_id", ws!.id)
          .contains("assignee_ids", [user!.id])
          .not("due_date", "is", null)
          .is("completed_at", null)
          .lte("due_date", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
          .order("due_date", { ascending: true })
          .limit(100),
      ]);
      if (nErr) throw nErr;
      if (tErr) throw tErr;

      const items: InboxItem[] = [];

      for (const n of notifs ?? []) {
        items.push({
          id: `n:${n.id}`,
          kind: classify(n.type),
          title: n.title,
          body: n.body,
          link: n.link,
          actor_id: n.actor_id,
          project_id: n.project_id,
          task_id: n.task_id,
          created_at: n.created_at,
          read_at: n.read_at,
          snoozed_until: (n as { snoozed_until: string | null }).snoozed_until ?? null,
          archived_at: (n as { archived_at: string | null }).archived_at ?? null,
          source: "notification",
        });
      }

      const today = new Date().toISOString().slice(0, 10);
      for (const t of tasks ?? []) {
        const overdue = t.due_date && t.due_date < today;
        items.push({
          id: `t:${t.id}`,
          kind: "due_soon",
          title: overdue ? `Overdue: ${t.title}` : `Due ${t.due_date}: ${t.title}`,
          body: null,
          link: `/app/p/${t.project_id}`,
          actor_id: null,
          project_id: t.project_id,
          task_id: t.id,
          created_at: t.due_date ?? new Date().toISOString(),
          read_at: null,
          snoozed_until: null,
          archived_at: null,
          source: "task",
        });
      }

      // sort: not-archived & not-snoozed first, then by created desc
      const now = Date.now();
      items.sort((a, b) => {
        const aActive = !a.archived_at && (!a.snoozed_until || new Date(a.snoozed_until).getTime() < now);
        const bActive = !b.archived_at && (!b.snoozed_until || new Date(b.snoozed_until).getTime() < now);
        if (aActive !== bActive) return aActive ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return items;
    },
  });

  useEffect(() => {
    if (!user) return;
    const channelId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ch = supabase
      .channel(`inbox:${user.id}:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["inbox", user.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, qc]);

  return query;
}

export function useInboxCounts() {
  const { data } = useInbox();
  return useMemo(() => {
    const now = Date.now();
    let total = 0;
    let unread = 0;
    for (const it of data ?? []) {
      if (it.archived_at) continue;
      if (it.snoozed_until && new Date(it.snoozed_until).getTime() > now) continue;
      total++;
      if (!it.read_at) unread++;
    }
    return { total, unread };
  }, [data]);
}

function notifIdFromInbox(id: string) {
  return id.startsWith("n:") ? id.slice(2) : null;
}

export function useInboxActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["inbox", user?.id] });

  const markRead = useMutation({
    mutationFn: async (inboxId: string) => {
      const id = notifIdFromInbox(inboxId);
      if (!id) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const markUnread = useMutation({
    mutationFn: async (inboxId: string) => {
      const id = notifIdFromInbox(inboxId);
      if (!id) return;
      const { error } = await supabase.from("notifications").update({ read_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: async (inboxId: string) => {
      const id = notifIdFromInbox(inboxId);
      if (!id) return;
      const { error } = await supabase
        .from("notifications")
        .update({ archived_at: new Date().toISOString(), read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const snooze = useMutation({
    mutationFn: async ({ inboxId, until }: { inboxId: string; until: Date }) => {
      const id = notifIdFromInbox(inboxId);
      if (!id) return;
      const { error } = await supabase
        .from("notifications")
        .update({ snoozed_until: until.toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", user.id)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { markRead, markUnread, archive, snooze, markAllRead };
}
