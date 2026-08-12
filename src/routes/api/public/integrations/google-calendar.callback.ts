import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  getRedirectUri,
  syncEventsForConnection,
  verifyState,
} from "@/server/google-calendar.server";

function redirectWith(origin: string, params: Record<string, string>): Response {
  const search = new URLSearchParams(params).toString();
  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/app/settings/integrations?${search}` },
  });
}

export const Route = createFileRoute("/api/public/integrations/google-calendar/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const code = url.searchParams.get("code");
        const stateRaw = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");

        if (oauthError) return redirectWith(origin, { error: oauthError });
        if (!code || !stateRaw) return redirectWith(origin, { error: "missing_params" });

        const state = verifyState(stateRaw);
        if (!state) return redirectWith(origin, { error: "invalid_state" });

        try {
          const redirectUri = getRedirectUri(origin);
          const tokens = await exchangeCodeForTokens(code, redirectUri);
          const userInfo = await fetchGoogleUserInfo(tokens.access_token);
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
          const scopes = tokens.scope.split(" ").filter(Boolean);

          const { data: existing } = await supabaseAdmin
            .from("user_calendar_connections")
            .select("id")
            .eq("user_id", state.uid)
            .eq("workspace_id", state.wid)
            .eq("provider", "google")
            .maybeSingle();

          let connId: string;
          if (existing) {
            const { error } = await supabaseAdmin
              .from("user_calendar_connections")
              .update({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token ?? undefined,
                expires_at: expiresAt,
                scopes,
                provider_account_email: userInfo.email,
                status: "active",
                last_error: null,
              } as never)
              .eq("id", existing.id);
            if (error) throw new Error(error.message);
            connId = existing.id;
          } else {
            const { data: inserted, error } = await supabaseAdmin
              .from("user_calendar_connections")
              .insert({
                user_id: state.uid,
                workspace_id: state.wid,
                provider: "google",
                provider_account_email: userInfo.email,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token ?? null,
                expires_at: expiresAt,
                scopes,
                status: "active",
              } as never)
              .select("id")
              .single();
            if (error || !inserted) throw new Error(error?.message ?? "Insert failed");
            connId = inserted.id;
          }

          // Fire off an initial sync (best-effort).
          try {
            const { data: conn } = await supabaseAdmin
              .from("user_calendar_connections")
              .select("id, user_id, workspace_id, access_token, refresh_token, expires_at")
              .eq("id", connId)
              .single();
            if (conn) await syncEventsForConnection(conn);
          } catch (syncErr) {
            console.warn("Initial calendar sync failed:", syncErr);
          }

          return redirectWith(origin, { connected: "google" });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "callback_failed";
          console.error("Google Calendar callback error:", msg);
          return redirectWith(origin, { error: msg });
        }
      },
    },
  },
});
