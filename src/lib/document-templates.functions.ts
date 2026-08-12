import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DOC_KINDS = [
  "proposal",
  "sow",
  "contract",
  "brief",
  "recap",
  "status_report",
  "case_study",
  "report",
  "generic",
] as const;

const DOC_STATUSES = ["draft", "review", "sent", "signed", "archived"] as const;

/** List branded templates available in a workspace. */
export const listDocumentTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        doc_kind: z.enum(DOC_KINDS).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("pages")
      .select("id, title, icon, doc_kind, updated_at, content")
      .eq("workspace_id", data.workspace_id)
      .eq("is_template", true)
      .eq("is_archived", false)
      .order("doc_kind", { ascending: true })
      .order("title", { ascending: true });
    if (data.doc_kind) q = q.eq("doc_kind", data.doc_kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** List branded documents for a specific client. */
export const listClientDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ client_account_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("pages")
      .select("id, workspace_id, client_account_id, title, icon, doc_kind, doc_status, template_source_id, brand_kit_id, is_template, created_at, updated_at")
      .eq("client_account_id", data.client_account_id)
      .eq("is_template", false)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Clone a template into a new client document. */
export const createDocumentFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        template_id: z.string().uuid().nullable().optional(),
        doc_kind: z.enum(DOC_KINDS).optional(),
        client_account_id: z.string().uuid().nullable().optional(),
        title: z.string().min(1).max(200),
        brand_kit_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let content: unknown = { type: "doc", content: [{ type: "paragraph" }] };
    let icon: string | null = null;
    let kind: string | null = data.doc_kind ?? null;

    if (data.template_id) {
      const { data: tmpl, error: tErr } = await supabase
        .from("pages")
        .select("content, icon, doc_kind")
        .eq("id", data.template_id)
        .single();
      if (tErr) throw new Error(tErr.message);
      content = tmpl.content;
      icon = tmpl.icon;
      kind = tmpl.doc_kind ?? kind;
    }

    const { data: inserted, error } = await supabase
      .from("pages")
      .insert({
        workspace_id: data.workspace_id,
        scope: "workspace",
        scope_id: null,
        title: data.title,
        icon,
        page_type: "doc",
        is_template: false,
        doc_kind: kind,
        doc_status: "draft",
        template_source_id: data.template_id ?? null,
        brand_kit_id: data.brand_kit_id ?? null,
        client_account_id: data.client_account_id ?? null,
        content: content as never,
        content_text: "",
        created_by: userId,
        updated_by: userId,
      })
      .select("id, title")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

/** Update doc status (Draft → Review → Sent → Signed). */
export const setDocumentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        page_id: z.string().uuid(),
        doc_status: z.enum(DOC_STATUSES),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("pages")
      .update({ doc_status: data.doc_status })
      .eq("id", data.page_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Promote any page into a reusable workspace template. */
export const saveDocumentAsTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        page_id: z.string().uuid(),
        title: z.string().min(1).max(200),
        doc_kind: z.enum(DOC_KINDS),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src, error: sErr } = await supabase
      .from("pages")
      .select("workspace_id, icon, content")
      .eq("id", data.page_id)
      .single();
    if (sErr) throw new Error(sErr.message);
    const { data: tmpl, error } = await supabase
      .from("pages")
      .insert({
        workspace_id: src.workspace_id,
        scope: "workspace",
        title: data.title,
        icon: src.icon,
        page_type: "doc",
        is_template: true,
        doc_kind: data.doc_kind,
        content: src.content as never,
        content_text: "",
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return tmpl;
  });

/** AI-generate a branded document from a free-form prompt. */
export const generateClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        client_account_id: z.string().uuid().nullable().optional(),
        doc_kind: z.enum(DOC_KINDS),
        title: z.string().min(1).max(200),
        prompt: z.string().min(3).max(4000),
        template_id: z.string().uuid().nullable().optional(),
        brand_kit_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getApiKey } = await import("@/server/ai-create.server");
    const { mdToTipTap } = await import("@/server/md-to-tiptap.server");

    const apiKey = await getApiKey(data.workspace_id);
    if (!apiKey) {
      return { ok: false as const, error: "No AI API key configured. Add one in Settings → AI agents." };
    }

    // Pull client context for grounding
    let clientName = "the client";
    if (data.client_account_id) {
      const { data: acct } = await supabase
        .from("client_accounts")
        .select("name")
        .eq("id", data.client_account_id)
        .maybeSingle();
      if (acct?.name) clientName = acct.name;
    }

    // Pull template content as a structural hint if provided
    let templateMarkdown = "";
    if (data.template_id) {
      const { data: tmpl } = await supabase
        .from("pages")
        .select("content_text")
        .eq("id", data.template_id)
        .maybeSingle();
      if (tmpl?.content_text) templateMarkdown = tmpl.content_text.slice(0, 4000);
    }

    const sys = `You write polished branded ${data.doc_kind.replace("_", " ")} documents.
Reply with JSON: { "markdown": "..." }.
Use # / ## / ### headings, - bullets, and **bold**. Be concrete, on-brand, and concise.
Document is for client: ${clientName}.`;

    const userMsg = [
      `Document kind: ${data.doc_kind}`,
      `Title: ${data.title}`,
      `Brief: ${data.prompt}`,
      templateMarkdown ? `\nFollow this template structure:\n${templateMarkdown}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/zenifold/aurora-os",
        "X-Title": "Aurora Branded Documents",
      },
      body: JSON.stringify({
        model: "xiaomi/mimo-v2-flash",
        temperature: 0.4,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false as const, error: `AI error ${res.status}` };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const txt = json.choices?.[0]?.message?.content ?? "{}";
    let markdown = "";
    try {
      const parsed = JSON.parse(txt) as { markdown?: string };
      markdown = parsed.markdown ?? "";
    } catch {
      markdown = txt;
    }
    if (!markdown.trim()) {
      return { ok: false as const, error: "AI returned an empty document." };
    }

    const content = mdToTipTap(markdown);
    const extractText = (doc: unknown): string => {
      if (!doc || typeof doc !== "object") return "";
      const out: string[] = [];
      const walk = (n: unknown) => {
        if (!n || typeof n !== "object") return;
        const node = n as { text?: string; content?: unknown[] };
        if (typeof node.text === "string") out.push(node.text);
        if (Array.isArray(node.content)) node.content.forEach(walk);
      };
      walk(doc);
      return out.join(" ").slice(0, 50000);
    };

    const { data: inserted, error } = await supabase
      .from("pages")
      .insert({
        workspace_id: data.workspace_id,
        scope: "workspace",
        title: data.title,
        page_type: "doc",
        is_template: false,
        doc_kind: data.doc_kind,
        doc_status: "draft",
        template_source_id: data.template_id ?? null,
        brand_kit_id: data.brand_kit_id ?? null,
        client_account_id: data.client_account_id ?? null,
        content: content as never,
        content_text: extractText(content),
        ai_managed: true,
        ai_last_summarized_at: new Date().toISOString(),
        created_by: userId,
        updated_by: userId,
      })
      .select("id, title")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, page: inserted };
  });

/** Brand kits */
export const listBrandKits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        client_account_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("brand_kits")
      .select("*")
      .eq("workspace_id", data.workspace_id);
    if (data.client_account_id === null) {
      q = q.is("client_account_id", null);
    } else if (data.client_account_id) {
      q = q.or(`client_account_id.eq.${data.client_account_id},client_account_id.is.null`);
    }
    const { data: rows, error } = await q.order("is_default", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertBrandKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        workspace_id: z.string().uuid(),
        client_account_id: z.string().uuid().nullable().optional(),
        name: z.string().min(1).max(120),
        logo_url: z.string().url().nullable().optional(),
        cover_url: z.string().url().nullable().optional(),
        primary_color: z.string().min(1).max(32),
        accent_color: z.string().min(1).max(32),
        text_color: z.string().min(1).max(32),
        font_heading: z.string().min(1).max(80),
        font_body: z.string().min(1).max(80),
        footer_text: z.string().max(500).nullable().optional(),
        is_default: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      workspace_id: data.workspace_id,
      client_account_id: data.client_account_id ?? null,
      name: data.name,
      logo_url: data.logo_url ?? null,
      cover_url: data.cover_url ?? null,
      primary_color: data.primary_color,
      accent_color: data.accent_color,
      text_color: data.text_color,
      font_heading: data.font_heading,
      font_body: data.font_body,
      footer_text: data.footer_text ?? null,
      is_default: data.is_default ?? false,
      created_by: userId,
    };
    if (data.id) {
      const { data: updated, error } = await supabase
        .from("brand_kits")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: inserted, error } = await supabase
      .from("brand_kits")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const deleteBrandKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("brand_kits").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
