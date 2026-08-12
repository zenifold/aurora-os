// SOW server fns scoped to a client (not a deal).
// Lets the UI list every SOW for a client across all its deals, fetch a SOW
// by its own id (deal-independent navigation), and create a SOW directly
// from the client page — auto-provisioning a deal if none exists yet.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertMember(workspaceId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Not a workspace member");
}

export type SowSummary = {
  id: string;
  deal_id: string;
  deal_title: string | null;
  version: number;
  status: string;
  title: string;
  total: number | null;
  currency: string | null;
  updated_at: string;
};

export const listSowsByClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ client_account_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SowSummary[]> => {
    const { data: acc } = await supabaseAdmin
      .from("client_accounts")
      .select("workspace_id")
      .eq("id", data.client_account_id)
      .single();
    if (!acc) throw new Error("Client not found");
    await assertMember(acc.workspace_id, context.userId);

    const { data: deals } = await supabaseAdmin
      .from("deals")
      .select("id, title")
      .eq("client_account_id", data.client_account_id);
    const dealIds = (deals ?? []).map((d) => d.id);
    if (!dealIds.length) return [];

    const titleByDeal = new Map((deals ?? []).map((d) => [d.id, d.title as string]));

    const { data: sows } = await supabaseAdmin
      .from("sow_drafts" as never)
      .select("id, deal_id, version, status, title, financials, updated_at")
      .in("deal_id", dealIds)
      .order("updated_at", { ascending: false });

    return ((sows ?? []) as Array<{
      id: string;
      deal_id: string;
      version: number;
      status: string;
      title: string;
      financials: { total?: number; currency?: string } | null;
      updated_at: string;
    }>).map((s) => ({
      id: s.id,
      deal_id: s.deal_id,
      deal_title: titleByDeal.get(s.deal_id) ?? null,
      version: s.version,
      status: s.status,
      title: s.title,
      total: s.financials?.total ?? null,
      currency: s.financials?.currency ?? null,
      updated_at: s.updated_at,
    }));
  });

export const getSowById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sow_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: sow } = await supabaseAdmin
      .from("sow_drafts" as never)
      .select("*")
      .eq("id", data.sow_id)
      .single();
    if (!sow) return null;
    const s = sow as { workspace_id: string; deal_id: string };
    await assertMember(s.workspace_id, context.userId);

    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select("id, title, client_account_id")
      .eq("id", s.deal_id)
      .single();

    return { sow, deal };
  });

/**
 * Create a SOW directly from a client. If no deal_id is provided, we create
 * a minimal placeholder deal first so the SOW has somewhere to live. The UI
 * exposes this as "New SOW" on the client page.
 */
export const createSowForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        client_account_id: z.string().uuid(),
        deal_id: z.string().uuid().optional().nullable(),
        title: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: acc } = await supabaseAdmin
      .from("client_accounts")
      .select("workspace_id, name, account_owner_id")
      .eq("id", data.client_account_id)
      .single();
    if (!acc) throw new Error("Client not found");
    await assertMember(acc.workspace_id, context.userId);

    let dealId = data.deal_id ?? null;
    if (!dealId) {
      // Find a default stage for placeholder deal
      const { data: stage } = await supabaseAdmin
        .from("deal_stages")
        .select("id")
        .eq("workspace_id", acc.workspace_id)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!stage?.id) throw new Error("No deal stages configured for this workspace");
      const { data: newDeal, error: dErr } = await supabaseAdmin
        .from("deals")
        .insert({
          workspace_id: acc.workspace_id,
          client_account_id: data.client_account_id,
          stage_id: stage.id,
          title: data.title,
          owner_id: acc.account_owner_id ?? context.userId,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (dErr) throw new Error(dErr.message);
      dealId = newDeal.id;
    }

    // Insert an empty SOW row (version 1, draft). The user then runs the
    // AI draft from the SOW detail page.
    const { data: existing } = await supabaseAdmin
      .from("sow_drafts" as never)
      .select("version")
      .eq("deal_id", dealId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = ((existing as { version?: number } | null)?.version ?? 0) + 1;

    const finalDealId = dealId as string;
    const { data: sow, error } = await supabaseAdmin
      .from("sow_drafts" as never)
      .insert({
        workspace_id: acc.workspace_id,
        deal_id: finalDealId,
        version: nextVersion,
        status: "draft",
        title: data.title,
        client_name: acc.name,
        deliverables: [],
        team_composition: [],
        timeline: [],
        financials: {},
        assumptions: [],
        risks: [],
        success_criteria: [],
        section_meta: {},
        created_by: context.userId,
      } as never)
      .select("id, deal_id")
      .single();
    if (error) throw new Error(error.message);

    return sow as { id: string; deal_id: string };
  });

async function loadSowOwner(sowId: string) {
  const { data } = await supabaseAdmin
    .from("sow_drafts" as never)
    .select("id, workspace_id, deal_id, title, version, client_name, executive_summary, strategy, positioning, value_proposition, scope, out_of_scope, technical_architecture, integrations_approach, terms_conditions, next_steps, deliverables, team_composition, timeline, financials, assumptions, risks, success_criteria, section_meta")
    .eq("id", sowId)
    .maybeSingle();
  return data as
    | (Record<string, unknown> & { id: string; workspace_id: string; deal_id: string; version: number; title: string })
    | null;
}

export const renameSow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ sow_id: z.string().uuid(), title: z.string().trim().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sow = await loadSowOwner(data.sow_id);
    if (!sow) throw new Error("SOW not found");
    await assertMember(sow.workspace_id, context.userId);
    const { error } = await supabaseAdmin
      .from("sow_drafts" as never)
      .update({ title: data.title } as never)
      .eq("id", data.sow_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sow_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sow = await loadSowOwner(data.sow_id);
    if (!sow) throw new Error("SOW not found");
    await assertMember(sow.workspace_id, context.userId);
    const { error } = await supabaseAdmin
      .from("sow_drafts" as never)
      .delete()
      .eq("id", data.sow_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateSow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sow_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sow = await loadSowOwner(data.sow_id);
    if (!sow) throw new Error("SOW not found");
    await assertMember(sow.workspace_id, context.userId);

    const { data: existing } = await supabaseAdmin
      .from("sow_drafts" as never)
      .select("version")
      .eq("deal_id", sow.deal_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = ((existing as { version?: number } | null)?.version ?? 0) + 1;

    const { id: _id, version: _v, ...rest } = sow;
    void _id; void _v;
    const { data: copy, error } = await supabaseAdmin
      .from("sow_drafts" as never)
      .insert({
        ...rest,
        title: `${sow.title} (copy)`,
        version: nextVersion,
        status: "draft",
        created_by: context.userId,
      } as never)
      .select("id, deal_id")
      .single();
    if (error) throw new Error(error.message);
    return copy as { id: string; deal_id: string };
  });
