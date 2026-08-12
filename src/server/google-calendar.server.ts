// Google Calendar OAuth + sync helpers. Server-only.
import crypto from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const GOOGLE_CAL_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "openid",
  "email",
  "profile",
];

export interface OAuthStatePayload {
  uid: string;
  wid: string;
  nonce: string;
  ts: number;
}

function getSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    "fallback-state-secret"
  );
}

export function signState(payload: OAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): OAuthStatePayload | null {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
    // 30 min validity
    if (Date.now() - payload.ts > 30 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getRedirectUri(origin: string): string {
  return `${origin}/api/public/integrations/google-calendar/callback`;
}

export function buildAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CALENDAR_CLIENT_ID is not configured");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CAL_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google Calendar credentials missing");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google Calendar credentials missing");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

interface GoogleUserInfo {
  email: string;
  verified_email?: boolean;
  name?: string;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch Google user info: ${res.status}`);
  return (await res.json()) as GoogleUserInfo;
}

interface GoogleAttendee {
  email: string;
  displayName?: string;
  organizer?: boolean;
  responseStatus?: string;
  self?: boolean;
}

interface GoogleEvent {
  id: string;
  status: string;
  iCalUID?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  htmlLink?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: GoogleAttendee[];
  organizer?: { email?: string };
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string; label?: string }[];
    conferenceSolution?: { name?: string; key?: { type?: string } };
  };
}

interface GoogleEventsResponse {
  items?: GoogleEvent[];
  nextPageToken?: string;
}

const ZOOM_RE = /https?:\/\/[a-z0-9-]*\.?zoom\.us\/[^\s<>"']+/i;
const MEET_RE = /https?:\/\/meet\.google\.com\/[a-z0-9-]+/i;
const TEAMS_RE = /https?:\/\/teams\.microsoft\.com\/[^\s<>"']+/i;
const WEBEX_RE = /https?:\/\/[a-z0-9-]*\.?webex\.com\/[^\s<>"']+/i;

export function detectConference(
  event: GoogleEvent,
): { url: string | null; kind: "zoom" | "meet" | "teams" | "webex" | "other" | "none" } {
  // Prefer conferenceData entry points
  const ep = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
  if (ep?.uri) {
    const u = ep.uri;
    if (ZOOM_RE.test(u)) return { url: u, kind: "zoom" };
    if (MEET_RE.test(u)) return { url: u, kind: "meet" };
    if (TEAMS_RE.test(u)) return { url: u, kind: "teams" };
    if (WEBEX_RE.test(u)) return { url: u, kind: "webex" };
    return { url: u, kind: "other" };
  }
  if (event.hangoutLink) return { url: event.hangoutLink, kind: "meet" };

  const haystack = `${event.location ?? ""}\n${event.description ?? ""}`;
  const m =
    haystack.match(ZOOM_RE) ||
    haystack.match(MEET_RE) ||
    haystack.match(TEAMS_RE) ||
    haystack.match(WEBEX_RE);
  if (!m) return { url: null, kind: "none" };
  const url = m[0];
  if (ZOOM_RE.test(url)) return { url, kind: "zoom" };
  if (MEET_RE.test(url)) return { url, kind: "meet" };
  if (TEAMS_RE.test(url)) return { url, kind: "teams" };
  if (WEBEX_RE.test(url)) return { url, kind: "webex" };
  return { url, kind: "other" };
}

interface ConnectionRow {
  id: string;
  user_id: string;
  workspace_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}

/** Ensures the connection's access token is fresh, refreshing if needed. */
export async function ensureFreshToken(conn: ConnectionRow): Promise<string> {
  const now = Date.now();
  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  if (expiresAt > now + 60_000) return conn.access_token;
  if (!conn.refresh_token) throw new Error("Connection expired and no refresh token available");

  const tokens = await refreshAccessToken(conn.refresh_token);
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("user_calendar_connections")
    .update({
      access_token: tokens.access_token,
      expires_at: newExpiresAt,
      status: "active",
      last_error: null,
    } as never)
    .eq("id", conn.id);
  return tokens.access_token;
}

export async function fetchUpcomingGoogleEvents(
  accessToken: string,
  opts: { daysAhead?: number; daysBack?: number } = {},
): Promise<GoogleEvent[]> {
  const daysAhead = opts.daysAhead ?? 30;
  const daysBack = opts.daysBack ?? 1;
  const timeMin = new Date(Date.now() - daysBack * 86400_000).toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 86400_000).toISOString();

  const events: GoogleEvent[] = [];
  let pageToken: string | undefined = undefined;
  for (let i = 0; i < 5; i++) {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar fetch failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as GoogleEventsResponse;
    if (data.items) events.push(...data.items);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return events;
}

export interface SyncResult {
  upserted: number;
  withConference: number;
  total: number;
}

export async function syncEventsForConnection(conn: ConnectionRow): Promise<SyncResult> {
  const accessToken = await ensureFreshToken(conn);
  const events = await fetchUpcomingGoogleEvents(accessToken);

  let withConference = 0;
  const rows = events
    .filter((e) => e.status !== "cancelled" && (e.start.dateTime || e.start.date))
    .map((e) => {
      const conf = detectConference(e);
      if (conf.kind !== "none") withConference++;
      const startIso = e.start.dateTime ?? `${e.start.date}T00:00:00Z`;
      const endIso = e.end.dateTime ?? `${e.end.date}T00:00:00Z`;
      return {
        workspace_id: conn.workspace_id,
        user_id: conn.user_id,
        connection_id: conn.id,
        provider: "google",
        provider_event_id: e.id,
        ical_uid: e.iCalUID ?? null,
        title: e.summary ?? "(no title)",
        description: e.description ?? null,
        location: e.location ?? null,
        start_at: startIso,
        end_at: endIso,
        all_day: !!e.start.date && !e.start.dateTime,
        organizer_email: e.organizer?.email ?? null,
        attendees: (e.attendees ?? []) as never,
        conference_url: conf.url,
        conference_kind: conf.kind,
        status: e.status,
        html_link: e.htmlLink ?? null,
      };
    });

  if (rows.length > 0) {
    const { error } = await supabaseAdmin
      .from("calendar_events")
      .upsert(rows as never, { onConflict: "connection_id,provider_event_id" });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
  }

  await supabaseAdmin
    .from("user_calendar_connections")
    .update({ last_synced_at: new Date().toISOString(), status: "active", last_error: null } as never)
    .eq("id", conn.id);

  return { upserted: rows.length, withConference, total: events.length };
}
