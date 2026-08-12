import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Centralised loader for token-based client portal access.
 * Returns null when token is missing/invalid/inactive/expired so callers can
 * uniformly respond with 404. Optionally logs an activity event.
 */
export async function loadPortalAccess(token: string | undefined) {
  if (!token || token.length < 20) return null;
  const { data } = await supabaseAdmin
    .from("client_portal_access")
    .select("*")
    .eq("access_token", token)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  if (data.token_expires_at && new Date(data.token_expires_at).getTime() < Date.now()) {
    return null;
  }
  return data;
}

export async function logPortalActivity(
  access: { id: string; workspace_id: string; project_id: string },
  activity_type:
    | "login"
    | "viewed_task"
    | "completed_deliverable"
    | "commented"
    | "downloaded_file"
    | "viewed_timeline"
    | "acknowledged_impact",
  metadata: Record<string, unknown> = {},
) {
  await supabaseAdmin.from("portal_activity_log").insert({
    workspace_id: access.workspace_id,
    project_id: access.project_id,
    client_portal_access_id: access.id,
    activity_type,
    metadata: metadata as never,
  });
}
