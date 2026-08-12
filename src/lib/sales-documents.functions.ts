import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  OPENROUTER_KEY_MISSING_ERROR,
  resolveOpenRouterKey,
} from "@/server/openrouter-key.server";

const BUCKET = "sales-documents";

async function getDealWorkspace(dealId: string, userId: string) {
  const { data: deal } = await supabaseAdmin
    .from("deals")
    .select("id, workspace_id")
    .eq("id", dealId)
    .single();
  if (!deal) throw new Error("Deal not found");
  const { data: m } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", deal.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!m) throw new Error("Not a workspace member");
  return deal;
}

export const listSalesDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await getDealWorkspace(data.deal_id, context.userId);
    const { data: docs } = await supabaseAdmin
      .from("sales_documents" as never)
      .select("*")
      .eq("deal_id", data.deal_id)
      .order("created_at", { ascending: false });
    return docs ?? [];
  });

/** Issue a signed upload URL for a sales document. */
export const createSalesDocUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        deal_id: z.string().uuid(),
        file_name: z.string().min(1).max(255),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const deal = await getDealWorkspace(data.deal_id, context.userId);
    const safe = data.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${deal.workspace_id}/${deal.id}/${Date.now()}-${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not create upload URL");
    return { path: signed.path, token: signed.token };
  });

/** Register a sales document after upload (or as a link/manual note). */
export const registerSalesDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        deal_id: z.string().uuid(),
        name: z.string().min(1).max(255),
        document_type: z.enum([
          "rfp",
          "spec",
          "transcript",
          "deck",
          "email",
          "contract",
          "wireframe",
          "reference",
          "screenshot",
          "requirements",
          "other",
        ]),
        source: z.enum(["upload", "email", "link", "meeting", "manual_note"]),
        storage_path: z.string().max(500).optional().nullable(),
        external_url: z.string().url().max(2000).optional().nullable(),
        file_size_bytes: z.number().int().nonnegative().optional().nullable(),
        mime_type: z.string().max(120).optional().nullable(),
        raw_text: z.string().max(200_000).optional().nullable(),
        description: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const deal = await getDealWorkspace(data.deal_id, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sales_documents" as never)
      .insert({
        workspace_id: deal.workspace_id,
        deal_id: deal.id,
        name: data.name,
        document_type: data.document_type,
        source: data.source,
        storage_path: data.storage_path ?? null,
        external_url: data.external_url ?? null,
        file_size_bytes: data.file_size_bytes ?? null,
        mime_type: data.mime_type ?? null,
        raw_text: data.raw_text ?? null,
        description: data.description ?? null,
        uploaded_by: context.userId,
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSalesDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc } = await supabaseAdmin
      .from("sales_documents" as never)
      .select("id, workspace_id, storage_path")
      .eq("id", data.id)
      .single();
    if (!doc) throw new Error("Not found");
    const row = doc as { id: string; workspace_id: string; storage_path: string | null };
    const { data: m } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", row.workspace_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!m) throw new Error("Not a workspace member");
    if (row.storage_path) {
      await supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);
    }
    await supabaseAdmin.from("sales_documents" as never).delete().eq("id", row.id);
    return { ok: true };
  });

export const getSalesDocDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc } = await supabaseAdmin
      .from("sales_documents" as never)
      .select("id, workspace_id, storage_path")
      .eq("id", data.id)
      .single();
    if (!doc) throw new Error("Not found");
    const row = doc as { workspace_id: string; storage_path: string | null };
    const { data: m } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", row.workspace_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!m) throw new Error("Not a workspace member");
    if (!row.storage_path) return { url: null };
    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 600);
    return { url: signed?.signedUrl ?? null };
  });

/**
 * Scan a single sales document with AI to produce a summary + structured extraction
 * (features, integrations, platforms, requirements, constraints, budget, timeline).
 * For files uploaded to storage without raw_text, the caller must extract text client-side
 * (PDF/DOCX parsing) and pass it as raw_text before scanning, OR pass description text.
 */
export const scanSalesDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc } = await supabaseAdmin
      .from("sales_documents" as never)
      .select("*")
      .eq("id", data.id)
      .single();
    if (!doc) throw new Error("Not found");
    const d = doc as {
      id: string;
      workspace_id: string;
      name: string;
      document_type: string;
      raw_text: string | null;
      description: string | null;
    };
    const { data: m } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", d.workspace_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!m) throw new Error("Not a workspace member");

    const text = (d.raw_text ?? "") + "\n\n" + (d.description ?? "");
    if (text.trim().length < 20) {
      return {
        ok: false as const,
        error: "Document has no extractable text. Paste text or a description first.",
      };
    }

    const apiKey = await resolveOpenRouterKey(d.workspace_id);
    if (!apiKey) return { ok: false as const, error: OPENROUTER_KEY_MISSING_ERROR };

    const system = `You are a senior solutions architect reviewing pre-sales documents to extract structured project requirements.
Return STRICT JSON only with this schema:
{
  "summary": "2-4 sentence executive summary",
  "platforms": ["ios","android","web","macos","windows","api","other"],
  "integrations": ["array of third-party systems mentioned"],
  "key_features": [{"name":"...","description":"..."}],
  "technical_requirements": "stack/architecture/performance/scale points, or empty",
  "non_functional_requirements": "security/accessibility/SLAs, or empty",
  "compliance_requirements": "GDPR/HIPAA/SOC2/etc, or empty",
  "budget_min": null or number,
  "budget_max": null or number,
  "budget_currency": "USD"|null,
  "timeline_weeks": null or integer,
  "desired_start_date": null|"YYYY-MM-DD",
  "desired_launch_date": null|"YYYY-MM-DD",
  "stakeholders": [{"name":"...","role":"..."}],
  "risks": ["..."],
  "open_questions": ["..."],
  "confidence": { "<field_key>": 0.0..1.0 for every populated top-level field above },
  "snippets": { "<field_key>": "the exact quote from the document that supports this field (max 240 chars)" }
}
Confidence rules:
- 0.9+ explicit & unambiguous in the document
- 0.6-0.9 strongly implied
- <0.6 inferred or guessed (also flag it in open_questions)
Only include fields you can support; use empty arrays/strings/null when unknown.`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `DOCUMENT NAME: ${d.name}\nTYPE: ${d.document_type}\n\nCONTENT:\n${text.slice(0, 100_000)}`,
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) return { ok: false as const, error: "AI rate limit — try again shortly" };
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
    const raw = body.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const mm = raw.match(/\{[\s\S]*\}/);
      if (mm)
        try {
          parsed = JSON.parse(mm[0]);
        } catch {
          return { ok: false as const, error: "AI returned invalid JSON" };
        }
    }

    // Split into payload, confidence map, snippets
    const confidence = (parsed.confidence ?? {}) as Record<string, number>;
    const snippets = (parsed.snippets ?? {}) as Record<string, string>;
    const extracted = { ...parsed } as Record<string, unknown>;
    delete extracted.confidence;
    delete extracted.snippets;

    const confValues = Object.values(confidence).filter(
      (v) => typeof v === "number" && isFinite(v),
    );
    const overall =
      confValues.length > 0
        ? Number((confValues.reduce((s, v) => s + v, 0) / confValues.length).toFixed(2))
        : null;

    // Build diff vs previous scan
    const { data: prev } = await supabaseAdmin
      .from("sales_document_scans" as never)
      .select("version, ai_extracted")
      .eq("document_id", d.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prevRow = prev as { version: number; ai_extracted: Record<string, unknown> } | null;
    const prevExtracted = prevRow?.ai_extracted ?? {};
    const diff: Record<string, unknown> = {};
    const allKeys = new Set([...Object.keys(prevExtracted), ...Object.keys(extracted)]);
    for (const k of allKeys) {
      const before = (prevExtracted as Record<string, unknown>)[k];
      const after = extracted[k];
      const beforeStr = JSON.stringify(before ?? null);
      const afterStr = JSON.stringify(after ?? null);
      if (beforeStr === afterStr) continue;
      let change: string;
      if (before === undefined) change = "added";
      else if (after === undefined) change = "removed";
      else change = "changed";
      diff[k] = { before: before ?? null, after: after ?? null, change };
    }

    const nextVersion = (prevRow?.version ?? 0) + 1;

    // Write history row
    await supabaseAdmin.from("sales_document_scans" as never).insert({
      workspace_id: d.workspace_id,
      document_id: d.id,
      version: nextVersion,
      ai_summary: String(parsed.summary ?? ""),
      ai_extracted: extracted,
      confidence,
      overall_confidence: overall,
      diff,
      model: "google/gemini-2.5-flash",
      prompt_tokens: body.usage?.prompt_tokens ?? null,
      completion_tokens: body.usage?.completion_tokens ?? null,
      scanned_by: context.userId,
    } as never);

    // Stash snippets on the document so the brief generator can build citations
    const extractedWithSnippets = { ...extracted, _snippets: snippets, _confidence: confidence };

    await supabaseAdmin
      .from("sales_documents" as never)
      .update({
        ai_summary: String(parsed.summary ?? ""),
        ai_extracted: extractedWithSnippets,
        ai_scanned_at: new Date().toISOString(),
        scan_version: nextVersion,
        last_scan_confidence: overall,
      } as never)
      .eq("id", d.id);

    return {
      ok: true as const,
      extracted: extracted as Record<string, string | number | boolean | null | object>,
      version: nextVersion,
      overall_confidence: overall,
      diff: diff as Record<string, object>,
    };
  });

/** List scan history for a sales document. */
export const listDocumentScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ document_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc } = await supabaseAdmin
      .from("sales_documents" as never)
      .select("workspace_id")
      .eq("id", data.document_id)
      .single();
    if (!doc) throw new Error("Not found");
    const row = doc as { workspace_id: string };
    const { data: m } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", row.workspace_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!m) throw new Error("Not a workspace member");
    const { data: scans } = await supabaseAdmin
      .from("sales_document_scans" as never)
      .select("*")
      .eq("document_id", data.document_id)
      .order("version", { ascending: false });
    return scans ?? [];
  });
