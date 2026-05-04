import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface PresenceUser {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  color: string;
  online_at: string;
}

// Stable color from a user id — for cursor / outline color
export function colorForUser(userId: string): string {
  const palette = [
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  ];
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

/**
 * Tracks who is currently viewing a given channel (project, task, document, …).
 * Returns the list of currently-online users, excluding the local user.
 * Pass channelKey=null to disable.
 */
export function usePresence(
  channelKey: string | null,
  meta?: { display_name?: string | null; avatar_url?: string | null },
): { users: PresenceUser[]; selfColor: string } {
  const { user } = useAuth();
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!channelKey || !user) {
      setUsers([]);
      return;
    }

    const channel = supabase.channel(channelKey, {
      config: { presence: { key: user.id } },
    });

    const sync = () => {
      const state = channel.presenceState<PresenceUser>();
      const flat: PresenceUser[] = [];
      Object.values(state).forEach((entries) => {
        if (entries.length > 0) flat.push(entries[0]);
      });
      setUsers(flat.filter((u) => u.user_id !== user.id));
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            display_name:
              meta?.display_name ||
              (user.email ? user.email.split("@")[0] : "Someone"),
            avatar_url: meta?.avatar_url ?? null,
            color: colorForUser(user.id),
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelKey, user, meta?.display_name, meta?.avatar_url]);

  return { users, selfColor: user ? colorForUser(user.id) : "#888" };
}

/**
 * Lightweight per-task typing indicator using broadcast (no presence needed).
 * Returns the names of others currently typing, plus a `setTyping(true|false)` setter.
 */
export function useTypingIndicator(channelKey: string | null) {
  const { user } = useAuth();
  const [typing, setTyping] = useState<string[]>([]);

  useEffect(() => {
    if (!channelKey || !user) return;
    const ch = supabase.channel(`${channelKey}:typing`);
    const lastSeen = new Map<string, number>();
    let pruneTimer: ReturnType<typeof setInterval> | null = null;

    const recompute = () => {
      const cutoff = Date.now() - 4000;
      const live: string[] = [];
      lastSeen.forEach((ts, name) => {
        if (ts > cutoff) live.push(name);
        else lastSeen.delete(name);
      });
      setTyping(live);
    };

    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      const p = payload as { user_id: string; name: string };
      if (p.user_id === user.id) return;
      lastSeen.set(p.name, Date.now());
      recompute();
    }).subscribe();

    pruneTimer = setInterval(recompute, 2000);
    return () => {
      if (pruneTimer) clearInterval(pruneTimer);
      void supabase.removeChannel(ch);
    };
  }, [channelKey, user]);

  const broadcastTyping = async (name: string) => {
    if (!channelKey || !user) return;
    const ch = supabase.channel(`${channelKey}:typing`);
    await ch.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user.id, name },
    });
  };

  return { typing, broadcastTyping };
}
