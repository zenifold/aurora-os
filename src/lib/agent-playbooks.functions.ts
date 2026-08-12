import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_PLAYBOOKS, type PlaybookStage, type PlaybookTargetKind } from "./agent-playbook-defaults";

const stageEnum = z.enum(["presales", "fulfillment"]);
const targetKindEnum = z.enum(["deal", "sow", "project", "client"]);
const autonomyEnum = z.enum(["suggest", "bounded", "autonomous"]);

async function ensureMember(workspaceId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

// ─── List ────────────────────────────────────────────────────────────────────

export const listPlaybooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        stage: stageEnum.optional(),
        target_kind: targetKindEnum.optional(),
        active_only: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await ensureMember(data.workspace_id, context.userId))) {
      return { ok: false as const, error: "Not a member" };
    }
    let q = supabaseAdmin
      .from("agent_playbooks")
      .select("*, agent:ai_agents(id,name,avatar_emoji,autonomy_level)")
      .eq("workspace_id", data.workspace_id)
      .order("sort_order", { ascending: true });
    if (data.stage) q = q.eq("stage", data.stage);
    if (data.target_kind) q = q.eq("target_kind", data.target_kind);
    if (data.active_only) q = q.eq("is_active", true);
    const { data: rows, error } = await q;
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, playbooks: rows ?? [] };
  });

// ─── Seed defaults ───────────────────────────────────────────────────────────

export const seedDefaultPlaybooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await ensureMember(data.workspace_id, context.userId))) {
      return { ok: false as const, error: "Not a member" };
    }
    const rows = DEFAULT_PLAYBOOKS.map((p: typeof DEFAULT_PLAYBOOKS[number]) => ({
      workspace_id: data.workspace_id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      stage: p.stage,
      target_kind: p.target_kind,
      goal_template: p.goal_template,
      autonomy_override: p.autonomy_override,
      sort_order: p.sort_order,
      is_seeded: true,
      created_by: context.userId,
    }));
    const { error } = await supabaseAdmin
      .from("agent_playbooks")
      .upsert(rows as never, { onConflict: "workspace_id,slug", ignoreDuplicates: true });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, count: rows.length };
  });

// ─── Upsert / Delete ─────────────────────────────────────────────────────────

export const upsertPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        workspace_id: z.string().uuid(),
        slug: z.string().min(1).max(80),
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
        stage: stageEnum,
        target_kind: targetKindEnum,
        agent_id: z.string().uuid().nullable().optional(),
        goal_template: z.string().min(10).max(4000),
        autonomy_override: autonomyEnum.optional(),
        is_active: z.boolean().optional(),
        sort_order: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await ensureMember(data.workspace_id, context.userId))) {
      return { ok: false as const, error: "Not a member" };
    }
    const payload = {
      ...data,
      created_by: context.userId,
    };
    const { data: row, error } = await supabaseAdmin
      .from("agent_playbooks")
      .upsert(payload as never, { onConflict: "workspace_id,slug" })
      .select("*")
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, playbook: row };
  });

export const deletePlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pb } = await supabaseAdmin
      .from("agent_playbooks")
      .select("workspace_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!pb) return { ok: false as const, error: "Not found" };
    if (!(await ensureMember(pb.workspace_id as string, context.userId))) {
      return { ok: false as const, error: "Not a member" };
    }
    const { error } = await supabaseAdmin.from("agent_playbooks").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ─── Run playbook ────────────────────────────────────────────────────────────

type TargetKind = PlaybookTargetKind;

async function resolveTargetContext(
  workspaceId: string,
  kind: TargetKind,
  id: string,
): Promise<{ ok: true; vars: Record<string, string>; clientId?: string } | { ok: false; error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const vars: Record<string, string> = {};

  const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

  if (kind === "deal") {
    const { data: deal, error } = await supabaseAdmin
      .from("deals")
      .select("*, contact:contacts(full_name,email,company_name,account_id)")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error || !deal) return { ok: false, error: "Deal not found" };
    const contact = (deal as Record<string, unknown>).contact as { full_name?: string; email?: string; company_name?: string; account_id?: string } | null;
    let clientName = contact?.company_name ?? "the prospect";
    let clientIndustry = "—";
    let clientWebsite = "—";
    let clientId: string | undefined = contact?.account_id;
    if (clientId) {
      const { data: acc } = await supabaseAdmin
        .from("client_accounts")
        .select("name,industry,website")
        .eq("id", clientId)
        .maybeSingle();
      if (acc) {
        clientName = (acc.name as string) ?? clientName;
        clientIndustry = fmt(acc.industry);
        clientWebsite = fmt(acc.website);
      }
    }
    Object.assign(vars, {
      deal_id: deal.id as string,
      deal_title: fmt(deal.title),
      deal_description: fmt(deal.description),
      deal_value: fmt(deal.value),
      deal_currency: fmt(deal.currency),
      deal_probability: fmt(deal.probability),
      client_name: clientName,
      client_industry: clientIndustry,
      client_website: clientWebsite,
      contact_name: fmt(contact?.full_name),
      contact_email: fmt(contact?.email),
    });
    return { ok: true, vars, clientId };
  }

  if (kind === "sow") {
    const { data: sow, error } = await supabaseAdmin
      .from("sow_drafts")
      .select("*, deal:deals(id,title,value,currency,description)")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error || !sow) return { ok: false, error: "SOW not found" };
    const deal = (sow as Record<string, unknown>).deal as { id?: string; title?: string; value?: number; currency?: string; description?: string } | null;
    Object.assign(vars, {
      sow_id: sow.id as string,
      sow_title: fmt(sow.title),
      sow_status: fmt(sow.status),
      sow_scope: fmt(sow.scope),
      sow_executive_summary: fmt(sow.executive_summary),
      deal_id: fmt(deal?.id),
      deal_title: fmt(deal?.title),
      deal_value: fmt(deal?.value),
      deal_currency: fmt(deal?.currency),
      client_name: fmt(sow.client_name),
    });
    return { ok: true, vars };
  }

  if (kind === "project") {
    const { data: proj, error } = await supabaseAdmin
      .from("projects")
      .select("id,name,client_name,client_account_id,target_end_date,health")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error || !proj) return { ok: false, error: "Project not found" };
    Object.assign(vars, {
      project_id: proj.id as string,
      project_name: fmt(proj.name),
      client_name: fmt(proj.client_name),
      project_health: fmt(proj.health),
      project_target_end: fmt(proj.target_end_date),
    });
    return { ok: true, vars, clientId: (proj.client_account_id as string) ?? undefined };
  }

  if (kind === "client") {
    const { data: acc, error } = await supabaseAdmin
      .from("client_accounts")
      .select("id,name,industry,website,tier,health,status")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error || !acc) return { ok: false, error: "Client not found" };
    Object.assign(vars, {
      client_id: acc.id as string,
      client_name: fmt(acc.name),
      client_industry: fmt(acc.industry),
      client_website: fmt(acc.website),
      client_tier: fmt(acc.tier),
      client_health: fmt(acc.health),
      client_status: fmt(acc.status),
    });
    return { ok: true, vars, clientId: acc.id as string };
  }

  return { ok: false, error: "Unknown target" };
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export const runPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        playbook_id: z.string().uuid(),
        target_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await ensureMember(data.workspace_id, context.userId))) {
      return { ok: false as const, error: "Not a member" };
    }

    // Load playbook
    const { data: pb } = await supabaseAdmin
      .from("agent_playbooks")
      .select("*")
      .eq("id", data.playbook_id)
      .eq("workspace_id", data.workspace_id)
      .maybeSingle();
    if (!pb) return { ok: false as const, error: "Playbook not found" };
    if (!pb.is_active) return { ok: false as const, error: "Playbook disabled" };

    // Resolve context variables for the target
    const ctx = await resolveTargetContext(
      data.workspace_id,
      pb.target_kind as TargetKind,
      data.target_id,
    );
    if (!ctx.ok) return { ok: false as const, error: ctx.error };

    const goal = renderTemplate(pb.goal_template as string, ctx.vars);

    // Pick agent: playbook's, or the first active agent in the workspace
    let agentId = pb.agent_id as string | null;
    if (!agentId) {
      const { data: agent } = await supabaseAdmin
        .from("ai_agents")
        .select("id")
        .eq("workspace_id", data.workspace_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!agent) {
        return {
          ok: false as const,
          error: "No active AI agent. Create one in /app/agents first.",
        };
      }
      agentId = agent.id as string;
    }

    // Create execution row
    const { data: exec, error: execErr } = await supabaseAdmin
      .from("agent_executions")
      .insert({
        workspace_id: data.workspace_id,
        agent_id: agentId,
        trigger: "user_request",
        goal,
        context: {
          playbook_id: pb.id,
          playbook_slug: pb.slug,
          playbook_stage: pb.stage,
          target_kind: pb.target_kind,
          target_id: data.target_id,
          vars: ctx.vars,
        },
        status: "planning",
        requested_by: context.userId,
      } as never)
      .select("id")
      .maybeSingle();
    if (execErr || !exec) {
      return { ok: false as const, error: execErr?.message ?? "Failed to create run" };
    }

    await supabaseAdmin
      .from("ai_agents")
      .update({ status: "working" } as never)
      .eq("id", agentId);

    // Kick off the plan loop in the background by calling executeAgent's logic.
    // We import here to avoid circular module init.
    try {
      const { executeAgent } = await import("@/server/agents.functions");
      // Fire and forget — UI will poll the run.
      void executeAgent({ data: { execution_id: exec.id as string } }).catch(() => {
        /* swallowed; status will reflect failure */
      });
    } catch {
      /* runtime may not be available in some test paths */
    }

    return { ok: true as const, execution_id: exec.id as string, agent_id: agentId };
  });
