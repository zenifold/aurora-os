import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAccountAccess(accountId: string, userId: string): Promise<string> {
  const { data: account } = await supabaseAdmin
    .from("client_accounts")
    .select("workspace_id")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) throw new Error("Account not found");
  const { data: member } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", account.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) throw new Error("Not a workspace member");
  return account.workspace_id;
}

// ---------- Health Score ----------
export const getClientHealthScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAccountAccess(data.accountId, context.userId);

    const [{ data: projects }, { data: deals }, { data: contracts }, { data: portalRows }] =
      await Promise.all([
        supabaseAdmin
          .from("projects")
          .select("id, health, is_archived")
          .eq("client_account_id", data.accountId),
        supabaseAdmin
          .from("deals")
          .select("id, status, value, won_at, updated_at")
          .eq("client_account_id", data.accountId),
        supabaseAdmin
          .from("contracts")
          .select("id, status, signed_date")
          .eq("client_account_id", data.accountId),
        supabaseAdmin
          .from("portal_activity_log")
          .select("created_at, activity_type, project_id, projects!inner(client_account_id)")
          .eq("projects.client_account_id", data.accountId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    // Delivery (40%)
    const active = (projects ?? []).filter((p) => !p.is_archived);
    const healthMap: Record<string, number> = { on_track: 100, at_risk: 50, off_track: 0, blocked: 0 };
    const delivery = active.length
      ? active.reduce((s, p) => s + (healthMap[p.health ?? "on_track"] ?? 75), 0) / active.length
      : 75;

    // Commercial (25%)
    const openDeals = (deals ?? []).filter((d) => d.status === "open");
    const wonDeals = (deals ?? []).filter((d) => d.status === "won");
    const lastWon = wonDeals
      .map((d) => (d.won_at ? new Date(d.won_at).getTime() : 0))
      .sort((a, b) => b - a)[0];
    const daysSinceWon = lastWon ? (Date.now() - lastWon) / 86_400_000 : 365;
    const commercial = Math.max(
      0,
      Math.min(100, 60 + (openDeals.length > 0 ? 25 : 0) + Math.max(0, 40 - daysSinceWon / 9)),
    );

    // Engagement (25%)
    const lastEvent = portalRows?.[0]?.created_at
      ? new Date(portalRows[0].created_at).getTime()
      : 0;
    const daysSinceEvent = lastEvent ? (Date.now() - lastEvent) / 86_400_000 : 60;
    const engagement = Math.max(0, Math.min(100, 100 - daysSinceEvent * 3));

    // Documents (10%)
    const allContracts = contracts ?? [];
    const signedContracts = allContracts.filter((c) => c.status === "signed").length;
    const documents = allContracts.length ? (signedContracts / allContracts.length) * 100 : 100;

    const score = Math.round(0.4 * delivery + 0.25 * commercial + 0.25 * engagement + 0.1 * documents);

    return {
      score,
      delivery: Math.round(delivery),
      commercial: Math.round(commercial),
      engagement: Math.round(engagement),
      documents: Math.round(documents),
      inputs: {
        active_projects: active.length,
        open_deals: openDeals.length,
        won_deals: wonDeals.length,
        days_since_won: Math.round(daysSinceWon),
        days_since_portal_event: Math.round(daysSinceEvent),
        signed_contracts: signedContracts,
        total_contracts: allContracts.length,
      },
    };
  });

// ---------- Portal Activity ----------
export const getClientPortalActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid(), limit: z.number().min(1).max(200).default(50) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAccountAccess(data.accountId, context.userId);

    const { data: activity } = await supabaseAdmin
      .from("portal_activity_log")
      .select("id, activity_type, created_at, metadata, project_id, projects!inner(client_account_id, name)")
      .eq("projects.client_account_id", data.accountId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    // Client-visible tasks for this account (joined through projects)
    const { data: projectIds } = await supabaseAdmin
      .from("projects")
      .select("id, name")
      .eq("client_account_id", data.accountId)
      .eq("is_archived", false);

    const ids = (projectIds ?? []).map((p) => p.id);
    const clientTasks: Array<{
      id: string;
      title: string;
      status: string | null;
      due_date: string | null;
      project_id: string;
      project_name: string;
    }> = [];
    // Note: tasks.client_visible column not present yet — surface portal-visible
    // tasks once the portal task model exists. Empty for now.
    void ids;

    return {
      activity: (activity ?? []).map((a) => ({
        id: a.id,
        activity_type: a.activity_type,
        created_at: a.created_at,
        metadata: a.metadata,
        project_id: a.project_id,
        project_name: (a as { projects?: { name?: string } }).projects?.name ?? "",
      })),
      tasks: clientTasks,
    };
  });

// ---------- Documents (smart aggregation) ----------
export const getClientDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAccountAccess(data.accountId, context.userId);

    const { data: projectRows } = await supabaseAdmin
      .from("projects")
      .select("id, name")
      .eq("client_account_id", data.accountId);
    const projectIds = (projectRows ?? []).map((p) => p.id);
    const projectMap = new Map((projectRows ?? []).map((p) => [p.id, p.name]));

    const [contractsRes, proposalsRes, projDocsRes, attachmentsRes] = await Promise.all([
      supabaseAdmin
        .from("contracts")
        .select("id, title, contract_type, status, created_at, project_id, file_url")
        .eq("client_account_id", data.accountId),
      projectIds.length
        ? supabaseAdmin
            .from("proposals")
            .select("id, title, status, created_at, deal_id, converted_project_id")
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string; status: string; created_at: string; deal_id: string | null; converted_project_id: string | null }> }),
      projectIds.length
        ? supabaseAdmin
            .from("project_documents")
            .select("id, name, document_type, signature_status, version, created_at, project_id")
            .in("project_id", projectIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string; document_type: string; signature_status: string; version: number; created_at: string; project_id: string }> }),
      projectIds.length
        ? supabaseAdmin
            .from("attachments")
            .select("id, file_name, mime_type, created_at, entity_type, entity_id")
            .eq("entity_type", "project")
            .in("entity_id", projectIds)
        : Promise.resolve({ data: [] as Array<{ id: string; file_name: string; mime_type: string | null; created_at: string; entity_type: string; entity_id: string }> }),
    ]);

    type Doc = {
      id: string;
      title: string;
      kind: "contract" | "proposal" | "project_document" | "attachment";
      source: "upload" | "ai_generated" | "portal_upload" | "system";
      status?: string | null;
      version?: number | null;
      created_at: string;
      project_id?: string | null;
      project_name?: string | null;
      ai_generated?: boolean;
    };
    const docs: Doc[] = [];

    for (const c of contractsRes.data ?? []) {
      docs.push({
        id: c.id,
        title: c.title,
        kind: "contract",
        source: "upload",
        status: c.status,
        created_at: c.created_at,
        project_id: c.project_id,
        project_name: c.project_id ? projectMap.get(c.project_id) ?? null : null,
      });
    }
    for (const p of proposalsRes.data ?? []) {
      docs.push({
        id: p.id,
        title: p.title,
        kind: "proposal",
        source: "ai_generated",
        status: p.status,
        created_at: p.created_at,
        ai_generated: true,
      });
    }
    for (const d of projDocsRes.data ?? []) {
      docs.push({
        id: d.id,
        title: d.name,
        kind: "project_document",
        source: "upload",
        status: d.signature_status,
        version: d.version,
        created_at: d.created_at,
        project_id: d.project_id,
        project_name: d.project_id ? projectMap.get(d.project_id) ?? null : null,
      });
    }
    for (const a of attachmentsRes.data ?? []) {
      docs.push({
        id: a.id,
        title: a.file_name,
        kind: "attachment",
        source: "upload",
        created_at: a.created_at,
        project_id: a.entity_id,
        project_name: projectMap.get(a.entity_id) ?? null,
      });
    }

    docs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { docs };
  });

// ---------- AI Artifacts ----------
const ArtifactKinds = ["draft", "summary", "risk", "communication", "other"] as const;
const ArtifactStatuses = ["draft", "reviewed", "applied", "archived"] as const;

export const listAiArtifacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAccountAccess(data.accountId, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("ai_artifacts")
      .select("*")
      .eq("client_account_id", data.accountId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setAiArtifactStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(ArtifactStatuses),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("ai_artifacts")
      .select("workspace_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", row.workspace_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) throw new Error("Not a workspace member");

    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "reviewed") {
      patch.reviewed_by = context.userId;
      patch.reviewed_at = new Date().toISOString();
    }
    const { error } = await supabaseAdmin.from("ai_artifacts").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createAiArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      accountId: z.string().uuid(),
      kind: z.enum(ArtifactKinds),
      title: z.string().min(1).max(255),
      content: z.record(z.string(), z.unknown()).default({}),
      project_id: z.string().uuid().nullable().optional(),
      deal_id: z.string().uuid().nullable().optional(),
      prompt: z.string().max(4000).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await assertAccountAccess(data.accountId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("ai_artifacts")
      .insert({
        workspace_id: workspaceId,
        client_account_id: data.accountId,
        project_id: data.project_id ?? null,
        deal_id: data.deal_id ?? null,
        kind: data.kind,
        title: data.title,
        content: data.content as never,
        prompt: data.prompt ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- Won Deal → Project bridge ----------
export const convertWonDealToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      dealId: z.string().uuid(),
      name: z.string().min(1).max(255),
      target_end_date: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select("id, workspace_id, client_account_id, title, handed_off_project_id")
      .eq("id", data.dealId)
      .maybeSingle();
    if (!deal) throw new Error("Deal not found");
    if (!deal.client_account_id) throw new Error("Deal must be linked to a client");
    if (deal.handed_off_project_id) {
      return { project_id: deal.handed_off_project_id, already: true };
    }
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", deal.workspace_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) throw new Error("Not a workspace member");

    const { data: account } = await supabaseAdmin
      .from("client_accounts")
      .select("name")
      .eq("id", deal.client_account_id)
      .single();

    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .insert({
        workspace_id: deal.workspace_id,
        name: data.name,
        client_account_id: deal.client_account_id,
        client_name: account?.name ?? null,
        is_client_project: true,
        target_end_date: data.target_end_date ?? null,
        lifecycle: "active",
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error || !project) throw new Error(error?.message ?? "Failed to create project");

    // Carry over deal requirements → project requirements
    const { data: dealReqs } = await supabaseAdmin
      .from("deal_requirements")
      .select("title, description, priority, status, owner_id")
      .eq("deal_id", data.dealId);
    if (dealReqs && dealReqs.length > 0) {
      await supabaseAdmin.from("project_requirements").insert(
        dealReqs.map((r) => ({
          workspace_id: deal.workspace_id,
          project_id: project.id,
          title: r.title,
          description: r.description,
          priority: r.priority,
          status: r.status,
          owner_id: r.owner_id,
          created_by: context.userId,
        })) as never,
      );
    }

    // Carry over deal dependencies → project dependencies
    const { data: dealDeps } = await supabaseAdmin
      .from("deal_dependencies")
      .select("title, description, type, status, due_date")
      .eq("deal_id", data.dealId);
    if (dealDeps && dealDeps.length > 0) {
      await supabaseAdmin.from("project_dependencies").insert(
        dealDeps.map((d) => ({
          workspace_id: deal.workspace_id,
          project_id: project.id,
          title: d.title,
          description: d.description,
          type: d.type,
          status: d.status,
          due_date: d.due_date,
          created_by: context.userId,
        })) as never,
      );
    }

    await supabaseAdmin
      .from("deals")
      .update({ handed_off_project_id: project.id, handed_off_at: new Date().toISOString() })
      .eq("id", data.dealId);

    return { project_id: project.id, already: false };
  });

