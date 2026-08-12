import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  OPENROUTER_KEY_MISSING_ERROR,
  resolveOpenRouterKey,
} from "@/server/openrouter-key.server";

/**
 * Server-only helper that generates a structured scope checklist for a deal
 * from its latest discovery brief + scanned sales documents. Used by both
 * the `generateScopeChecklist` server fn and the auto-trigger that runs when
 * a discovery brief is approved.
 *
 * Returns a small status object; never throws for AI/gateway failures so
 * callers can decide whether to surface them.
 */
export async function runScopeChecklistGeneration(params: {
  workspaceId: string;
  dealId: string;
  dealTitle: string;
  userId: string;
  /** Replace existing AI-generated items. Manual items are always preserved. */
  replace: boolean;
}): Promise<
  | { ok: true; count: number }
  | { ok: false; error: string }
> {
  const { workspaceId, dealId, dealTitle, userId, replace } = params;

  const { data: brief } = await supabaseAdmin
    .from("discovery_briefs" as never)
    .select("*")
    .eq("deal_id", dealId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!brief) return { ok: false, error: "No discovery brief yet" };

  const { data: docs } = await supabaseAdmin
    .from("sales_documents" as never)
    .select("id, name, document_type, ai_summary, ai_extracted")
    .eq("deal_id", dealId);

  const apiKey = await resolveOpenRouterKey(workspaceId);
  if (!apiKey) return { ok: false, error: OPENROUTER_KEY_MISSING_ERROR };

  const system = `You are a delivery lead converting a discovery brief into a structured SCOPE CHECKLIST for a SOW.
Each checklist item is a single, verifiable requirement that we will commit to (or explicitly exclude) in the SOW.
Return STRICT JSON only:
{
  "items": [
    {
      "area": "auth | onboarding | core_app | admin | integrations | data | infra | ai | analytics | compliance | design | mobile | web | api | other",
      "requirement": "single concrete requirement (1 sentence, actionable, testable)",
      "details": "optional clarifying notes",
      "priority": "must_have | should_have | nice_to_have",
      "status": "in_scope | needs_clarification | out_of_scope",
      "confidence": 0.0-1.0,
      "source_document_id": "uuid or null — the doc id that supports this item",
      "source_snippet": "verbatim quote from that doc supporting this item (<=240 chars), or null"
    }
  ]
}
Rules:
- One requirement per item. No bundled "X and Y" items.
- Group by area; cover ALL features/integrations/platforms/non-functional/compliance items from the brief.
- Mark items where the brief explicitly excludes something as out_of_scope.
- Mark items the brief flags as unknowns/open questions as needs_clarification with priority=should_have.
- Use the document_ids exactly as provided. If no doc supports it, source_document_id=null.
- Aim for 15-40 items. Do not invent requirements unsupported by the brief.`;

  const docList = ((docs ?? []) as Array<{
    id: string;
    name: string;
    document_type: string;
    ai_summary: string | null;
    ai_extracted: Record<string, unknown> | null;
  }>);

  const userMsg = `DEAL: ${dealTitle}

DISCOVERY BRIEF:
${JSON.stringify(brief, null, 2)}

SCANNED DOCUMENTS:
${docList.map((d) => `- ${d.id} [${d.document_type}] ${d.name}\n  extracted: ${JSON.stringify(d.ai_extracted ?? {}).slice(0, 2000)}`).join("\n")}`;

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI gateway unreachable" };
  }
  if (res.status === 429) return { ok: false, error: "AI rate limit — try again shortly" };
  if (res.status === 402) return { ok: false, error: "AI credits exhausted. Add credits in Settings → Usage." };
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `AI gateway ${res.status}: ${t.slice(0, 200)}` };
  }

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = body.choices?.[0]?.message?.content ?? "{}";
  let parsed: { items?: unknown } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        return { ok: false, error: "AI returned invalid JSON" };
      }
    }
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const validDocIds = new Set(docList.map((d) => d.id));
  const b = brief as { id: string };

  if (replace) {
    await supabaseAdmin
      .from("scope_checklist_items" as never)
      .delete()
      .eq("deal_id", dealId)
      .eq("ai_generated", true);
  }

  const rows = items
    .map((it, idx) => {
      const o = it as Record<string, unknown>;
      const requirement = typeof o.requirement === "string" ? o.requirement.trim() : "";
      if (!requirement) return null;
      const sourceDocId =
        typeof o.source_document_id === "string" && validDocIds.has(o.source_document_id)
          ? o.source_document_id
          : null;
      return {
        workspace_id: workspaceId,
        deal_id: dealId,
        brief_id: b.id,
        area: typeof o.area === "string" ? o.area : "other",
        requirement,
        details: typeof o.details === "string" ? o.details : null,
        priority: ["must_have", "should_have", "nice_to_have"].includes(String(o.priority))
          ? String(o.priority)
          : "must_have",
        status: ["in_scope", "out_of_scope", "needs_clarification"].includes(String(o.status))
          ? String(o.status)
          : "in_scope",
        confidence:
          typeof o.confidence === "number" && o.confidence >= 0 && o.confidence <= 1
            ? Number(o.confidence.toFixed(2))
            : null,
        source_document_id: sourceDocId,
        source_snippet: typeof o.source_snippet === "string" ? o.source_snippet.slice(0, 500) : null,
        ai_generated: true,
        position: idx,
        created_by: userId,
      };
    })
    .filter((r): r is NonNullable<typeof r> => !!r);

  if (rows.length) {
    const { error } = await supabaseAdmin
      .from("scope_checklist_items" as never)
      .insert(rows as never);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, count: rows.length };
}
