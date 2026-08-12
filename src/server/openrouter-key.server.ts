// Single source of truth for resolving a workspace's OpenRouter API key.
//
// Keys are tenant-scoped: one per workspace, stored in `workspace_ai_secrets`
// and set by workspace owners in Settings → AI. There is deliberately no
// per-user key — `workspace_ai_secrets.updated_by` is an audit column, not a
// second tier of resolution.
//
// `OPENROUTER_API_KEY` is a deployment-wide fallback kept only so features that
// have not yet been threaded with workspace context keep working. It is a
// stopgap: prefer the workspace key, and once every caller passes a
// workspaceId, drop the env var from the Worker secrets entirely.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * The workspace's key, or null when the workspace has not configured one.
 * Does not consult the environment — use {@link resolveOpenRouterKey} for that.
 */
export async function getWorkspaceOpenRouterKey(
  workspaceId: string,
): Promise<string | null> {
  if (!workspaceId) return null;
  const { data, error } = await supabaseAdmin
    .from("workspace_ai_secrets")
    .select("openrouter_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) {
    console.error("[openrouter] workspace key lookup failed:", error.message);
    return null;
  }
  return data?.openrouter_api_key ?? null;
}

/**
 * Workspace key first, deployment-wide env key second.
 *
 * Pass a workspaceId whenever one is reachable. Calling without one skips
 * straight to the env fallback, which is the behaviour being phased out.
 */
export async function resolveOpenRouterKey(
  workspaceId?: string | null,
): Promise<string | null> {
  if (workspaceId) {
    const workspaceKey = await getWorkspaceOpenRouterKey(workspaceId);
    if (workspaceKey) return workspaceKey;
  }
  return process.env.OPENROUTER_API_KEY ?? null;
}

/** Shown when neither a workspace key nor the env fallback is present. */
export const OPENROUTER_KEY_MISSING_ERROR =
  "No OpenRouter API key for this workspace. Add one in Settings → AI.";
