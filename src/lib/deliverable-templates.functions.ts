import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  OPENROUTER_KEY_MISSING_ERROR,
  resolveOpenRouterKey,
} from "@/server/openrouter-key.server";
import { DELIVERABLE_KIND_MAP } from "./deliverable-kinds";

async function assertMember(workspaceId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Not a workspace member");
}

const SECTION_KINDS = [
  "text",
  "list",
  "table",
  "deliverables",
  "team",
  "timeline",
  "financials",
  "risks",
] as const;

const sectionDefSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "use snake_case (lowercase + underscores)"),
  label: z.string().min(1).max(120),
  kind: z.enum(SECTION_KINDS),
  required: z.boolean().optional(),
  ai_prompt: z.string().max(2000).optional(),
});

const schemaSchema = z.object({
  sections: z.array(sectionDefSchema).min(1).max(40),
});

const KIND_VALUES = [
  "sow",
  "proposal",
  "discovery_report",
  "tech_architecture",
  "business_case",
  "rfp_response",
  "pricing_options",
  "security_questionnaire",
  "mutual_action_plan",
  "capability_deck",
  "demo_script",
  "custom",
] as const;

export const listTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("sales_deliverable_templates" as never)
      .select("*")
      .eq("workspace_id", data.workspace_id)
      .order("kind", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        kind: z.enum(KIND_VALUES),
        name: z.string().min(1).max(120),
        description: z.string().max(1000).optional(),
        schema: schemaSchema,
        default_model: z.string().max(120).optional(),
        is_default: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    const { data: created, error } = await supabaseAdmin
      .from("sales_deliverable_templates" as never)
      .insert({
        workspace_id: data.workspace_id,
        kind: data.kind,
        name: data.name,
        description: data.description ?? null,
        schema: data.schema,
        default_model: data.default_model ?? "google/gemini-2.5-flash",
        is_default: data.is_default ?? false,
        is_system: false,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (created as { id: string }).id };
  });

export const updateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        template_id: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(1000).nullable().optional(),
        schema: schemaSchema.optional(),
        default_model: z.string().max(120).optional(),
        is_default: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: tpl } = await supabaseAdmin
      .from("sales_deliverable_templates" as never)
      .select("workspace_id, is_system")
      .eq("id", data.template_id)
      .maybeSingle();
    if (!tpl) throw new Error("Template not found");
    const row = tpl as { workspace_id: string; is_system: boolean };
    if (row.is_system) throw new Error("System templates can't be edited");
    await assertMember(row.workspace_id, context.userId);

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.schema !== undefined) patch.schema = data.schema;
    if (data.default_model !== undefined) patch.default_model = data.default_model;
    if (data.is_default !== undefined) patch.is_default = data.is_default;

    const { error } = await supabaseAdmin
      .from("sales_deliverable_templates" as never)
      .update(patch as never)
      .eq("id", data.template_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ template_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: tpl } = await supabaseAdmin
      .from("sales_deliverable_templates" as never)
      .select("workspace_id, is_system")
      .eq("id", data.template_id)
      .maybeSingle();
    if (!tpl) return { ok: true };
    const row = tpl as { workspace_id: string; is_system: boolean };
    if (row.is_system) throw new Error("System templates can't be deleted");
    await assertMember(row.workspace_id, context.userId);
    const { error } = await supabaseAdmin
      .from("sales_deliverable_templates" as never)
      .delete()
      .eq("id", data.template_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** AI: design a custom deliverable template from a natural-language description. */
export const generateTemplateWithAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        description: z.string().min(10).max(4000),
        base_kind: z.enum(KIND_VALUES).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);

    const apiKey = await resolveOpenRouterKey(data.workspace_id);
    if (!apiKey) return { ok: false as const, error: OPENROUTER_KEY_MISSING_ERROR };

    const baseHint = data.base_kind
      ? `Start from the ${data.base_kind} archetype but adapt.`
      : "Choose the most appropriate archetype.";

    const system = `You design pre-sales document templates for a consultancy.
Return STRICT JSON ONLY in this exact shape (no prose):
{
  "name": "short template name",
  "description": "1-2 sentences",
  "kind": "one of: ${KIND_VALUES.join("|")}",
  "sections": [
    {"key":"snake_case_key","label":"Human label","kind":"text|list|table|deliverables|team|timeline|financials|risks","required":true,"ai_prompt":"specific guidance for the AI when filling this section"}
  ]
}
Rules:
- 4–14 sections, ordered as a reader would consume them.
- keys: lowercase, snake_case, unique, max 40 chars.
- kinds: use "text" for prose, "list" for bullets, "financials" for pricing, "timeline" for phases, "team" for staffing, "risks" for risk register, "deliverables" for scope items, "table" for matrices.
- At least one required:true section.
- ${baseHint}`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.description },
        ],
        temperature: 0.3,
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
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) return { ok: false as const, error: "AI returned invalid JSON" };
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        return { ok: false as const, error: "AI returned invalid JSON" };
      }
    }

    const kind = (typeof parsed.kind === "string" && KIND_VALUES.includes(parsed.kind as never)
      ? parsed.kind
      : (data.base_kind ?? "custom")) as (typeof KIND_VALUES)[number];

    const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
    const seen = new Set<string>();
    const sections = rawSections
      .map((s) => {
        const obj = s as Record<string, unknown>;
        const key = String(obj.key ?? "")
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 40);
        if (!key || seen.has(key)) return null;
        seen.add(key);
        const kindVal = SECTION_KINDS.includes(obj.kind as never) ? obj.kind : "text";
        return {
          key,
          label: String(obj.label ?? key).slice(0, 120),
          kind: kindVal as (typeof SECTION_KINDS)[number],
          required: Boolean(obj.required),
          ai_prompt: typeof obj.ai_prompt === "string" ? obj.ai_prompt.slice(0, 2000) : undefined,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .slice(0, 40);

    if (!sections.length) return { ok: false as const, error: "AI produced no usable sections" };

    const name = String(parsed.name ?? "Custom template").slice(0, 120);
    const description = parsed.description ? String(parsed.description).slice(0, 1000) : null;

    const { data: created, error } = await supabaseAdmin
      .from("sales_deliverable_templates" as never)
      .insert({
        workspace_id: data.workspace_id,
        kind,
        name,
        description,
        schema: { sections },
        default_model: "google/gemini-2.5-flash",
        is_system: false,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: (created as { id: string }).id, name, kind, sections };
  });

/** Resolve effective sections for a deliverable: template overrides built-in kind. */
export async function resolveSections(
  templateId: string | null,
  kind: string,
): Promise<Array<{ key: string; label: string; kind: string; required?: boolean; ai_prompt?: string }>> {
  if (templateId) {
    const { data } = await supabaseAdmin
      .from("sales_deliverable_templates" as never)
      .select("schema")
      .eq("id", templateId)
      .maybeSingle();
    const s = (data as { schema?: { sections?: unknown[] } } | null)?.schema?.sections;
    if (Array.isArray(s) && s.length) return s as never;
  }
  return DELIVERABLE_KIND_MAP[kind]?.sections ?? [];
}
