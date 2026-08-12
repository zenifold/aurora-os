import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildAuthUrl,
  getRedirectUri,
  signState,
  syncEventsForConnection,
} from "@/server/google-calendar.server";

/** Returns a Google OAuth consent URL for the current user + workspace. */
export const getGoogleCalendarAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspace_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const req = getRequest();
    const origin = req
      ? new URL(req.url).origin
      : process.env.PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = getRedirectUri(origin);
    const state = signState({
      uid: context.userId,
      wid: data.workspace_id,
      nonce: crypto.randomUUID(),
      ts: Date.now(),
    });
    return { url: buildAuthUrl(state, redirectUri), redirectUri };
  });

/** Disconnect Google Calendar for the current user + workspace. */
export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspace_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("user_calendar_connections")
      .delete()
      .eq("user_id", context.userId)
      .eq("workspace_id", data.workspace_id)
      .eq("provider", "google");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Trigger a sync of upcoming events from Google Calendar. */
export const syncGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspace_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: conn, error } = await supabaseAdmin
      .from("user_calendar_connections")
      .select("id, user_id, workspace_id, access_token, refresh_token, expires_at")
      .eq("user_id", context.userId)
      .eq("workspace_id", data.workspace_id)
      .eq("provider", "google")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conn) return { ok: false, error: "Not connected" };

    try {
      const result = await syncEventsForConnection(conn);
      return { ok: true, ...result };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      await supabaseAdmin
        .from("user_calendar_connections")
        .update({ status: "error", last_error: msg } as never)
        .eq("id", conn.id);
      return { ok: false, error: msg };
    }
  });

/** Quickly returns the connection status for the calendar settings page. */
export const getCalendarConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspace_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: conn } = await supabaseAdmin
      .from("user_calendar_connections")
      .select("provider, provider_account_email, status, last_synced_at, last_error, scopes")
      .eq("user_id", context.userId)
      .eq("workspace_id", data.workspace_id);
    return { connections: conn ?? [] };
  });

/**
 * Create (or return existing) Meeting prefilled from a synced calendar event.
 * Links the calendar event back to the meeting so the button flips to "Open meeting".
 */
export const createMeetingFromCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        calendar_event_id: z.string().uuid(),
        project_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: ev, error: evErr } = await supabaseAdmin
      .from("calendar_events")
      .select(
        "id, workspace_id, user_id, title, description, start_at, end_at, attendees, organizer_email, conference_url, conference_kind, linked_meeting_id, linked_project_id",
      )
      .eq("id", data.calendar_event_id)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!ev) throw new Error("Calendar event not found");
    if (ev.user_id !== context.userId) throw new Error("Not allowed");

    if (ev.linked_meeting_id) return { meeting_id: ev.linked_meeting_id, created: false };

    const attendees = (ev.attendees ?? []) as Array<{ email?: string }>;
    const emails = Array.from(
      new Set(
        attendees
          .map((a) => (a?.email ?? "").trim().toLowerCase())
          .filter((e) => e && e.includes("@")),
      ),
    );

    const platform =
      ev.conference_kind === "zoom" || ev.conference_kind === "meet" || ev.conference_kind === "teams"
        ? ev.conference_kind
        : "manual_upload";

    const desc = ev.conference_url
      ? `${ev.description ?? ""}\n\nJoin: ${ev.conference_url}`.trim()
      : ev.description ?? null;

    const { data: meeting, error: insErr } = await supabaseAdmin
      .from("meetings")
      .insert({
        workspace_id: ev.workspace_id,
        project_id: data.project_id ?? ev.linked_project_id ?? null,
        title: ev.title,
        description: desc,
        platform,
        scheduled_start: ev.start_at,
        scheduled_end: ev.end_at,
        participant_emails: emails,
        organizer_id: context.userId,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin
      .from("calendar_events")
      .update({ linked_meeting_id: meeting.id } as never)
      .eq("id", ev.id);

    // Seed participants table (best-effort)
    if (emails.length > 0) {
      await supabaseAdmin.from("meeting_participants").insert(
        emails.map((email) => ({
          workspace_id: ev.workspace_id,
          meeting_id: meeting.id,
          email,
          role: email === ev.organizer_email ? "organizer" : "required",
        })) as never,
      );
    }

    return { meeting_id: meeting.id as string, created: true };
  });
