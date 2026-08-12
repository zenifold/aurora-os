import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  OPENROUTER_KEY_MISSING_ERROR,
  resolveOpenRouterKey,
} from "@/server/openrouter-key.server";

async function assertAccountMember(accountId: string, userId: string) {
  const { data: acc } = await supabaseAdmin
    .from("client_accounts")
    .select("id, workspace_id")
    .eq("id", accountId)
    .maybeSingle();
  if (!acc) throw new Error("Client not found");
  const { data: mem } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", acc.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!mem) throw new Error("Not a workspace member");
  return acc;
}

/* -------------------------------------------------------------------------
 * getClientHub — single round-trip for the comprehensive client dashboard.
 * Returns financial rollups, activity, notes, and derived health metrics.
 * ------------------------------------------------------------------------- */
export const getClientHub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ client_account_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const acc = await assertAccountMember(data.client_account_id, context.userId);

    // Projects under this client (used to scope financial children).
    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id, name, is_archived")
      .eq("client_account_id", data.client_account_id);
    const projectIds = (projects ?? []).map((p) => p.id);
    // Sentinel UUID so empty `in()` queries are valid (PostgREST + supabase-js).
    const pidFilter = projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"];

    const [
      { data: invoices },
      { data: timeLogs },
      { data: expenses },
      { data: contracts },
      { data: financials },
      { data: notesRows },
      { data: activity },
      { data: dealsActivity },
    ] = await Promise.all([
      supabaseAdmin
        .from("invoices")
        .select("id, invoice_number, status, issue_date, due_date, currency, total, amount_paid, project_id, sent_at, paid_at, created_at")
        .in("project_id", pidFilter)
        .order("issue_date", { ascending: false }),
      supabaseAdmin
        .from("time_logs")
        .select("hours, is_billable, hourly_rate_snapshot, log_date, project_id")
        .in("project_id", pidFilter),
      supabaseAdmin
        .from("expenses")
        .select("amount, currency, is_billable, status, project_id, incurred_on")
        .in("project_id", pidFilter),
      supabaseAdmin
        .from("contracts")
        .select("id, title, status, value, currency, effective_start, effective_end, signed_date, contract_type")
        .eq("client_account_id", data.client_account_id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("project_financials")
        .select("project_id, contract_value, currency, budget_amount, budget_hours, default_bill_rate")
        .in("project_id", pidFilter),
      supabaseAdmin
        .from("notes")
        .select("id, title, content, project_id, created_by, created_at, updated_at, is_pinned, note_type")
        .in("project_id", pidFilter)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(30),
      supabaseAdmin
        .from("activity_log")
        .select("id, actor_id, entity_type, entity_id, action, changes, created_at")
        .eq("workspace_id", acc.workspace_id)
        .or(`entity_id.eq.${data.client_account_id}${projectIds.length ? "," + projectIds.map((id) => `entity_id.eq.${id}`).join(",") : ""}`)
        .order("created_at", { ascending: false })
        .limit(50),
      // Deal activities for context
      supabaseAdmin
        .from("deal_activities")
        .select("id, deal_id, activity_type, content, created_at, author_id, deals!inner(client_account_id)")

        .eq("deals.client_account_id", data.client_account_id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);


    // --- Financial rollups ---
    const currency = (invoices?.[0]?.currency) || (contracts?.[0]?.currency) || "USD";
    const now = new Date();
    let invoiced = 0;
    let paid = 0;
    let outstanding = 0;
    let overdue = 0;
    let overdueCount = 0;
    for (const inv of invoices ?? []) {
      const total = Number(inv.total) || 0;
      const ap = Number(inv.amount_paid) || 0;
      invoiced += total;
      paid += ap;
      const balance = total - ap;
      if (balance > 0 && inv.status !== "paid" && inv.status !== "void") {
        outstanding += balance;
        if (inv.due_date && new Date(inv.due_date) < now) {
          overdue += balance;
          overdueCount += 1;
        }
      }
    }

    let totalHours = 0;
    let billableHours = 0;
    let timeRevenue = 0;
    for (const tl of timeLogs ?? []) {
      const h = Number(tl.hours) || 0;
      totalHours += h;
      if (tl.is_billable) {
        billableHours += h;
        timeRevenue += h * (Number(tl.hourly_rate_snapshot) || 0);
      }
    }

    let expenseTotal = 0;
    let billableExpenses = 0;
    for (const e of expenses ?? []) {
      const amt = Number(e.amount) || 0;
      expenseTotal += amt;
      if (e.is_billable) billableExpenses += amt;
    }

    const activeContracts = (contracts ?? []).filter((c) => c.status === "active" || c.status === "signed");
    const contractTotal = (contracts ?? []).reduce((s, c) => s + (Number(c.value) || 0), 0);
    const activeContractValue = activeContracts.reduce((s, c) => s + (Number(c.value) || 0), 0);
    const budgetTotal = (financials ?? []).reduce((s, f) => s + (Number(f.budget_amount) || 0), 0);
    const budgetHoursTotal = (financials ?? []).reduce((s, f) => s + (Number(f.budget_hours) || 0), 0);

    // --- Health & engagement signals ---
    const lastActivityAt = (activity ?? [])[0]?.created_at ?? null;
    const lastNoteAt = (notesRows ?? [])[0]?.updated_at ?? null;
    const lastDealActivityAt = (dealsActivity ?? [])[0]?.created_at ?? null;
    const lastTouches = [lastActivityAt, lastNoteAt, lastDealActivityAt].filter(Boolean) as string[];
    const lastTouchAt = lastTouches.length ? lastTouches.sort().reverse()[0] : null;
    const daysSinceTouch = lastTouchAt
      ? Math.floor((now.getTime() - new Date(lastTouchAt).getTime()) / 86400000)
      : null;

    // Resolve actor names for activity feed
    const actorIds = Array.from(
      new Set(
        [
          ...(activity ?? []).map((a) => a.actor_id),
          ...(dealsActivity ?? []).map((a) => a.author_id),
          ...(notesRows ?? []).map((n) => n.created_by),
        ].filter((x): x is string => !!x),
      ),
    );
    const { data: actorProfiles } = actorIds.length
      ? await supabaseAdmin.from("profiles").select("id, display_name, avatar_url").in("id", actorIds)
      : { data: [] as Array<{ id: string; display_name: string | null; avatar_url: string | null }> };
    const actorMap = new Map(
      (actorProfiles ?? []).map((p) => [p.id, { id: p.id, name: p.display_name, avatar_url: p.avatar_url }]),
    );
    const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));


    return {
      financials: {
        currency,
        invoiced,
        paid,
        outstanding,
        overdue,
        overdueCount,
        invoiceCount: invoices?.length ?? 0,
        totalHours,
        billableHours,
        timeRevenue,
        expenseTotal,
        billableExpenses,
        contractTotal,
        activeContractValue,
        activeContractCount: activeContracts.length,
        budgetTotal,
        budgetHoursTotal,
        budgetUtilization: budgetTotal > 0 ? Math.min(100, Math.round(((timeRevenue + billableExpenses) / budgetTotal) * 100)) : null,
        hoursUtilization: budgetHoursTotal > 0 ? Math.min(100, Math.round((totalHours / budgetHoursTotal) * 100)) : null,
      },
      invoices: (invoices ?? []).map((i) => ({
        ...i,
        project_name: projectMap.get(i.project_id) ?? null,
      })),
      contracts: contracts ?? [],
      notes: (notesRows ?? []).map((n) => ({
        ...n,
        actor: actorMap.get(n.created_by) ?? null,
        project_name: n.project_id ? projectMap.get(n.project_id) ?? null : null,
      })),
      activity: [
        ...(activity ?? []).map((a) => ({
          kind: "activity" as const,
          id: a.id,
          at: a.created_at,
          actor: a.actor_id ? actorMap.get(a.actor_id) ?? null : null,
          action: a.action,
          entity_type: a.entity_type,
          entity_id: a.entity_id,
          project_name: projectMap.get(a.entity_id) ?? null,
          changes: a.changes,
          subject: null as string | null,
          body: null as string | null,
        })),
        ...(dealsActivity ?? []).map((a) => ({
          kind: "deal_activity" as const,
          id: a.id,
          at: a.created_at,
          actor: a.author_id ? actorMap.get(a.author_id) ?? null : null,
          action: a.activity_type,
          subject: null as string | null,
          body: a.content as string | null,
          deal_id: a.deal_id,
          entity_type: "deal" as const,
          entity_id: a.deal_id,
          project_name: null as string | null,
          changes: null,
        })),
      ]
        .sort((x, y) => (y.at ?? "").localeCompare(x.at ?? ""))
        .slice(0, 50),

      health: {
        lastTouchAt,
        daysSinceTouch,
        activeProjectCount: (projects ?? []).filter((p) => !p.is_archived).length,
      },
    };
  });

/* -------------------------------------------------------------------------
 * generateClientSummary — AI brief: "what's happening with this client".
 * ------------------------------------------------------------------------- */
export const generateClientSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ client_account_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const acc = await assertAccountMember(data.client_account_id, context.userId);

    const { data: account } = await supabaseAdmin
      .from("client_accounts")
      .select("name, industry, status, health, tier, notes")
      .eq("id", data.client_account_id)
      .single();

    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id, name, phase, health, target_end_date, is_archived")
      .eq("client_account_id", data.client_account_id);

    const { data: deals } = await supabaseAdmin
      .from("deals")
      .select("title, status, value, currency, expected_close_date")
      .eq("client_account_id", data.client_account_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: recentActivity } = await supabaseAdmin
      .from("activity_log")
      .select("action, entity_type, created_at")
      .eq("workspace_id", acc.workspace_id)
      .eq("entity_id", data.client_account_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const apiKey = await resolveOpenRouterKey(acc.workspace_id);
    if (!apiKey) {
      return { ok: false as const, error: OPENROUTER_KEY_MISSING_ERROR };
    }

    const ctx = {
      account,
      projects: projects ?? [],
      deals: deals ?? [],
      recent_activity: recentActivity ?? [],
    };

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a sharp account director for a creative/consulting agency. Given structured client data, produce a JSON object with: { headline (max 12 words: the one-line state of this account), bullets (3-5 short bullets covering momentum, risks, opportunities), next_action (one concrete next step the account owner should take this week) }. Be specific, no fluff, no preamble.",
          },
          { role: "user", content: JSON.stringify(ctx) },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) return { ok: false as const, error: "AI rate limit — try again shortly." };
    if (res.status === 402) return { ok: false as const, error: "AI credits exhausted. Add credits in Settings → Usage." };
    if (!res.ok) {
      const t = await res.text();
      return { ok: false as const, error: `AI gateway ${res.status}: ${t.slice(0, 200)}` };
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content ?? "{}";
    try {
      const json = JSON.parse(content) as {
        headline?: string;
        bullets?: string[];
        next_action?: string;
      };
      return { ok: true as const, summary: json, generated_at: new Date().toISOString() };
    } catch {
      return { ok: false as const, error: "AI returned invalid JSON" };
    }
  });

/* -------------------------------------------------------------------------
 * Inline updates for account fields (status, health, tier, owner, website…).
 * ------------------------------------------------------------------------- */
export const updateClientAccountFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["prospect", "active", "paused", "churned"]).optional(),
        health: z.enum(["green", "yellow", "red", "unknown"]).optional(),
        tier: z.enum(["standard", "premium", "strategic"]).optional(),
        account_owner_id: z.string().uuid().nullable().optional(),
        industry: z.string().max(100).nullable().optional(),
        website: z.string().url().nullable().or(z.literal("")).optional(),
        billing_email: z.string().email().nullable().or(z.literal("")).optional(),
        notes: z.string().max(5000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAccountMember(data.id, context.userId);
    const { id, ...patch } = data;
    if (patch.website === "") patch.website = null;
    if (patch.billing_email === "") patch.billing_email = null;
    const { error } = await supabaseAdmin
      .from("client_accounts")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------------------------------------------------
 * Contact CRUD on a client account.
 * ------------------------------------------------------------------------- */
export const addClientContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        client_account_id: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().optional().nullable().or(z.literal("")),
        phone: z.string().trim().max(40).optional().nullable(),
        title: z.string().trim().max(120).optional().nullable(),
        department: z.string().trim().max(80).optional().nullable(),
        role: z.string().trim().max(40).default("day_to_day"),
        is_primary: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const acc = await assertAccountMember(data.client_account_id, context.userId);

    const { data: account } = await supabaseAdmin
      .from("client_accounts")
      .select("name")
      .eq("id", data.client_account_id)
      .single();

    const { data: contact, error: cErr } = await supabaseAdmin
      .from("contacts")
      .insert({
        workspace_id: acc.workspace_id,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        title: data.title || null,
        company: account?.name ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);

    if (data.is_primary) {
      await supabaseAdmin
        .from("client_account_contacts")
        .update({ is_primary: false })
        .eq("client_account_id", data.client_account_id);
    }

    await supabaseAdmin.from("client_account_contacts").insert({
      client_account_id: data.client_account_id,
      contact_id: contact.id,
      role: data.is_primary ? "primary" : data.role,
      is_primary: data.is_primary,
      department: data.department || null,
    });

    if (data.is_primary) {
      await supabaseAdmin
        .from("client_accounts")
        .update({ primary_contact_id: contact.id })
        .eq("id", data.client_account_id);
    }
    return { ok: true, contact_id: contact.id };
  });

export const removeClientContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ client_account_contact_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: link } = await supabaseAdmin
      .from("client_account_contacts")
      .select("id, client_account_id")
      .eq("id", data.client_account_contact_id)
      .single();
    if (!link) throw new Error("Not found");
    await assertAccountMember(link.client_account_id, context.userId);
    const { error } = await supabaseAdmin
      .from("client_account_contacts")
      .delete()
      .eq("id", data.client_account_contact_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPrimaryClientContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        client_account_contact_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: link } = await supabaseAdmin
      .from("client_account_contacts")
      .select("id, client_account_id, contact_id")
      .eq("id", data.client_account_contact_id)
      .single();
    if (!link) throw new Error("Not found");
    await assertAccountMember(link.client_account_id, context.userId);

    await supabaseAdmin
      .from("client_account_contacts")
      .update({ is_primary: false, role: "day_to_day" })
      .eq("client_account_id", link.client_account_id);
    await supabaseAdmin
      .from("client_account_contacts")
      .update({ is_primary: true, role: "primary" })
      .eq("id", data.client_account_contact_id);
    await supabaseAdmin
      .from("client_accounts")
      .update({ primary_contact_id: link.contact_id })
      .eq("id", link.client_account_id);

    return { ok: true };
  });

/* -------------------------------------------------------------------------
 * Quick-note: adds a note attached to the client's first non-archived project
 * (the natural place for "client-level" notes in the current schema).
 * ------------------------------------------------------------------------- */
export const addClientQuickNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        client_account_id: z.string().uuid(),
        title: z.string().trim().max(200).optional().nullable(),
        text: z.string().trim().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const acc = await assertAccountMember(data.client_account_id, context.userId);

    const { data: proj } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("client_account_id", data.client_account_id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!proj) {
      throw new Error("Create a project for this client before adding notes.");
    }

    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: data.text }],
        },
      ],
    };

    const { data: note, error } = await supabaseAdmin
      .from("notes")
      .insert({
        workspace_id: acc.workspace_id,
        project_id: proj.id,
        created_by: context.userId,
        title: data.title || null,
        content,
        note_type: "client",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, note_id: note.id };
  });
