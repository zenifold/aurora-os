import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runScopeChecklistGeneration } from "@/lib/scope-checklist.server";
import {
  OPENROUTER_KEY_MISSING_ERROR,
  resolveOpenRouterKey,
} from "@/server/openrouter-key.server";

async function assertMember(workspaceId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Not a workspace member");
}

const STAGE_ORDER = [
  "discovery",
  "sow_draft",
  "sow_internal_review",
  "sow_customer_review",
  "signed",
  "plan_draft",
  "plan_review",
  "executing",
  "delivered",
] as const;
export type HandoverStage = (typeof STAGE_ORDER)[number];

/** Get (or create) the handover row for a deal. */
export const ensureHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select("id, workspace_id")
      .eq("id", data.deal_id)
      .single();
    if (!deal) throw new Error("Deal not found");
    await assertMember(deal.workspace_id, context.userId);

    const { data: existing } = await supabaseAdmin
      .from("engagement_handovers" as never)
      .select("*")
      .eq("deal_id", data.deal_id)
      .maybeSingle();
    if (existing) return existing;

    const { data: created, error } = await supabaseAdmin
      .from("engagement_handovers" as never)
      .insert({
        workspace_id: deal.workspace_id,
        deal_id: deal.id,
        stage: "discovery",
        pending_approver_role: "business_analyst",
        created_by: context.userId,
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const getHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select("workspace_id")
      .eq("id", data.deal_id)
      .single();
    if (!deal) return null;
    await assertMember(deal.workspace_id, context.userId);
    const { data: handover } = await supabaseAdmin
      .from("engagement_handovers" as never)
      .select("*")
      .eq("deal_id", data.deal_id)
      .maybeSingle();
    const { data: brief } = await supabaseAdmin
      .from("discovery_briefs" as never)
      .select("*")
      .eq("deal_id", data.deal_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { handover, brief };
  });

/** Advance the handover to a new stage and append to gate_history. */
export const advanceHandoverStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        deal_id: z.string().uuid(),
        to_stage: z.enum(STAGE_ORDER),
        note: z.string().max(2000).optional(),
        pending_approver_role: z.string().max(80).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select("workspace_id")
      .eq("id", data.deal_id)
      .single();
    if (!deal) throw new Error("Deal not found");
    await assertMember(deal.workspace_id, context.userId);

    const { data: h } = await supabaseAdmin
      .from("engagement_handovers" as never)
      .select("id, stage, gate_history")
      .eq("deal_id", data.deal_id)
      .single();
    if (!h) throw new Error("No handover for deal");
    const row = h as { id: string; stage: HandoverStage; gate_history: unknown[] };

    const entry = {
      from: row.stage,
      to: data.to_stage,
      at: new Date().toISOString(),
      by: context.userId,
      note: data.note ?? null,
    };
    const history = Array.isArray(row.gate_history) ? row.gate_history : [];

    const { error } = await supabaseAdmin
      .from("engagement_handovers" as never)
      .update({
        stage: data.to_stage,
        gate_history: [...history, entry],
        pending_approver_role: data.pending_approver_role ?? null,
      } as never)
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Agentically draft a discovery brief from the deal context. */
export const draftDiscoveryBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        deal_id: z.string().uuid(),
        extra_context: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select(
        "id, workspace_id, title, description, value, currency, expected_close_date, contact_id, client_account_id",
      )
      .eq("id", data.deal_id)
      .single();
    if (!deal) throw new Error("Deal not found");
    await assertMember(deal.workspace_id, context.userId);

    // Gather context: contact, recent activities, account, AND any sales documents that have been scanned.
    const [{ data: contact }, { data: activities }, { data: account }, { data: salesDocs }] =
      await Promise.all([
        deal.contact_id
          ? supabaseAdmin
              .from("contacts")
              .select("name, title, company, email")
              .eq("id", deal.contact_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseAdmin
          .from("deal_activities")
          .select("activity_type, content, created_at")
          .eq("deal_id", deal.id)
          .order("created_at", { ascending: false })
          .limit(25),
        deal.client_account_id
          ? supabaseAdmin
              .from("client_accounts")
              .select("name, industry, website")
              .eq("id", deal.client_account_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseAdmin
          .from("sales_documents" as never)
          .select("id, name, document_type, ai_summary, ai_extracted, raw_text, description")
          .eq("deal_id", deal.id),
      ]);

    const docs = (salesDocs ?? []) as Array<{
      id: string;
      name: string;
      document_type: string;
      ai_summary: string | null;
      ai_extracted: Record<string, unknown> | null;
      raw_text: string | null;
      description: string | null;
    }>;

    const apiKey = await resolveOpenRouterKey(deal.workspace_id);
    if (!apiKey) return { ok: false as const, error: OPENROUTER_KEY_MISSING_ERROR };

    const system = `You are a senior business analyst preparing a discovery brief for a new client engagement.
You will receive deal context AND a set of sales-stage documents that have already been scanned and extracted.
Each document has an id and a set of snippets (exact quotes from that document).
Synthesize ALL of it into one cohesive brief. Return STRICT JSON only, matching:
{
  "business_goals": "string",
  "target_users": "string",
  "scope_summary": "string",
  "platforms": ["ios","android","web","macos","windows","api","other"],
  "integrations": ["..."],
  "key_features": [{"name":"...","description":"..."}],
  "technical_requirements": "string",
  "non_functional_requirements": "string",
  "compliance_requirements": "string",
  "constraints": "string",
  "tech_preferences": "string",
  "success_metrics": "string",
  "budget_min": null or number,
  "budget_max": null or number,
  "budget_currency": "USD" or null,
  "timeline_weeks": null or integer,
  "desired_start_date": null or "YYYY-MM-DD",
  "desired_launch_date": null or "YYYY-MM-DD",
  "stakeholders": [{"name":"...","role":"..."}],
  "risks": ["..."],
  "deliverables": ["..."],
  "unknowns": ["5-10 specific questions to ask the customer"],
  "source_document_ids": ["uuid array of documents that informed this brief"],
  "citations": {
    "<field_key>": [{ "document_id": "uuid", "snippet": "exact quote from the document, <=240 chars", "section": "optional section label" }]
  }
}
Citation rules:
- Provide citations for every field where you used document evidence.
- Snippets must be verbatim from the document content (do not paraphrase).
- Use the document id exactly as given. Skip citations for fields that were inferred without document support.
Use empty arrays/strings/null when unknown. Flag gaps as unknowns rather than guessing.`;

    const docContext = docs
      .map((d) => {
        const ex = (d.ai_extracted ?? {}) as Record<string, unknown> & { _snippets?: Record<string, string> };
        const snippets = ex._snippets ?? {};
        const extracted = JSON.stringify({ ...ex, _snippets: undefined, _confidence: undefined });
        const txt = (d.raw_text ?? d.description ?? "").slice(0, 6000);
        const snippetBlock = Object.keys(snippets).length
          ? `\nverbatim snippets:\n${Object.entries(snippets).map(([k, v]) => `  - [${k}] "${v}"`).join("\n")}`
          : "";
        return `--- DOC ${d.id} | ${d.document_type} | "${d.name}"
summary: ${d.ai_summary ?? "(none)"}
extracted: ${extracted}${snippetBlock}
content: ${txt || "(none)"}`;
      })
      .join("\n\n");

    const userMsg = `DEAL
title: ${deal.title}
value: ${deal.value ?? "?"} ${deal.currency ?? "USD"}
expected close: ${deal.expected_close_date ?? "?"}
description: ${deal.description ?? "(none)"}

ACCOUNT
${account ? JSON.stringify(account) : "(none linked)"}

PRIMARY CONTACT
${contact ? JSON.stringify(contact) : "(none)"}

RECENT DEAL ACTIVITIES (newest first)
${(activities ?? []).map((a) => `- [${a.activity_type}] ${a.content}`).join("\n") || "(none)"}

SALES DOCUMENTS (${docs.length})
${docContext || "(none uploaded)"}

${data.extra_context ? `ADDITIONAL CONTEXT FROM USER\n${data.extra_context}` : ""}`;


    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429)
      return { ok: false as const, error: "AI rate limit — try again shortly." };
    if (res.status === 402)
      return { ok: false as const, error: "AI credits exhausted. Add credits in Settings → Usage." };
    if (!res.ok) {
      const t = await res.text();
      return { ok: false as const, error: `AI gateway ${res.status}: ${t.slice(0, 200)}` };
    }

    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          return { ok: false as const, error: "AI returned invalid JSON" };
        }
      }
    }

    // Next version number
    const { data: latest } = await supabaseAdmin
      .from("discovery_briefs" as never)
      .select("version")
      .eq("deal_id", deal.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = ((latest as { version?: number } | null)?.version ?? 0) + 1;

    const asStr = (v: unknown) => (v == null ? "" : String(v));
    const asArr = (v: unknown) => (Array.isArray(v) ? v : []);
    const asNum = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
    const asDate = (v: unknown) =>
      typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

    const row = {
      workspace_id: deal.workspace_id,
      deal_id: deal.id,
      version: nextVersion,
      status: "draft",
      business_goals: asStr(parsed.business_goals),
      target_users: asStr(parsed.target_users),
      scope_summary: asStr(parsed.scope_summary),
      constraints: asStr(parsed.constraints),
      tech_preferences: asStr(parsed.tech_preferences),
      success_metrics: asStr(parsed.success_metrics),
      technical_requirements: asStr(parsed.technical_requirements),
      non_functional_requirements: asStr(parsed.non_functional_requirements),
      compliance_requirements: asStr(parsed.compliance_requirements),
      platforms: asArr(parsed.platforms).map(String),
      integrations: asArr(parsed.integrations).map(String),
      key_features: asArr(parsed.key_features),
      stakeholders: asArr(parsed.stakeholders),
      risks: asArr(parsed.risks),
      deliverables: asArr(parsed.deliverables),
      unknowns: asArr(parsed.unknowns),
      budget_min: asNum(parsed.budget_min),
      budget_max: asNum(parsed.budget_max),
      budget_currency: typeof parsed.budget_currency === "string" ? parsed.budget_currency : null,
      timeline_weeks: asNum(parsed.timeline_weeks),
      desired_start_date: asDate(parsed.desired_start_date),
      desired_launch_date: asDate(parsed.desired_launch_date),
      source_document_ids: docs.map((d) => d.id),
      citations: (() => {
        const raw = parsed.citations;
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
        const validDocIds = new Set(docs.map((d) => d.id));
        const out: Record<string, Array<{ document_id: string; snippet: string; section: string | null }>> = {};
        for (const [field, list] of Object.entries(raw as Record<string, unknown>)) {
          if (!Array.isArray(list)) continue;
          const cleaned = list
            .map((c) => {
              const o = c as { document_id?: string; snippet?: string; section?: string | null };
              if (!o?.document_id || !validDocIds.has(o.document_id)) return null;
              return {
                document_id: o.document_id,
                snippet: String(o.snippet ?? "").slice(0, 500),
                section: o.section ?? null,
              };
            })
            .filter((x): x is { document_id: string; snippet: string; section: string | null } => !!x);
          if (cleaned.length) out[field] = cleaned;
        }
        return out;
      })(),
      created_by: context.userId,
    };


    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("discovery_briefs" as never)
      .insert(row as never)
      .select("*")
      .single();
    if (insErr) return { ok: false as const, error: insErr.message };

    // Ensure handover exists & is in discovery stage
    await supabaseAdmin
      .from("engagement_handovers" as never)
      .upsert(
        {
          workspace_id: deal.workspace_id,
          deal_id: deal.id,
          stage: "discovery",
          pending_approver_role: "business_analyst",
          created_by: context.userId,
        } as never,
        { onConflict: "deal_id" },
      );

    return { ok: true as const, brief: inserted };
  });

/** Save edits to a discovery brief draft. */
export const updateDiscoveryBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            business_goals: z.string().max(8000).optional(),
            target_users: z.string().max(8000).optional(),
            scope_summary: z.string().max(8000).optional(),
            constraints: z.string().max(8000).optional(),
            tech_preferences: z.string().max(8000).optional(),
            success_metrics: z.string().max(8000).optional(),
            technical_requirements: z.string().max(8000).optional(),
            non_functional_requirements: z.string().max(8000).optional(),
            compliance_requirements: z.string().max(8000).optional(),
            platforms: z.array(z.string().max(40)).max(20).optional(),
            integrations: z.array(z.string().max(120)).max(50).optional(),
            key_features: z.array(z.record(z.string(), z.unknown())).max(100).optional(),
            stakeholders: z.array(z.record(z.string(), z.unknown())).max(50).optional(),
            risks: z.array(z.string().max(500)).max(50).optional(),
            deliverables: z.array(z.string().max(500)).max(50).optional(),
            unknowns: z.array(z.string().max(500)).max(50).optional(),
            budget_min: z.number().nullable().optional(),
            budget_max: z.number().nullable().optional(),
            budget_currency: z.string().max(10).nullable().optional(),
            timeline_weeks: z.number().int().nullable().optional(),
            desired_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
            desired_launch_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          })
          .strict(),

      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await supabaseAdmin
      .from("discovery_briefs" as never)
      .select("workspace_id, status")
      .eq("id", data.id)
      .single();
    if (!existing) throw new Error("Brief not found");
    const row = existing as { workspace_id: string; status: string };
    await assertMember(row.workspace_id, context.userId);
    if (row.status === "approved")
      throw new Error("Brief is already approved — draft a new version to edit");

    const { error } = await supabaseAdmin
      .from("discovery_briefs" as never)
      .update(data.patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Approve the brief and advance handover to sow_draft. */
export const approveDiscoveryBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ brief_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: brief } = await supabaseAdmin
      .from("discovery_briefs" as never)
      .select("id, workspace_id, deal_id")
      .eq("id", data.brief_id)
      .single();
    if (!brief) throw new Error("Brief not found");
    const b = brief as { id: string; workspace_id: string; deal_id: string };
    await assertMember(b.workspace_id, context.userId);

    await supabaseAdmin
      .from("discovery_briefs" as never)
      .update({
        status: "approved",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      } as never)
      .eq("id", b.id);

    // Advance handover
    const { data: h } = await supabaseAdmin
      .from("engagement_handovers" as never)
      .select("id, gate_history")
      .eq("deal_id", b.deal_id)
      .single();
    if (h) {
      const row = h as { id: string; gate_history: unknown[] };
      const history = Array.isArray(row.gate_history) ? row.gate_history : [];
      await supabaseAdmin
        .from("engagement_handovers" as never)
        .update({
          stage: "sow_draft",
          pending_approver_role: "sales_lead",
          gate_history: [
            ...history,
            {
              from: "discovery",
              to: "sow_draft",
              at: new Date().toISOString(),
              by: context.userId,
              note: "Discovery brief approved",
            },
          ],
        } as never)
        .eq("id", row.id);
    }

    // Auto-generate the scope checklist from the approved brief, but only if
    // no items exist yet (so re-approving a redrafted brief doesn't clobber
    // edits the team has already made). AI failures are non-fatal — the user
    // can still trigger it manually from the checklist panel.
    let checklist: { ok: boolean; count?: number; error?: string } | null = null;
    try {
      const { data: existing } = await supabaseAdmin
        .from("scope_checklist_items" as never)
        .select("id")
        .eq("deal_id", b.deal_id)
        .limit(1);
      if (!existing || existing.length === 0) {
        const { data: deal } = await supabaseAdmin
          .from("deals")
          .select("title")
          .eq("id", b.deal_id)
          .single();
        const result = await runScopeChecklistGeneration({
          workspaceId: b.workspace_id,
          dealId: b.deal_id,
          dealTitle: (deal as { title?: string } | null)?.title ?? "Deal",
          userId: context.userId,
          replace: false,
        });
        checklist = result;
      }
    } catch (e) {
      checklist = { ok: false, error: e instanceof Error ? e.message : "Checklist generation failed" };
    }

    return { ok: true, checklist };
  });
