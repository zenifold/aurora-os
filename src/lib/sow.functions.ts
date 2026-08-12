import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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

export const SOW_SECTIONS = [
  { key: "executive_summary", label: "Executive summary", kind: "text" },
  { key: "strategy", label: "Strategic approach", kind: "text" },
  { key: "positioning", label: "Positioning & why us", kind: "text" },
  { key: "value_proposition", label: "Value proposition", kind: "text" },
  { key: "scope", label: "Scope of work", kind: "text" },
  { key: "out_of_scope", label: "Out of scope", kind: "text" },
  { key: "technical_architecture", label: "Technical architecture", kind: "text" },
  { key: "integrations_approach", label: "Integrations approach", kind: "text" },
  { key: "deliverables", label: "Deliverables", kind: "deliverables" },
  { key: "team_composition", label: "Team composition", kind: "team" },
  { key: "timeline", label: "Timeline & phases", kind: "timeline" },
  { key: "financials", label: "Financials", kind: "financials" },
  { key: "assumptions", label: "Assumptions", kind: "list" },
  { key: "risks", label: "Risks & mitigations", kind: "risks" },
  { key: "success_criteria", label: "Success criteria", kind: "list" },
  { key: "terms_conditions", label: "Terms & conditions", kind: "text" },
  { key: "next_steps", label: "Next steps", kind: "text" },
] as const;

export type SowSectionKey = (typeof SOW_SECTIONS)[number]["key"];

const TEXT_KEYS: SowSectionKey[] = [
  "executive_summary",
  "strategy",
  "positioning",
  "value_proposition",
  "scope",
  "out_of_scope",
  "technical_architecture",
  "integrations_approach",
  "terms_conditions",
  "next_steps",
];

const JSON_KEYS: SowSectionKey[] = [
  "deliverables",
  "team_composition",
  "timeline",
  "financials",
  "assumptions",
  "risks",
  "success_criteria",
];

/* ----------------------------- READ ----------------------------- */

export const getSowDraft = createServerFn({ method: "POST" })
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
    const { data: sow } = await supabaseAdmin
      .from("sow_drafts" as never)
      .select("*")
      .eq("deal_id", data.deal_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    return sow ?? null;
  });

/* ------------------------ Build context ------------------------- */

async function buildContext(dealId: string) {
  const { data: deal } = await supabaseAdmin
    .from("deals")
    .select(
      "id, workspace_id, title, description, value, currency, expected_close_date, contact_id, client_account_id",
    )
    .eq("id", dealId)
    .single();
  if (!deal) throw new Error("Deal not found");

  const [{ data: brief }, { data: contact }, { data: account }, { data: docs }] = await Promise.all(
    [
      supabaseAdmin
        .from("discovery_briefs" as never)
        .select("*")
        .eq("deal_id", dealId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      deal.contact_id
        ? supabaseAdmin
            .from("contacts")
            .select("name, title, company, email")
            .eq("id", deal.contact_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      deal.client_account_id
        ? supabaseAdmin
            .from("client_accounts")
            .select("name, industry, website")
            .eq("id", deal.client_account_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("sales_documents" as never)
        .select("id, name, document_type, ai_summary, ai_extracted")
        .eq("deal_id", dealId),
    ],
  );

  const ctxText = `DEAL: ${deal.title}
value: ${deal.value ?? "?"} ${deal.currency ?? "USD"}
description: ${deal.description ?? "(none)"}

ACCOUNT: ${account ? JSON.stringify(account) : "(none)"}
CONTACT: ${contact ? JSON.stringify(contact) : "(none)"}

DISCOVERY BRIEF (v${(brief as { version?: number } | null)?.version ?? "?"}):
${brief ? JSON.stringify(brief, null, 2) : "(no approved brief)"}

SALES DOCUMENTS:
${((docs ?? []) as Array<{
  document_type: string;
  name: string;
  ai_summary: string | null;
  ai_extracted: Record<string, unknown> | null;
}>)
  .map(
    (d) =>
      `- [${d.document_type}] ${d.name}
  summary: ${d.ai_summary ?? "(none)"}
  extracted: ${d.ai_extracted ? JSON.stringify(d.ai_extracted) : "(none)"}`,
  )
  .join("\n")}`;

  return { deal, brief, ctxText };
}

/* ------------------------- AI helpers --------------------------- */

async function callAi(workspaceId: string, system: string, user: string) {
  const apiKey = await resolveOpenRouterKey(workspaceId);
  if (!apiKey) return { ok: false as const, error: OPENROUTER_KEY_MISSING_ERROR };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) return { ok: false as const, error: "AI rate limit — try again shortly." };
  if (res.status === 402)
    return { ok: false as const, error: "AI credits exhausted. Add credits in Settings → Usage." };
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: `AI gateway ${res.status}: ${t.slice(0, 200)}` };
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content ?? "{}";
  try {
    return { ok: true as const, json: JSON.parse(content) as Record<string, unknown> };
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return { ok: true as const, json: JSON.parse(m[0]) as Record<string, unknown> };
      } catch {
        /* fallthrough */
      }
    }
    return { ok: false as const, error: "AI returned invalid JSON" };
  }
}

/* ----------------- AGENTIC FULL-DOC DRAFT ------------------ */

export const draftSow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { deal, brief, ctxText } = await buildContext(data.deal_id);
    await assertMember(deal.workspace_id, context.userId);

    const system = `You are a senior delivery principal and solutions architect drafting a Statement of Work for a digital agency / consultancy.
Synthesize the discovery brief, sales documents, deal context, and account context into a complete, polished SOW.
Return STRICT JSON ONLY matching this exact schema (no markdown, no commentary):
{
  "title": "string — engagement title",
  "client_name": "string or null",
  "executive_summary": "3-5 sentences. Anchor on customer outcome.",
  "strategy": "Markdown. High-level strategic approach: discovery → design → build → launch → measure. Tie to business goals.",
  "positioning": "Markdown. Why we are the right partner. Differentiators, relevant prior work themes, team strengths.",
  "value_proposition": "Markdown. Quantified outcomes / ROI / risk reduction. Reference success metrics.",
  "scope": "Markdown. Detailed scope by workstream / module / feature.",
  "out_of_scope": "Markdown bullet list of explicit exclusions.",
  "technical_architecture": "Markdown. Recommended stack, system topology, data model overview, security/auth approach, deployment model. Reference platforms & integrations from brief.",
  "integrations_approach": "Markdown. Per-integration: purpose, direction, auth, data shape, sequencing.",
  "deliverables": [{"name":"...","description":"...","acceptance_criteria":"..."}],
  "team_composition": [{"role":"e.g. Tech Lead","count":1,"allocation_pct":50,"rationale":"why"}],
  "timeline": [{"phase":"Discovery","weeks":2,"milestones":["Kickoff","Brief signoff"]}],
  "financials": {
    "currency": "USD",
    "line_items": [{"name":"Discovery & design","qty":1,"rate":25000,"amount":25000}],
    "subtotal": 0,
    "discount": 0,
    "total": 0,
    "payment_schedule": [{"milestone":"On signing","pct":30,"amount":0}],
    "notes": "string"
  },
  "assumptions": ["string", "..."],
  "risks": [{"risk":"...","impact":"low|medium|high","mitigation":"..."}],
  "success_criteria": ["string", "..."],
  "terms_conditions": "Markdown. Change request process, IP, confidentiality, payment terms (Net 15/30), warranty, termination.",
  "next_steps": "Markdown. 3-5 concrete steps to mutual signature."
}
Rules:
- Be specific, not generic. If the brief lacks data, infer from industry/platforms and prefix sentences with "Recommended:".
- Financials must arithmetic-balance (sum line_items = subtotal, total = subtotal - discount, payment_schedule percentages sum to 100, amount = total * pct/100).
- If brief budget range is provided, anchor total inside that range.
- timeline weeks should sum to brief.timeline_weeks if provided.
- Keep markdown clean: no horizontal rules, no h1, use ## for sub-headings, - for bullets.`;

    const ai = await callAi(deal.workspace_id, system, ctxText);
    if (!ai.ok) return { ok: false as const, error: ai.error };
    const p = ai.json;

    const asStr = (v: unknown) => (v == null ? "" : String(v));
    const asArr = (v: unknown) => (Array.isArray(v) ? v : []);
    const asObj = (v: unknown) =>
      v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

    const { data: latest } = await supabaseAdmin
      .from("sow_drafts" as never)
      .select("version")
      .eq("deal_id", deal.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = ((latest as { version?: number } | null)?.version ?? 0) + 1;

    const now = new Date().toISOString();
    const sectionMeta: Record<string, { ai_generated_at: string }> = {};
    for (const s of SOW_SECTIONS) sectionMeta[s.key] = { ai_generated_at: now };

    const row = {
      workspace_id: deal.workspace_id,
      deal_id: deal.id,
      brief_id: (brief as { id?: string } | null)?.id ?? null,
      version: nextVersion,
      status: "draft",
      title: asStr(p.title) || `SOW — ${deal.title}`,
      client_name: typeof p.client_name === "string" ? p.client_name : null,
      executive_summary: asStr(p.executive_summary),
      strategy: asStr(p.strategy),
      positioning: asStr(p.positioning),
      value_proposition: asStr(p.value_proposition),
      scope: asStr(p.scope),
      out_of_scope: asStr(p.out_of_scope),
      technical_architecture: asStr(p.technical_architecture),
      integrations_approach: asStr(p.integrations_approach),
      terms_conditions: asStr(p.terms_conditions),
      next_steps: asStr(p.next_steps),
      deliverables: asArr(p.deliverables),
      team_composition: asArr(p.team_composition),
      timeline: asArr(p.timeline),
      financials: asObj(p.financials),
      assumptions: asArr(p.assumptions),
      risks: asArr(p.risks),
      success_criteria: asArr(p.success_criteria),
      section_meta: sectionMeta,
      ai_generated_at: now,
      created_by: context.userId,
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("sow_drafts" as never)
      .insert(row as never)
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };

    return { ok: true as const, sow: inserted };
  });

/* ----------------- PER-SECTION REGENERATION ------------------ */

export const regenerateSowSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sow_id: z.string().uuid(),
        section: z.enum([
          "executive_summary",
          "strategy",
          "positioning",
          "value_proposition",
          "scope",
          "out_of_scope",
          "technical_architecture",
          "integrations_approach",
          "deliverables",
          "team_composition",
          "timeline",
          "financials",
          "assumptions",
          "risks",
          "success_criteria",
          "terms_conditions",
          "next_steps",
        ]),
        instruction: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: sow } = await supabaseAdmin
      .from("sow_drafts" as never)
      .select("*")
      .eq("id", data.sow_id)
      .single();
    if (!sow) throw new Error("SOW not found");
    const s = sow as Record<string, unknown> & {
      workspace_id: string;
      deal_id: string;
      status: string;
      section_meta: Record<string, unknown>;
    };
    await assertMember(s.workspace_id, context.userId);
    if (s.status === "approved" || s.status === "signed")
      throw new Error("SOW is locked — draft a new version to edit");

    const { ctxText } = await buildContext(s.deal_id);
    const isText = TEXT_KEYS.includes(data.section as SowSectionKey);
    const sectionLabel = SOW_SECTIONS.find((x) => x.key === data.section)?.label ?? data.section;

    const system = `You are regenerating ONE section of an existing Statement of Work.
Return STRICT JSON only: {"value": <result>}
${
  isText
    ? `For this section "${sectionLabel}", value must be a markdown string.`
    : `For this section "${sectionLabel}", value must be a JSON array/object matching the same shape used in our SOW schema (see existing value below).`
}
Use the same tone, specificity, and structure as a senior delivery principal.`;

    const userMsg = `${ctxText}

EXISTING SOW SECTIONS (full context):
${JSON.stringify(
  Object.fromEntries([...TEXT_KEYS, ...JSON_KEYS].map((k) => [k, s[k]])),
  null,
  2,
).slice(0, 12000)}

REGENERATE SECTION: ${data.section}
CURRENT VALUE: ${JSON.stringify(s[data.section as keyof typeof s])}
${data.instruction ? `USER INSTRUCTION: ${data.instruction}` : ""}`;

    const ai = await callAi(s.workspace_id, system, userMsg);
    if (!ai.ok) return { ok: false as const, error: ai.error };

    const value = ai.json.value;
    const update: Record<string, unknown> = {};
    if (isText) {
      update[data.section] = typeof value === "string" ? value : JSON.stringify(value);
    } else {
      update[data.section] = value ?? (data.section === "financials" ? {} : []);
    }
    const meta = (s.section_meta ?? {}) as Record<string, unknown>;
    meta[data.section] = {
      ai_generated_at: new Date().toISOString(),
      last_instruction: data.instruction ?? null,
    };
    update.section_meta = meta;

    const { error } = await supabaseAdmin
      .from("sow_drafts" as never)
      .update(update as never)
      .eq("id", data.sow_id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/* --------------------- MANUAL SECTION EDIT ----------------------- */

export const updateSowSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sow_id: z.string().uuid(),
        patch: z.record(z.string(), z.unknown()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: sow } = await supabaseAdmin
      .from("sow_drafts" as never)
      .select("workspace_id, status")
      .eq("id", data.sow_id)
      .single();
    if (!sow) throw new Error("SOW not found");
    const s = sow as { workspace_id: string; status: string };
    await assertMember(s.workspace_id, context.userId);
    if (s.status === "approved" || s.status === "signed")
      throw new Error("SOW is locked");

    // Allow only known keys
    const allowed = new Set<string>([
      ...TEXT_KEYS,
      ...JSON_KEYS,
      "title",
      "client_name",
    ]);
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data.patch)) {
      if (allowed.has(k)) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin
      .from("sow_drafts" as never)
      .update(patch as never)
      .eq("id", data.sow_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------- APPROVE / STATUS ------------------------- */

export const setSowStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sow_id: z.string().uuid(),
        status: z.enum([
          "draft",
          "internal_review",
          "customer_review",
          "approved",
          "signed",
          "superseded",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: sow } = await supabaseAdmin
      .from("sow_drafts" as never)
      .select("id, workspace_id, deal_id")
      .eq("id", data.sow_id)
      .single();
    if (!sow) throw new Error("SOW not found");
    const s = sow as { id: string; workspace_id: string; deal_id: string };
    await assertMember(s.workspace_id, context.userId);

    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "approved") {
      patch.approved_by = context.userId;
      patch.approved_at = new Date().toISOString();
    }
    const { error } = await supabaseAdmin
      .from("sow_drafts" as never)
      .update(patch as never)
      .eq("id", s.id);
    if (error) throw new Error(error.message);

    // Map SOW status → handover stage
    const stageMap: Record<string, string> = {
      internal_review: "sow_internal_review",
      customer_review: "sow_customer_review",
      approved: "sow_customer_review",
      signed: "signed",
    };
    const toStage = stageMap[data.status];
    if (toStage) {
      const { data: h } = await supabaseAdmin
        .from("engagement_handovers" as never)
        .select("id, stage, gate_history")
        .eq("deal_id", s.deal_id)
        .maybeSingle();
      if (h) {
        const row = h as { id: string; stage: string; gate_history: unknown[] };
        const history = Array.isArray(row.gate_history) ? row.gate_history : [];
        await supabaseAdmin
          .from("engagement_handovers" as never)
          .update({
            stage: toStage,
            gate_history: [
              ...history,
              {
                from: row.stage,
                to: toStage,
                at: new Date().toISOString(),
                by: context.userId,
                note: `SOW status → ${data.status}`,
              },
            ],
          } as never)
          .eq("id", row.id);
      }
    }
    return { ok: true };
  });
