import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  OPENROUTER_KEY_MISSING_ERROR,
  resolveOpenRouterKey,
} from "@/server/openrouter-key.server";
import { DELIVERABLE_KIND_MAP, getKindDef } from "./deliverable-kinds";
import { resolveSections } from "./deliverable-templates.functions";

async function assertMember(workspaceId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Not a workspace member");
}

async function dealWorkspace(dealId: string) {
  const { data } = await supabaseAdmin
    .from("deals")
    .select("workspace_id, name")
    .eq("id", dealId)
    .single();
  return data as { workspace_id: string; name: string } | null;
}

/* ----------------------------- READ ----------------------------- */

export const listDeliverables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const deal = await dealWorkspace(data.deal_id);
    if (!deal) return [];
    await assertMember(deal.workspace_id, context.userId);

    const { data: rows, error } = await supabaseAdmin
      .from("sales_deliverables" as never)
      .select(
        "id, kind, title, status, current_version_id, template_id, owner_id, created_by, created_at, updated_at",
      )
      .eq("deal_id", data.deal_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as Array<{
      id: string;
      kind: string;
      title: string;
      status: string;
      current_version_id: string | null;
      template_id: string | null;
      owner_id: string | null;
      created_by: string | null;
      created_at: string;
      updated_at: string;
    }>;

    // pull current version metadata in one go
    const versionIds = list.map((d) => d.current_version_id).filter(Boolean) as string[];
    let versionMap: Record<string, { version: number; ai_generated_at: string | null }> = {};
    if (versionIds.length) {
      const { data: vrows } = await supabaseAdmin
        .from("sales_deliverable_versions" as never)
        .select("id, version, ai_generated_at")
        .in("id", versionIds);
      versionMap = Object.fromEntries(
        ((vrows ?? []) as Array<{ id: string; version: number; ai_generated_at: string | null }>).map(
          (v) => [v.id, { version: v.version, ai_generated_at: v.ai_generated_at }],
        ),
      );
    }

    return list.map((d) => ({
      ...d,
      kind_label: getKindDef(d.kind)?.label ?? d.kind,
      kind_icon: getKindDef(d.kind)?.icon ?? "file-text",
      current_version: d.current_version_id ? versionMap[d.current_version_id]?.version ?? null : null,
      ai_generated_at: d.current_version_id
        ? versionMap[d.current_version_id]?.ai_generated_at ?? null
        : null,
    }));
  });

export const getDeliverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ deliverable_id: z.string().uuid(), version_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: del } = await supabaseAdmin
      .from("sales_deliverables" as never)
      .select("*")
      .eq("id", data.deliverable_id)
      .maybeSingle();
    if (!del) return null;
    const row = del as { workspace_id: string; current_version_id: string | null };
    await assertMember(row.workspace_id, context.userId);

    const versionId = data.version_id ?? row.current_version_id;
    let version: unknown = null;
    if (versionId) {
      const { data: v } = await supabaseAdmin
        .from("sales_deliverable_versions" as never)
        .select("*")
        .eq("id", versionId)
        .maybeSingle();
      version = v ?? null;
    }

    const { data: versions } = await supabaseAdmin
      .from("sales_deliverable_versions" as never)
      .select("id, version, label, status, ai_generated_at, ai_model, change_summary, created_at, created_by")
      .eq("deliverable_id", data.deliverable_id)
      .order("version", { ascending: false });

    return { deliverable: del, version: version as object | null, versions: versions ?? [] };
  });

/* ----------------------------- CREATE ----------------------------- */

export const createDeliverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        deal_id: z.string().uuid(),
        kind: z.string(),
        title: z.string().min(1).max(200).optional(),
        template_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const deal = await dealWorkspace(data.deal_id);
    if (!deal) throw new Error("Deal not found");
    await assertMember(deal.workspace_id, context.userId);

    const kindDef = DELIVERABLE_KIND_MAP[data.kind];
    if (!kindDef && data.kind !== "custom" && !data.template_id)
      throw new Error("Unknown deliverable kind");

    const sections = await resolveSections(data.template_id ?? null, data.kind);
    const title =
      data.title ?? `${kindDef?.label ?? "Deliverable"} — ${deal.name}`;

    const { data: created, error } = await supabaseAdmin
      .from("sales_deliverables" as never)
      .insert({
        workspace_id: deal.workspace_id,
        deal_id: data.deal_id,
        kind: data.kind,
        title,
        status: "draft",
        template_id: data.template_id ?? null,
        owner_id: context.userId,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // seed empty v1 from resolved sections
    const initialSections: Record<string, { content: string }> = {};
    for (const s of sections) initialSections[s.key] = { content: "" };

    const delId = (created as { id: string }).id;
    const { data: v, error: vErr } = await supabaseAdmin
      .from("sales_deliverable_versions" as never)
      .insert({
        workspace_id: deal.workspace_id,
        deliverable_id: delId,
        version: 1,
        status: "draft",
        sections: initialSections,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (vErr) throw new Error(vErr.message);

    await supabaseAdmin
      .from("sales_deliverables" as never)
      .update({ current_version_id: (v as { id: string }).id } as never)
      .eq("id", delId);

    return { id: delId };
  });

/* ----------------------------- UPDATE SECTION ----------------------------- */

export const updateDeliverableSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        version_id: z.string().uuid(),
        section_key: z.string().min(1),
        content: z.unknown(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: v } = await supabaseAdmin
      .from("sales_deliverable_versions" as never)
      .select("id, workspace_id, sections, status")
      .eq("id", data.version_id)
      .maybeSingle();
    if (!v) throw new Error("Version not found");
    const row = v as { workspace_id: string; sections: Record<string, unknown>; status: string };
    await assertMember(row.workspace_id, context.userId);
    if (!["draft"].includes(row.status))
      throw new Error("Cannot edit a non-draft version directly; fork a new version first.");

    const sections = { ...(row.sections ?? {}) };
    sections[data.section_key] = { ...(sections[data.section_key] as object ?? {}), content: data.content };

    const { error } = await supabaseAdmin
      .from("sales_deliverable_versions" as never)
      .update({ sections } as never)
      .eq("id", data.version_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------------- STATUS ----------------------------- */

const STATUSES = [
  "draft",
  "internal_review",
  "customer_review",
  "approved",
  "signed",
  "superseded",
] as const;

export const setDeliverableStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ deliverable_id: z.string().uuid(), status: z.enum(STATUSES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: del } = await supabaseAdmin
      .from("sales_deliverables" as never)
      .select("workspace_id")
      .eq("id", data.deliverable_id)
      .maybeSingle();
    if (!del) throw new Error("Not found");
    await assertMember((del as { workspace_id: string }).workspace_id, context.userId);

    const { error } = await supabaseAdmin
      .from("sales_deliverables" as never)
      .update({ status: data.status } as never)
      .eq("id", data.deliverable_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------------- VERSIONING ----------------------------- */

export const forkVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ version_id: z.string().uuid(), label: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: v } = await supabaseAdmin
      .from("sales_deliverable_versions" as never)
      .select("*")
      .eq("id", data.version_id)
      .maybeSingle();
    if (!v) throw new Error("Version not found");
    const src = v as {
      workspace_id: string;
      deliverable_id: string;
      version: number;
      sections: unknown;
      citations: unknown;
      source_brief_id: string | null;
      source_document_ids: string[];
    };
    await assertMember(src.workspace_id, context.userId);

    const { data: maxRow } = await supabaseAdmin
      .from("sales_deliverable_versions" as never)
      .select("version")
      .eq("deliverable_id", src.deliverable_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextV = ((maxRow as { version: number } | null)?.version ?? 0) + 1;

    const { data: created, error } = await supabaseAdmin
      .from("sales_deliverable_versions" as never)
      .insert({
        workspace_id: src.workspace_id,
        deliverable_id: src.deliverable_id,
        version: nextV,
        label: data.label ?? `v${nextV} — fork of v${src.version}`,
        status: "draft",
        sections: src.sections,
        citations: src.citations,
        source_brief_id: src.source_brief_id,
        source_document_ids: src.source_document_ids,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("sales_deliverables" as never)
      .update({ current_version_id: (created as { id: string }).id } as never)
      .eq("id", src.deliverable_id);

    return { id: (created as { id: string }).id, version: nextV };
  });

export const restoreVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ version_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // restoring = forking from an older version, becomes new current
    const result = await forkVersion({
      data: { version_id: data.version_id, label: undefined },
    } as never);
    return result;
  });

/* ----------------------------- DELETE ----------------------------- */

export const deleteDeliverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deliverable_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: del } = await supabaseAdmin
      .from("sales_deliverables" as never)
      .select("workspace_id")
      .eq("id", data.deliverable_id)
      .maybeSingle();
    if (!del) return { ok: true };
    await assertMember((del as { workspace_id: string }).workspace_id, context.userId);
    const { error } = await supabaseAdmin
      .from("sales_deliverables" as never)
      .delete()
      .eq("id", data.deliverable_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------------- COMMENTS ----------------------------- */

export const listComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ deliverable_id: z.string().uuid(), section_key: z.string().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: del } = await supabaseAdmin
      .from("sales_deliverables" as never)
      .select("workspace_id")
      .eq("id", data.deliverable_id)
      .maybeSingle();
    if (!del) return [];
    await assertMember((del as { workspace_id: string }).workspace_id, context.userId);

    let q = supabaseAdmin
      .from("deliverable_comments" as never)
      .select("*")
      .eq("deliverable_id", data.deliverable_id)
      .order("created_at", { ascending: true });
    if (data.section_key) q = q.eq("section_key", data.section_key);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        deliverable_id: z.string().uuid(),
        version_id: z.string().uuid().optional(),
        section_key: z.string().optional(),
        body: z.string().min(1).max(5000),
        parent_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: del } = await supabaseAdmin
      .from("sales_deliverables" as never)
      .select("workspace_id")
      .eq("id", data.deliverable_id)
      .maybeSingle();
    if (!del) throw new Error("Not found");
    const wsId = (del as { workspace_id: string }).workspace_id;
    await assertMember(wsId, context.userId);

    const { data: created, error } = await supabaseAdmin
      .from("deliverable_comments" as never)
      .insert({
        workspace_id: wsId,
        deliverable_id: data.deliverable_id,
        version_id: data.version_id ?? null,
        section_key: data.section_key ?? null,
        body: data.body,
        parent_id: data.parent_id ?? null,
        author_id: context.userId,
        author_kind: "member",
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (created as { id: string }).id };
  });

export const resolveComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ comment_id: z.string().uuid(), resolved: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: c } = await supabaseAdmin
      .from("deliverable_comments" as never)
      .select("workspace_id")
      .eq("id", data.comment_id)
      .maybeSingle();
    if (!c) throw new Error("Not found");
    await assertMember((c as { workspace_id: string }).workspace_id, context.userId);
    const { error } = await supabaseAdmin
      .from("deliverable_comments" as never)
      .update({
        resolved: data.resolved,
        resolved_by: data.resolved ? context.userId : null,
        resolved_at: data.resolved ? new Date().toISOString() : null,
      } as never)
      .eq("id", data.comment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------------- AGENT RUNS (log) ----------------------------- */

export const listAgentRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deliverable_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: del } = await supabaseAdmin
      .from("sales_deliverables" as never)
      .select("workspace_id")
      .eq("id", data.deliverable_id)
      .maybeSingle();
    if (!del) return [];
    await assertMember((del as { workspace_id: string }).workspace_id, context.userId);
    const { data: rows } = await supabaseAdmin
      .from("deliverable_agent_runs" as never)
      .select("*")
      .eq("deliverable_id", data.deliverable_id)
      .order("created_at", { ascending: false })
      .limit(100);
    return rows ?? [];
  });

/* ----------------------------- SHARE LINKS ----------------------------- */

function randomToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const createShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        deliverable_id: z.string().uuid(),
        version_id: z.string().uuid().optional(),
        access: z.enum(["read", "comment"]).default("read"),
        recipient_email: z.string().email().optional(),
        expires_in_days: z.number().int().min(1).max(180).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: del } = await supabaseAdmin
      .from("sales_deliverables" as never)
      .select("workspace_id, current_version_id")
      .eq("id", data.deliverable_id)
      .maybeSingle();
    if (!del) throw new Error("Not found");
    const row = del as { workspace_id: string; current_version_id: string | null };
    await assertMember(row.workspace_id, context.userId);

    const expiresAt = data.expires_in_days
      ? new Date(Date.now() + data.expires_in_days * 86400_000).toISOString()
      : null;

    const { data: link, error } = await supabaseAdmin
      .from("deliverable_share_links" as never)
      .insert({
        workspace_id: row.workspace_id,
        deliverable_id: data.deliverable_id,
        version_id: data.version_id ?? row.current_version_id,
        token: randomToken(),
        access: data.access,
        recipient_email: data.recipient_email ?? null,
        expires_at: expiresAt,
        created_by: context.userId,
      } as never)
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);
    return link;
  });

export const revokeShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ link_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: l } = await supabaseAdmin
      .from("deliverable_share_links" as never)
      .select("workspace_id")
      .eq("id", data.link_id)
      .maybeSingle();
    if (!l) return { ok: true };
    await assertMember((l as { workspace_id: string }).workspace_id, context.userId);
    const { error } = await supabaseAdmin
      .from("deliverable_share_links" as never)
      .update({ revoked_at: new Date().toISOString() } as never)
      .eq("id", data.link_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================== */
/* ============== AGENT RUNTIME: generate / regenerate ========== */
/* ============================================================== */

async function buildDealContext(dealId: string) {
  const { data: deal } = await supabaseAdmin
    .from("deals")
    .select(
      "id, workspace_id, title, description, value, currency, expected_close_date, contact_id, client_account_id",
    )
    .eq("id", dealId)
    .single();
  if (!deal) throw new Error("Deal not found");

  const [{ data: brief }, { data: contact }, { data: account }, { data: docs }] = await Promise.all([
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
  ]);

  const ctxText = `DEAL: ${deal.title}
value: ${deal.value ?? "?"} ${deal.currency ?? "USD"}
description: ${deal.description ?? "(none)"}

ACCOUNT: ${account ? JSON.stringify(account) : "(none)"}
CONTACT: ${contact ? JSON.stringify(contact) : "(none)"}

DISCOVERY BRIEF:
${brief ? JSON.stringify(brief, null, 2) : "(no approved brief)"}

SALES DOCUMENTS:
${((docs ?? []) as Array<{
  id: string;
  document_type: string;
  name: string;
  ai_summary: string | null;
  ai_extracted: Record<string, unknown> | null;
}>)
    .map(
      (d) =>
        `- [${d.document_type}] (${d.id}) ${d.name}\n  summary: ${d.ai_summary ?? "(none)"}\n  extracted: ${d.ai_extracted ? JSON.stringify(d.ai_extracted) : "(none)"}`,
    )
    .join("\n")}`;

  return {
    deal,
    brief: brief as ({ id?: string } & Record<string, unknown>) | null,
    docIds: ((docs ?? []) as Array<{ id: string }>).map((d) => d.id),
    ctxText,
  };
}

async function callDeliverableAi(
  workspaceId: string,
  system: string,
  user: string,
  model = "google/gemini-2.5-flash",
) {
  const apiKey = await resolveOpenRouterKey(workspaceId);
  if (!apiKey) return { ok: false as const, error: OPENROUTER_KEY_MISSING_ERROR };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
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
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = body.choices?.[0]?.message?.content ?? "{}";
  try {
    return {
      ok: true as const,
      json: JSON.parse(content) as Record<string, unknown>,
      usage: body.usage,
    };
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return {
          ok: true as const,
          json: JSON.parse(m[0]) as Record<string, unknown>,
          usage: body.usage,
        };
      } catch {
        /* fall through */
      }
    }
    return { ok: false as const, error: "AI returned invalid JSON" };
  }
}

function sectionSchemaHint(s: { key: string; label: string; kind: string }) {
  switch (s.kind) {
    case "list":
      return `array of short strings`;
    case "deliverables":
      return `array of {name, description, acceptance_criteria}`;
    case "team":
      return `array of {role, count, allocation_pct, rationale}`;
    case "timeline":
      return `array of {phase, weeks, milestones:[string]}`;
    case "financials":
      return `object {currency, line_items:[{name,qty,rate,amount}], subtotal, discount, total, payment_schedule:[{milestone,pct,amount}], notes}`;
    case "risks":
      return `array of {risk, impact:"low|medium|high", mitigation}`;
    case "table":
      return `array of row objects (consistent keys)`;
    default:
      return `markdown string`;
  }
}

function diffSections(
  prev: Record<string, { content?: unknown }> | undefined,
  next: Record<string, { content?: unknown }>,
) {
  const out: Record<string, "added" | "changed" | "unchanged"> = {};
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next)]);
  for (const k of keys) {
    const a = JSON.stringify(prev?.[k]?.content ?? "");
    const b = JSON.stringify(next[k]?.content ?? "");
    if (a === "" && b !== "") out[k] = "added";
    else if (a !== b) out[k] = "changed";
    else out[k] = "unchanged";
  }
  return out;
}

/** Generate (or regenerate) all sections of a deliverable into a NEW version. */
export const generateDeliverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        deliverable_id: z.string().uuid(),
        instruction: z.string().max(4000).optional(),
        model: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: delRow } = await supabaseAdmin
      .from("sales_deliverables" as never)
      .select("id, workspace_id, deal_id, kind, title, current_version_id, template_id")
      .eq("id", data.deliverable_id)
      .single();
    if (!delRow) throw new Error("Deliverable not found");
    const del = delRow as {
      id: string;
      workspace_id: string;
      deal_id: string;
      kind: string;
      title: string;
      current_version_id: string | null;
      template_id: string | null;
    };
    await assertMember(del.workspace_id, context.userId);

    const kindDef = DELIVERABLE_KIND_MAP[del.kind];
    const sections = await resolveSections(del.template_id, del.kind);
    if (!sections.length) throw new Error("Deliverable has no sections defined");
    const kindLabel = kindDef?.label ?? del.kind;

    const ctx = await buildDealContext(del.deal_id);
    const model = data.model ?? kindDef?.defaultModel ?? "google/gemini-2.5-flash";

    const schemaLines = sections
      .map((s) => `  "${s.key}": ${sectionSchemaHint(s)}  // ${s.label}${s.required ? " (required)" : ""}${s.ai_prompt ? ` — ${s.ai_prompt}` : ""}`)
      .join(",\n");

    const system = `You are a senior pre-sales lead drafting a "${kindLabel}" for a digital consultancy.
Synthesize the deal, discovery brief, and sales documents into a complete, specific, polished deliverable.
Return STRICT JSON ONLY matching this exact schema (no markdown, no prose, no commentary):
{
  "title": "string — short engagement / artifact title",
  "sections": {
${schemaLines}
  },
  "citations": {
    "<section_key>": [{"document_id":"<uuid>","snippet":"short verbatim snippet (<200 chars)"}]
  },
  "change_summary": "one paragraph: what changed from the previous version, or 'initial draft'"
}
Rules:
- Be specific, not generic. If data is missing, infer from industry & prefix sentences with "Recommended:".
- Citations: cite a document_id whenever a fact is taken from a sales document; omit when none applies.
- For markdown sections, use ## sub-headings and - bullets only; no h1, no horizontal rules.
- For financials: line_items.amount = qty*rate; sum(line_items)=subtotal; total=subtotal-discount; payment_schedule pcts sum to 100.${
      data.instruction ? `\n- USER INSTRUCTION: ${data.instruction}` : ""
    }`;

    const prevSections = del.current_version_id
      ? (
          (
            await supabaseAdmin
              .from("sales_deliverable_versions" as never)
              .select("sections")
              .eq("id", del.current_version_id)
              .maybeSingle()
          ).data as { sections?: Record<string, { content?: unknown }> } | null
        )?.sections
      : undefined;

    const startedAt = new Date().toISOString();
    const ai = await callDeliverableAi(del.workspace_id, system, ctx.ctxText, model);

    if (!ai.ok) {
      await supabaseAdmin.from("deliverable_agent_runs" as never).insert({
        workspace_id: del.workspace_id,
        deliverable_id: del.id,
        section_key: null,
        model,
        prompt: system.slice(0, 4000),
        status: "failed",
        error: ai.error,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        created_by: context.userId,
      } as never);
      return { ok: false as const, error: ai.error };
    }

    const aiSections = (ai.json.sections ?? {}) as Record<string, unknown>;
    const citations = (ai.json.citations ?? {}) as Record<string, unknown>;
    const changeSummary =
      typeof ai.json.change_summary === "string"
        ? ai.json.change_summary
        : del.current_version_id
          ? "Regenerated by AI."
          : "Initial AI draft.";

    const now = new Date().toISOString();
    const nextSections: Record<string, { content: unknown; ai_generated_at: string }> = {};
    for (const s of sections) {
      nextSections[s.key] = { content: aiSections[s.key] ?? "", ai_generated_at: now };
    }

    const { data: maxRow } = await supabaseAdmin
      .from("sales_deliverable_versions" as never)
      .select("version")
      .eq("deliverable_id", del.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextV = ((maxRow as { version: number } | null)?.version ?? 0) + 1;

    const diff = diffSections(prevSections, nextSections);

    const { data: created, error: vErr } = await supabaseAdmin
      .from("sales_deliverable_versions" as never)
      .insert({
        workspace_id: del.workspace_id,
        deliverable_id: del.id,
        version: nextV,
        label: `v${nextV} — AI draft`,
        status: "draft",
        sections: nextSections,
        ai_model: model,
        ai_generated_at: now,
        source_brief_id: ctx.brief?.id ?? null,
        source_document_ids: ctx.docIds,
        citations,
        diff_against_prev: diff,
        change_summary: changeSummary,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (vErr) return { ok: false as const, error: vErr.message };

    // mark prev as superseded
    if (del.current_version_id) {
      await supabaseAdmin
        .from("sales_deliverable_versions" as never)
        .update({
          superseded_at: now,
          superseded_by: (created as { id: string }).id,
        } as never)
        .eq("id", del.current_version_id);
    }

    await supabaseAdmin
      .from("sales_deliverables" as never)
      .update({
        current_version_id: (created as { id: string }).id,
        title: typeof ai.json.title === "string" && ai.json.title ? ai.json.title : del.title,
      } as never)
      .eq("id", del.id);

    await supabaseAdmin.from("deliverable_agent_runs" as never).insert({
      workspace_id: del.workspace_id,
      deliverable_id: del.id,
      deliverable_version_id: (created as { id: string }).id,
      section_key: null,
      model,
      prompt: system.slice(0, 4000),
      input_tokens: ai.usage?.prompt_tokens ?? null,
      output_tokens: ai.usage?.completion_tokens ?? null,
      status: "succeeded",
      started_at: startedAt,
      finished_at: now,
      created_by: context.userId,
    } as never);

    return { ok: true as const, version_id: (created as { id: string }).id, version: nextV };
  });

/** Regenerate ONE section in place on the current draft version. */
export const regenerateDeliverableSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        version_id: z.string().uuid(),
        section_key: z.string().min(1),
        instruction: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: vRow } = await supabaseAdmin
      .from("sales_deliverable_versions" as never)
      .select("id, workspace_id, deliverable_id, sections, status, ai_model, citations")
      .eq("id", data.version_id)
      .single();
    if (!vRow) throw new Error("Version not found");
    const v = vRow as {
      id: string;
      workspace_id: string;
      deliverable_id: string;
      sections: Record<string, { content?: unknown; ai_generated_at?: string }>;
      status: string;
      ai_model: string | null;
      citations: Record<string, unknown>;
    };
    await assertMember(v.workspace_id, context.userId);
    if (v.status !== "draft")
      throw new Error("Cannot regenerate on a non-draft version — fork a new version first.");

    const { data: delRow } = await supabaseAdmin
      .from("sales_deliverables" as never)
      .select("kind, deal_id, template_id")
      .eq("id", v.deliverable_id)
      .single();
    const del = delRow as unknown as { kind: string; deal_id: string; template_id: string | null };
    const kindDef = DELIVERABLE_KIND_MAP[del.kind];
    const sections = await resolveSections(del.template_id, del.kind);
    const sectionDef = sections.find((s) => s.key === data.section_key);
    if (!sectionDef) throw new Error("Unknown section");
    const kindLabel = kindDef?.label ?? del.kind;

    const ctx = await buildDealContext(del.deal_id);
    const model = v.ai_model ?? kindDef?.defaultModel ?? "google/gemini-2.5-flash";

    const system = `You are regenerating ONE section of a "${kindLabel}".
Return STRICT JSON ONLY: {"value": <result>, "citations": [{"document_id":"<uuid>","snippet":"..."}]}
Shape of "value" for section "${sectionDef.label}": ${sectionSchemaHint(sectionDef)}.
Match the tone and specificity of a senior pre-sales lead.${
      data.instruction ? `\nUSER INSTRUCTION: ${data.instruction}` : ""
    }`;

    const userMsg = `${ctx.ctxText}

EXISTING SECTIONS (for consistency):
${JSON.stringify(
  Object.fromEntries(Object.entries(v.sections).map(([k, val]) => [k, val?.content])),
  null,
  2,
).slice(0, 12000)}

REGENERATE SECTION: ${data.section_key}
CURRENT VALUE: ${JSON.stringify(v.sections[data.section_key]?.content ?? null)}`;

    const startedAt = new Date().toISOString();
    const ai = await callDeliverableAi(v.workspace_id, system, userMsg, model);

    if (!ai.ok) {
      await supabaseAdmin.from("deliverable_agent_runs" as never).insert({
        workspace_id: v.workspace_id,
        deliverable_id: v.deliverable_id,
        deliverable_version_id: v.id,
        section_key: data.section_key,
        model,
        status: "failed",
        error: ai.error,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        created_by: context.userId,
      } as never);
      return { ok: false as const, error: ai.error };
    }

    const value = ai.json.value;
    const sectionCitations = Array.isArray(ai.json.citations) ? ai.json.citations : [];
    const now = new Date().toISOString();

    const nextSections = { ...v.sections };
    nextSections[data.section_key] = {
      ...(nextSections[data.section_key] ?? {}),
      content: value ?? "",
      ai_generated_at: now,
      last_instruction: data.instruction ?? null,
    } as { content: unknown; ai_generated_at: string };

    const nextCitations = { ...(v.citations ?? {}) };
    (nextCitations as Record<string, unknown>)[data.section_key] = sectionCitations;

    const { error: uErr } = await supabaseAdmin
      .from("sales_deliverable_versions" as never)
      .update({ sections: nextSections, citations: nextCitations } as never)
      .eq("id", v.id);
    if (uErr) return { ok: false as const, error: uErr.message };

    await supabaseAdmin.from("deliverable_agent_runs" as never).insert({
      workspace_id: v.workspace_id,
      deliverable_id: v.deliverable_id,
      deliverable_version_id: v.id,
      section_key: data.section_key,
      model,
      input_tokens: ai.usage?.prompt_tokens ?? null,
      output_tokens: ai.usage?.completion_tokens ?? null,
      status: "succeeded",
      started_at: startedAt,
      finished_at: now,
      created_by: context.userId,
    } as never);

    return { ok: true as const };
  });
