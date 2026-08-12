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

export const listClientAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    const { data: accounts, error } = await supabaseAdmin
      .from("client_accounts")
      .select("*")
      .eq("workspace_id", data.workspace_id)
      .eq("kind", "client")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);


    const ids = (accounts ?? []).map((a) => a.id);
    if (!ids.length) {
      return (accounts ?? []).map((a) => ({
        ...a,
        project_count: 0,
        active_engagement_count: 0,
        open_deal_count: 0,
        open_deal_value: 0,
        contract_value: 0,
        current_phase_name: null as string | null,
        current_phase_color: null as string | null,
        lifecycle: "lead" as const,
      }));
    }

    const [{ data: projs }, { data: deals }, { data: contracts }, { data: phases }] =
      await Promise.all([
        supabaseAdmin
          .from("projects")
          .select("id, client_account_id, is_archived, current_phase_id")
          .in("client_account_id", ids),
        supabaseAdmin
          .from("deals")
          .select("id, client_account_id, status, value")
          .in("client_account_id", ids),
        supabaseAdmin
          .from("contracts")
          .select("client_account_id, value, status")
          .in("client_account_id", ids),
        supabaseAdmin
          .from("engagement_phases")
          .select("id, project_id, name, color, key, status")
          .in("project_id", []),
      ]);

    // Now load active phases for the projects we found
    const projectIds = (projs ?? []).map((p) => p.id);
    const { data: activePhases } = projectIds.length
      ? await supabaseAdmin
          .from("engagement_phases")
          .select("project_id, name, color, key, status")
          .in("project_id", projectIds)
          .eq("status", "active")
      : { data: [] as Array<{ project_id: string; name: string; color: string | null; key: string; status: string }> };
    void phases;

    return (accounts ?? []).map((a) => {
      const accProjects = (projs ?? []).filter((p) => p.client_account_id === a.id);
      const activeProjects = accProjects.filter((p) => !p.is_archived);
      const accDeals = (deals ?? []).filter((d) => d.client_account_id === a.id);
      const openDeals = accDeals.filter((d) => d.status === "open");
      const wonDeals = accDeals.filter((d) => d.status === "won");
      const accContracts = (contracts ?? []).filter((c) => c.client_account_id === a.id);
      const accActivePhases = (activePhases ?? []).filter((p) =>
        accProjects.some((proj) => proj.id === p.project_id)
      );
      const currentPhase = accActivePhases[0] ?? null;

      // Derive lifecycle stage from observable state
      let lifecycle: "lead" | "pre_sales" | "won" | "onboarding" | "active" | "churned" = "lead";
      if (a.status === "churned") lifecycle = "churned";
      else if (currentPhase?.key === "onboarding" || accActivePhases.some((p) => p.key === "onboarding"))
        lifecycle = "onboarding";
      else if (activeProjects.length) lifecycle = "active";
      else if (wonDeals.length) lifecycle = "won";
      else if (openDeals.length) lifecycle = "pre_sales";

      return {
        ...a,
        project_count: activeProjects.length,
        active_engagement_count: activeProjects.length,
        open_deal_count: openDeals.length,
        open_deal_value: openDeals.reduce((s, d) => s + (Number(d.value) || 0), 0),
        contract_value: accContracts.reduce((s, c) => s + (Number(c.value) || 0), 0),
        current_phase_name: currentPhase?.name ?? null,
        current_phase_color: currentPhase?.color ?? null,
        lifecycle,
      };
    });
  });

export const getClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: account, error } = await supabaseAdmin
      .from("client_accounts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    await assertMember(account.workspace_id, context.userId);

    const [
      { data: projects },
      { data: onboardings },
      { data: contacts },
      { data: deals },
      { data: contracts },
    ] = await Promise.all([
      supabaseAdmin
        .from("projects")
        .select("id, name, phase, health, target_end_date, is_archived, current_phase_id, lifecycle")
        .eq("client_account_id", data.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("onboardings")
        .select("id, name, stage, progress, target_go_live, started_at")
        .eq("client_account_id", data.id)
        .order("started_at", { ascending: false }),
      supabaseAdmin
        .from("client_account_contacts")
        .select("id, role, is_primary, department, contact:contacts(id, name, email, phone, title)")
        .eq("client_account_id", data.id),
      supabaseAdmin
        .from("deals")
        .select("id, title, status, value, currency, stage_id, handed_off_project_id, expected_close_date, description, created_at, source, deal_contacts(id, role, is_primary, contact:contacts(id, name, email, title))")
        .eq("client_account_id", data.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("contracts")
        .select("*")
        .eq("client_account_id", data.id)
        .order("created_at", { ascending: false }),
    ]);

    const { data: stages } = await supabaseAdmin
      .from("deal_stages")
      .select("id, name, color, stage_type")
      .eq("workspace_id", account.workspace_id);

    // Cross-link: the delivery folder for this client (if auto-provisioned
    // or backfilled). Lets the CRM page deep-link into the workspace.
    let folder: { id: string; name: string } | null = null;
    if (account.default_folder_id) {
      const { data: f } = await supabaseAdmin
        .from("folders")
        .select("id, name, is_archived")
        .eq("id", account.default_folder_id)
        .maybeSingle();
      if (f && !f.is_archived) folder = { id: f.id, name: f.name };
    }

    return {
      account,
      projects: projects ?? [],
      onboardings: onboardings ?? [],
      contacts: contacts ?? [],
      deals: deals ?? [],
      contracts: contracts ?? [],
      stages: stages ?? [],
      folder,
    };
  });

export const upsertClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        workspace_id: z.string().uuid(),
        name: z.string().min(1).max(200),
        legal_name: z.string().max(200).optional().nullable(),
        industry: z.string().max(100).optional().nullable(),
        size: z.string().max(50).optional().nullable(),
        website: z.string().url().optional().nullable().or(z.literal("")),
        billing_email: z.string().email().optional().nullable().or(z.literal("")),
        tier: z.enum(["standard", "premium", "strategic"]).optional(),
        health: z.enum(["green", "yellow", "red", "unknown"]).optional(),
        status: z.enum(["prospect", "active", "paused", "churned"]).optional(),
        notes: z.string().max(5000).optional().nullable(),
        account_owner_id: z.string().uuid().optional().nullable(),
        is_private: z.boolean().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    const payload = {
      ...data,
      website: data.website || null,
      billing_email: data.billing_email || null,
      created_by: data.id ? undefined : context.userId,
    };
    const { data: row, error } = await supabaseAdmin
      .from("client_accounts")
      .upsert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const setClientAccountPrivacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), is_private: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: acc } = await supabaseAdmin
      .from("client_accounts")
      .select("workspace_id")
      .eq("id", data.id)
      .single();
    if (!acc) throw new Error("Not found");
    await assertMember(acc.workspace_id, context.userId);
    const { error } = await supabaseAdmin
      .from("client_accounts")
      .update({ is_private: data.is_private })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: acc } = await supabaseAdmin
      .from("client_accounts")
      .select("workspace_id")
      .eq("id", data.id)
      .single();
    if (!acc) throw new Error("Not found");
    await assertMember(acc.workspace_id, context.userId);
    const { error } = await supabaseAdmin.from("client_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Lead-source vocabulary (kept in code; users can still type a custom one).
// ---------------------------------------------------------------------------
export const LEAD_SOURCES = [
  { value: "cold_outreach", label: "Cold outreach" },
  { value: "conference_event", label: "Conference / event" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "website_form", label: "Website form" },
  { value: "referral", label: "Referral" },
  { value: "inbound_email", label: "Inbound email" },
  { value: "partner", label: "Partner / channel" },
  { value: "existing_customer", label: "Existing customer" },
  { value: "other", label: "Other" },
] as const;

/**
 * One-shot intake flow used by the New Client wizard.
 * Creates a client_account and, when provided, a primary contact and an
 * initial deal at the chosen stage in a single transaction-ish call.
 */
export const createClientIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        // Entry mode — what did the user actually know first?
        intake_mode: z.enum(["account_first", "contact_first"]).default("account_first"),
        // Account basics
        name: z.string().trim().min(1).max(200),
        legal_name: z.string().trim().max(200).optional().nullable(),
        industry: z.string().trim().max(100).optional().nullable(),
        size: z.string().trim().max(50).optional().nullable(),
        website: z.string().trim().url().or(z.literal("")).optional().nullable(),
        billing_email: z.string().trim().email().or(z.literal("")).optional().nullable(),
        tier: z.enum(["standard", "premium", "strategic"]).default("standard"),
        notes: z.string().max(5000).optional().nullable(),
        tags: z.array(z.string().trim().max(40)).max(20).optional(),
        account_owner_id: z.string().uuid().optional().nullable(),
        // Source / first touch
        lead_source: z.string().trim().max(60).optional().nullable(),
        source_detail: z.string().trim().max(500).optional().nullable(),
        first_touch_at: z.string().datetime().optional().nullable(),
        // Stakeholders (0..n) — first one is primary unless flagged otherwise
        contacts: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(120),
              email: z.string().trim().email().or(z.literal("")).optional().nullable(),
              phone: z.string().trim().max(40).optional().nullable(),
              title: z.string().trim().max(120).optional().nullable(),
              department: z.string().trim().max(80).optional().nullable(),
              account_role: z.string().trim().max(40).default("day_to_day"),
              deal_role: z
                .enum([
                  "champion",
                  "decision_maker",
                  "influencer",
                  "end_user",
                  "blocker",
                  "legal",
                  "finance",
                  "technical",
                  "other",
                ])
                .default("other"),
              is_primary: z.boolean().default(false),
              link_to_deal: z.boolean().default(true),
            }),
          )
          .max(20)
          .optional(),
        // Initial opportunity (optional)
        deal: z
          .object({
            title: z.string().trim().min(1).max(200),
            stage_id: z.string().uuid(),
            value: z.number().nonnegative().max(1_000_000_000).optional().nullable(),
            currency: z.string().trim().length(3).optional().nullable(),
            expected_close_date: z.string().date().optional().nullable(),
            description: z.string().max(2000).optional().nullable(),
          })
          .optional()
          .nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);

    // 1. Insert account
    const { data: account, error: accErr } = await supabaseAdmin
      .from("client_accounts")
      .insert({
        workspace_id: data.workspace_id,
        name: data.name,
        legal_name: data.legal_name || null,
        industry: data.industry || null,
        size: data.size || null,
        website: data.website || null,
        billing_email: data.billing_email || null,
        tier: data.tier,
        notes: data.notes || null,
        tags: data.tags ?? [],
        account_owner_id: data.account_owner_id || context.userId,
        lead_source: data.lead_source || null,
        source_detail: data.source_detail || null,
        first_touch_at: data.first_touch_at || new Date().toISOString(),
        status: "prospect",
        created_by: context.userId,
      })
      .select()
      .single();
    if (accErr) throw new Error(accErr.message);

    // 2. Stakeholders — insert all contacts, link to account, mark a primary
    const contactRows: Array<{ id: string; deal_role: string; link_to_deal: boolean; is_primary: boolean }> = [];
    const contactList = data.contacts ?? [];
    let primaryContactId: string | null = null;
    let primaryIdx = contactList.findIndex((c) => c.is_primary);
    if (primaryIdx === -1 && contactList.length > 0) primaryIdx = 0;

    for (let i = 0; i < contactList.length; i++) {
      const c = contactList[i];
      const { data: created, error: cErr } = await supabaseAdmin
        .from("contacts")
        .insert({
          workspace_id: data.workspace_id,
          name: c.name,
          email: c.email || null,
          phone: c.phone || null,
          title: c.title || null,
          company: data.name,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);

      const isPrimary = i === primaryIdx;
      if (isPrimary) primaryContactId = created.id;

      await supabaseAdmin.from("client_account_contacts").insert({
        client_account_id: account.id,
        contact_id: created.id,
        role: isPrimary ? "primary" : c.account_role || "day_to_day",
        is_primary: isPrimary,
        department: c.department || null,
      });

      contactRows.push({
        id: created.id,
        deal_role: c.deal_role,
        link_to_deal: c.link_to_deal,
        is_primary: isPrimary,
      });
    }

    if (primaryContactId) {
      await supabaseAdmin
        .from("client_accounts")
        .update({ primary_contact_id: primaryContactId })
        .eq("id", account.id);
    }

    // 3. Optional initial deal + deal_contacts links
    let dealId: string | null = null;
    if (data.deal) {
      const { data: d, error: dErr } = await supabaseAdmin
        .from("deals")
        .insert({
          workspace_id: data.workspace_id,
          client_account_id: account.id,
          contact_id: primaryContactId,
          stage_id: data.deal.stage_id,
          title: data.deal.title,
          description: data.deal.description || null,
          value: data.deal.value ?? null,
          currency: data.deal.currency || "USD",
          expected_close_date: data.deal.expected_close_date || null,
          source: data.lead_source || null,
          owner_id: data.account_owner_id || context.userId,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (dErr) throw new Error(dErr.message);
      dealId = d.id;

      // Link stakeholders that should ride along on the deal
      const dealLinks = contactRows
        .filter((c) => c.link_to_deal)
        .map((c) => ({
          deal_id: dealId!,
          contact_id: c.id,
          role: c.deal_role,
          is_primary: c.is_primary,
        }));
      if (dealLinks.length > 0) {
        await supabaseAdmin.from("deal_contacts").insert(dealLinks);
      }
    }

    // 4. Auto-provision a delivery folder for this client so the CRM record
    //    and the workspace folder are the same thing viewed two ways.
    let folderId: string | null = null;
    try {
      const { data: f, error: fErr } = await supabaseAdmin
        .from("folders")
        .insert({
          workspace_id: data.workspace_id,
          name: data.name,
          folder_type: "client",
          client_company: data.name,
          client_email: data.billing_email || null,
          client_account_id: account.id,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (!fErr && f) {
        folderId = f.id;
        await supabaseAdmin
          .from("client_accounts")
          .update({ default_folder_id: f.id })
          .eq("id", account.id);
      }
    } catch {
      // Non-fatal: account exists even if folder provisioning fails.
    }

    return {
      account,
      contact_id: primaryContactId,
      contact_ids: contactRows.map((c) => c.id),
      deal_id: dealId,
      folder_id: folderId,
    };
  });

// ---------------------------------------------------------------------------
// Sales-stage (deal_stages) administration — used by the customizable
// pipeline settings page and the new-client wizard.
// ---------------------------------------------------------------------------
export const listDealStages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    let { data: stages, error } = await supabaseAdmin
      .from("deal_stages")
      .select("*")
      .eq("workspace_id", data.workspace_id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    // Auto-seed defaults on first read so the wizard always has stages.
    if (!stages || stages.length === 0) {
      await supabaseAdmin.rpc("seed_default_deal_stages", { _workspace_id: data.workspace_id });
      const reread = await supabaseAdmin
        .from("deal_stages")
        .select("*")
        .eq("workspace_id", data.workspace_id)
        .order("order_index", { ascending: true });
      stages = reread.data;
    }
    return stages ?? [];
  });

export const upsertDealStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        workspace_id: z.string().uuid(),
        name: z.string().trim().min(1).max(60),
        color: z
          .string()
          .trim()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#6366f1"),
        stage_type: z.enum(["open", "won", "lost"]).default("open"),
        default_probability: z.number().int().min(0).max(100).default(25),
        order_index: z.number().int().min(0).max(999).optional(),
        auto_create_engagement: z.boolean().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    let orderIndex = data.order_index;
    if (orderIndex === undefined) {
      const { data: max } = await supabaseAdmin
        .from("deal_stages")
        .select("order_index")
        .eq("workspace_id", data.workspace_id)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      orderIndex = (max?.order_index ?? -1) + 1;
    }
    const { data: row, error } = await supabaseAdmin
      .from("deal_stages")
      .upsert({
        id: data.id,
        workspace_id: data.workspace_id,
        name: data.name,
        color: data.color,
        stage_type: data.stage_type,
        default_probability: data.default_probability,
        order_index: orderIndex,
        auto_create_engagement: data.auto_create_engagement ?? true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const reorderDealStages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        ordered_ids: z.array(z.string().uuid()).min(1).max(50),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    await Promise.all(
      data.ordered_ids.map((id, i) =>
        supabaseAdmin
          .from("deal_stages")
          .update({ order_index: i })
          .eq("id", id)
          .eq("workspace_id", data.workspace_id)
      )
    );
    return { ok: true };
  });

export const deleteDealStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), workspace_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    const { count } = await supabaseAdmin
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("stage_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error("Stage is in use by deals. Move them to another stage first.");
    }
    const { error } = await supabaseAdmin
      .from("deal_stages")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspace_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Phase 3: bi-directional folder ↔ client linking for legacy/unmatched folders
// ---------------------------------------------------------------------------
export const linkFolderToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        folder_id: z.string().uuid(),
        client_account_id: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Verify folder + workspace membership
    const { data: folder, error: fErr } = await supabaseAdmin
      .from("folders")
      .select("id, workspace_id, client_account_id")
      .eq("id", data.folder_id)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!folder) throw new Error("Folder not found");
    await assertMember(folder.workspace_id, context.userId);

    // If unlinking
    if (!data.client_account_id) {
      const { error } = await supabaseAdmin
        .from("folders")
        .update({ client_account_id: null })
        .eq("id", data.folder_id);
      if (error) throw new Error(error.message);
      // Clear reciprocal pointer if it pointed here
      await supabaseAdmin
        .from("client_accounts")
        .update({ default_folder_id: null })
        .eq("default_folder_id", data.folder_id);
      return { ok: true };
    }

    // Verify target client is in the same workspace
    const { data: acc, error: aErr } = await supabaseAdmin
      .from("client_accounts")
      .select("id, workspace_id, default_folder_id")
      .eq("id", data.client_account_id)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!acc || acc.workspace_id !== folder.workspace_id) {
      throw new Error("Client not found in this workspace");
    }

    const { error: uErr } = await supabaseAdmin
      .from("folders")
      .update({ client_account_id: data.client_account_id })
      .eq("id", data.folder_id);
    if (uErr) throw new Error(uErr.message);

    // Set reciprocal default_folder_id only if the client doesn't already have one
    if (!acc.default_folder_id) {
      await supabaseAdmin
        .from("client_accounts")
        .update({ default_folder_id: data.folder_id })
        .eq("id", data.client_account_id);
    }
    return { ok: true };
  });
