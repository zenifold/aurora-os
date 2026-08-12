import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncEventsForConnection } from "@/server/google-calendar.server";

/**
 * Periodic sync endpoint for all active Google Calendar connections.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` OR `?token=<CRON_SECRET>`
 * Wire this to pg_cron or any external scheduler. Recommended cadence: every 15 min.
 *
 * Example pg_cron job (cron expression: every 15 minutes):
 *   select cron.schedule('google-cal-sync', '0,15,30,45 * * * *',
 *     $$ select net.http_get(
 *          url := 'https://<your-domain>/api/public/integrations/google-calendar/cron?token=<CRON_SECRET>'
 *        ); $$);

 */
export const Route = createFileRoute("/api/public/integrations/google-calendar/cron")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});

async function handler({ request }: { request: Request }) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  const url = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("token") ||
    "";
  if (provided !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Only sync connections that are active AND stale (>10 min) or never synced.
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: conns, error } = await supabaseAdmin
    .from("user_calendar_connections")
    .select("id, user_id, workspace_id, access_token, refresh_token, expires_at, last_synced_at")
    .eq("provider", "google")
    .eq("status", "active")
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
    .limit(100);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: Array<{ id: string; ok: boolean; error?: string; upserted?: number }> = [];
  for (const conn of conns ?? []) {
    try {
      const res = await syncEventsForConnection(conn);
      results.push({ id: conn.id, ok: true, upserted: res.upserted });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "sync failed";
      await supabaseAdmin
        .from("user_calendar_connections")
        .update({ status: "error", last_error: msg } as never)
        .eq("id", conn.id);
      results.push({ id: conn.id, ok: false, error: msg });
    }
  }

  return Response.json({
    ok: true,
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
