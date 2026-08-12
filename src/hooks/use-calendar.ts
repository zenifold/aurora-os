import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  createMeetingFromCalendarEvent,
  disconnectGoogleCalendar,
  getCalendarConnectionStatus,
  getGoogleCalendarAuthUrl,
  syncGoogleCalendar,
} from "@/lib/google-calendar.functions";
import { toast } from "sonner";

export interface CalendarEvent {
  id: string;
  workspace_id: string;
  user_id: string;
  provider: string;
  provider_event_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  organizer_email: string | null;
  attendees: { email: string; displayName?: string; responseStatus?: string }[];
  conference_url: string | null;
  conference_kind: "zoom" | "meet" | "teams" | "webex" | "other" | "none" | null;
  status: string | null;
  html_link: string | null;
  linked_meeting_id: string | null;
  linked_project_id: string | null;
  auto_capture_enabled: boolean;
}

export function useUpcomingCalendarEvents(opts: { daysAhead?: number; daysBack?: number } = {}) {
  const ws = useWorkspaceStore((s) => s.current);
  const daysAhead = opts.daysAhead ?? 14;
  const daysBack = opts.daysBack ?? 0;
  return useQuery({
    queryKey: ["calendar-events", ws?.id, daysAhead, daysBack],
    enabled: !!ws,
    queryFn: async () => {
      const from = new Date(Date.now() - daysBack * 86400_000).toISOString();
      const to = new Date(Date.now() + daysAhead * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("workspace_id", ws!.id)
        .gte("start_at", from)
        .lte("start_at", to)
        .order("start_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CalendarEvent[];
    },
  });
}

export function useCalendarConnections() {
  const ws = useWorkspaceStore((s) => s.current);
  const fn = useServerFn(getCalendarConnectionStatus);
  return useQuery({
    queryKey: ["calendar-connections", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const res = await fn({ data: { workspace_id: ws!.id } });
      return res.connections as {
        provider: string;
        provider_account_email: string | null;
        status: string;
        last_synced_at: string | null;
        last_error: string | null;
        scopes: string[];
      }[];
    },
  });
}

/**
 * Auto-syncs the user's Google Calendar in the background if the last sync is
 * older than `staleMs` (default 15 min). Call once from a top-level app
 * component so calendar events stay reasonably fresh without manual clicks.
 */
export function useAutoSyncCalendar(staleMs = 15 * 60_000) {
  const { data: connections } = useCalendarConnections();
  const sync = useSyncGoogleCalendar();
  const google = connections?.find((c) => c.provider === "google");
  const lastSync = google?.last_synced_at ? new Date(google.last_synced_at).getTime() : 0;
  const isStale = google?.status === "active" && Date.now() - lastSync > staleMs;
  if (typeof window !== "undefined" && isStale && !sync.isPending) {
    queueMicrotask(() => sync.mutate());
  }
}

export function useConnectGoogleCalendar() {
  const ws = useWorkspaceStore((s) => s.current);
  const fn = useServerFn(getGoogleCalendarAuthUrl);
  return useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("No workspace");
      const res = await fn({ data: { workspace_id: ws.id } });
      window.location.href = res.url;
      return res;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSyncGoogleCalendar() {
  const ws = useWorkspaceStore((s) => s.current);
  const fn = useServerFn(syncGoogleCalendar);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("No workspace");
      return fn({ data: { workspace_id: ws.id } });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error ?? "Sync failed");
        return;
      }
      toast.success(`Synced ${res.upserted ?? 0} events`);
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      qc.invalidateQueries({ queryKey: ["calendar-connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDisconnectGoogleCalendar() {
  const ws = useWorkspaceStore((s) => s.current);
  const fn = useServerFn(disconnectGoogleCalendar);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("No workspace");
      return fn({ data: { workspace_id: ws.id } });
    },
    onSuccess: () => {
      toast.success("Google Calendar disconnected");
      qc.invalidateQueries({ queryKey: ["calendar-connections"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateMeetingFromEvent() {
  const fn = useServerFn(createMeetingFromCalendarEvent);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { calendar_event_id: string; project_id?: string | null }) =>
      fn({ data: input }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      if (res.created) toast.success("Meeting prepared from calendar event");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
