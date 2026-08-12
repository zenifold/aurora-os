import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPanelAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) return { ok: false as const, error: "Not a member" };

    const { data: rows, error } = await supabaseAdmin
      .from("ai_agents")
      .select("*")
      .eq("workspace_id", data.workspace_id)
      .order("created_at", { ascending: true });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, agents: rows ?? [] };
  });

export const listPanelAgentExecutions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(15),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) return { ok: false as const, error: "Not a member" };

    const { data: rows, error } = await supabaseAdmin
      .from("agent_executions")
      .select("*")
      .eq("workspace_id", data.workspace_id)
      .order("started_at", { ascending: false })
      .limit(data.limit);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, executions: rows ?? [] };
  });

export const listPanelPendingApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) return { ok: false as const, error: "Not a member" };

    const { data: rows, error } = await supabaseAdmin
      .from("agent_action_approvals")
      .select("*, agent:ai_agents(id,name,handle,avatar_emoji,avatar_url)")
      .eq("workspace_id", data.workspace_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, approvals: rows ?? [] };
  });