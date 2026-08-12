import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Document-level AI for Pages: chat with a doc, run transforms (rewrite,
 * expand, condense, restructure, tone shift, add section, generate TOC),
 * save AI-generated versions, restore, and diff.
 */

interface TipTapNode {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  text?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  marks?: { type: string; attrs?: Record<string, any> }[];
}

type ChatMsg = { role: "user" | "assistant" | "system"; content: string; created_at?: string };

const txt = (s: string): TipTapNode => ({ type: "text", text: s });
const para = (s: string): TipTapNode => ({ type: "paragraph", content: s ? [txt(s)] : [] });
const heading = (level: number, s: string): TipTapNode => ({
  type: "heading",
  attrs: { level },
  content: [txt(s)],
});
const bullets = (items: string[]): TipTapNode => ({
  type: "bulletList",
  content: items.filter(Boolean).map((x) => ({ type: "listItem", content: [para(x)] })),
});

function extractText(doc: unknown): string {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as TipTapNode;
    if (node.text) out.push(node.text);
    if (node.content) node.content.forEach(walk);
  };
  walk(doc);
  return out.join(" ").slice(0, 60000);
}

async function authedUserId(): Promise<string | null> {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

async function getApiKey(workspaceId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("workspace_ai_secrets")
    .select("openrouter_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data?.openrouter_api_key ?? null;
}

async function chat(
  apiKey: string,
  messages: { role: string; content: string }[],
  model = "xiaomi/mimo-v2-flash",
  opts: { temperature?: number; max_tokens?: number; json?: boolean } = {},
) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/zenifold/aurora-os",
      "X-Title": "Aurora Doc AI",
    },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.max_tokens ?? 2200,
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

async function ensurePageAccess(pageId: string, userId: string) {
  const { data: page } = await supabaseAdmin
    .from("pages")
    .select("id, workspace_id, title, content, content_text, page_type, scope, scope_id")
    .eq("id", pageId)
    .single();
  if (!page) return { error: "Page not found" as const };
  const { data: member } = await supabaseAdmin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", page.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return { error: "No access" as const };
  return { page };
}

/* -------------------------------------------------------------------------- */
/* Doc Chat                                                                   */
/* -------------------------------------------------------------------------- */

export const docChat = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        page_id: z.string().uuid(),
        thread_id: z.string().uuid().nullable().optional(),
        message: z.string().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Please sign in." as const };
    const acc = await ensurePageAccess(data.page_id, userId);
    if ("error" in acc) return acc;
    const { page } = acc;

    const apiKey = await getApiKey(page.workspace_id);
    if (!apiKey) return { error: "Add an OpenRouter API key in Settings → AI." as const };

    // Load or create the thread
    let threadId = data.thread_id ?? null;
    let history: ChatMsg[] = [];
    if (threadId) {
      const { data: th } = await supabaseAdmin
        .from("page_ai_threads")
        .select("id, messages")
        .eq("id", threadId)
        .eq("user_id", userId)
        .maybeSingle();
      if (th) history = (th.messages as ChatMsg[]) ?? [];
      else threadId = null;
    }

    const userMsg: ChatMsg = { role: "user", content: data.message, created_at: new Date().toISOString() };
    const docText = (page.content_text || extractText(page.content)).slice(0, 12000);

    const system = `You are a writing collaborator embedded inside a document called "${page.title}".
You can answer questions about the document, suggest edits in plain prose, summarize sections, or brainstorm.
When proposing changes, be specific and quote the relevant lines. Keep answers under ~250 words unless asked for more.

DOCUMENT CONTENT:
"""
${docText}
"""`;

    const reply = await chat(
      apiKey,
      [
        { role: "system", content: system },
        ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: data.message },
      ],
      "xiaomi/mimo-v2-flash",
      { max_tokens: 1200 },
    );

    const aiMsg: ChatMsg = { role: "assistant", content: reply, created_at: new Date().toISOString() };
    const newMessages = [...history, userMsg, aiMsg];

    if (threadId) {
      await supabaseAdmin
        .from("page_ai_threads")
        .update({ messages: newMessages as never })
        .eq("id", threadId);
    } else {
      const { data: created } = await supabaseAdmin
        .from("page_ai_threads")
        .insert({
          workspace_id: page.workspace_id,
          page_id: page.id,
          user_id: userId,
          messages: newMessages as never,
        } as never)
        .select("id")
        .single();
      threadId = created?.id ?? null;
    }

    return { thread_id: threadId, reply };
  });

export const getDocThread = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ page_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Please sign in." as const };
    const { data: thread } = await supabaseAdmin
      .from("page_ai_threads")
      .select("id, messages, updated_at")
      .eq("page_id", data.page_id)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { thread };
  });

export const clearDocThread = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ thread_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Please sign in." as const };
    await supabaseAdmin.from("page_ai_threads").delete().eq("id", data.thread_id).eq("user_id", userId);
    return { ok: true };
  });

/* -------------------------------------------------------------------------- */
/* Transforms — produce a proposed full-document content + summary            */
/* -------------------------------------------------------------------------- */

const TRANSFORMS = [
  "rewrite",
  "expand",
  "condense",
  "restructure",
  "tone_shift",
  "add_section",
  "toc",
  "custom",
] as const;

const TRANSFORM_PROMPTS: Record<(typeof TRANSFORMS)[number], string> = {
  rewrite: "Rewrite the document to be clearer and tighter while preserving every key point.",
  expand: "Expand the document with more detail, depth, and supporting examples. Roughly double its length.",
  condense: "Condense the document to about half its length. Keep the structure and essentials, drop fluff.",
  restructure: "Restructure the document with stronger flow: clearer headings, logical ordering, no lost content.",
  tone_shift: "Rewrite the document in a more professional, polished tone. Preserve all content and meaning.",
  add_section: "Add a useful new section that the document is missing. Keep all existing content intact.",
  toc: "Generate a table of contents and prepend it to the document. Keep all existing content.",
  custom: "",
};

const SECTION_SHAPE = `Return ONLY a JSON object:
{
  "title": "...",
  "icon": "📄",
  "summary": "1-2 sentence description of what changed compared to the original.",
  "sections": [
    { "heading": "...", "paragraphs": ["..."], "bullets": ["..."] }
  ]
}
Sections may have paragraphs, bullets, or both. 3-12 sections.`;

function jsonToDoc(payload: {
  title?: string;
  sections?: { heading?: string; paragraphs?: string[]; bullets?: string[] }[];
}): { content: { type: "doc"; content: TipTapNode[] }; title: string } {
  const nodes: TipTapNode[] = [];
  for (const s of payload.sections ?? []) {
    if (s.heading) nodes.push(heading(2, s.heading));
    for (const p of s.paragraphs ?? []) if (p?.trim()) nodes.push(para(p.trim()));
    if (s.bullets && s.bullets.length) nodes.push(bullets(s.bullets));
  }
  if (nodes.length === 0) nodes.push(para(""));
  return { content: { type: "doc", content: nodes }, title: payload.title ?? "Untitled" };
}

export const transformDoc = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        page_id: z.string().uuid(),
        action: z.enum(TRANSFORMS),
        custom_prompt: z.string().min(1).max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Please sign in." as const };
    const acc = await ensurePageAccess(data.page_id, userId);
    if ("error" in acc) return acc;
    const { page } = acc;

    const apiKey = await getApiKey(page.workspace_id);
    if (!apiKey) return { error: "Add an OpenRouter API key in Settings → AI." as const };

    const docText = (page.content_text || extractText(page.content)).slice(0, 14000);
    const instr = data.action === "custom" ? data.custom_prompt ?? "" : TRANSFORM_PROMPTS[data.action];
    if (!instr) return { error: "Custom prompt required" as const };

    const system = `You are a document AI. The user will give you a document and an instruction.
${SECTION_SHAPE}
No markdown, no preamble, no commentary outside the JSON.`;
    const user = `INSTRUCTION:
${instr}

ORIGINAL DOCUMENT TITLE: ${page.title}

ORIGINAL DOCUMENT:
"""
${docText}
"""`;

    let raw = "";
    try {
      raw = await chat(apiKey, [
        { role: "system", content: system },
        { role: "user", content: user },
      ], "xiaomi/mimo-v2-flash", { max_tokens: 4000, json: true });
    } catch (e) {
      return { error: (e as Error).message };
    }

    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { error: "AI did not return JSON" as const };
    let parsed: {
      title?: string;
      icon?: string;
      summary?: string;
      sections?: { heading?: string; paragraphs?: string[]; bullets?: string[] }[];
    };
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return { error: "Could not parse AI output" as const };
    }

    const { content, title } = jsonToDoc(parsed);
    return {
      proposed_title: title || page.title,
      proposed_content: content,
      summary: parsed.summary ?? `Applied transform: ${data.action}`,
      action: data.action,
      prompt: instr,
    };
  });

/* -------------------------------------------------------------------------- */
/* Versioning                                                                 */
/* -------------------------------------------------------------------------- */

export const saveDocVersion = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        page_id: z.string().uuid(),
        title: z.string().min(1).max(500),
        content: z.unknown(),
        version_label: z.string().max(120).optional(),
        generated_by_ai: z.boolean().optional(),
        ai_prompt: z.string().max(4000).optional(),
        ai_model: z.string().max(120).optional(),
        changes_summary: z.string().max(4000).optional(),
        parent_version_id: z.string().uuid().nullable().optional(),
        status: z.enum(["draft", "review", "published", "archived"]).optional(),
        replace_current: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Please sign in." as const };
    const acc = await ensurePageAccess(data.page_id, userId);
    if ("error" in acc) return acc;
    const { page } = acc;

    const { data: version, error } = await supabaseAdmin
      .from("page_revisions")
      .insert({
        workspace_id: page.workspace_id,
        page_id: page.id,
        title: data.title,
        content: data.content as never,
        edited_by: userId,
        version_label: data.version_label ?? null,
        generated_by_ai: data.generated_by_ai ?? false,
        ai_prompt: data.ai_prompt ?? null,
        ai_model: data.ai_model ?? null,
        changes_summary: data.changes_summary ?? null,
        parent_version_id: data.parent_version_id ?? null,
        status: data.status ?? "draft",
      } as never)
      .select("id, version_number, version_label, created_at")
      .single();
    if (error) return { error: error.message };

    if (data.replace_current) {
      const newText = extractText(data.content);
      await supabaseAdmin
        .from("pages")
        .update({
          title: data.title,
          content: data.content as never,
          content_text: newText,
          updated_by: userId,
        } as never)
        .eq("id", page.id);
    }

    return { version };
  });

export const listDocVersions = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ page_id: z.string().uuid(), limit: z.number().min(1).max(200).optional() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Please sign in." as const };
    const acc = await ensurePageAccess(data.page_id, userId);
    if ("error" in acc) return acc;

    const { data: versions } = await supabaseAdmin
      .from("page_revisions")
      .select("id, version_number, version_label, status, generated_by_ai, ai_prompt, ai_model, changes_summary, edited_by, created_at, title")
      .eq("page_id", data.page_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    return { versions: versions ?? [] };
  });

export const getDocVersion = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ version_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Please sign in." as const };
    const { data: v } = await supabaseAdmin
      .from("page_revisions")
      .select("*")
      .eq("id", data.version_id)
      .single();
    if (!v) return { error: "Version not found" as const };
    const acc = await ensurePageAccess(v.page_id, userId);
    if ("error" in acc) return acc;
    return { version: v };
  });

export const restoreDocVersion = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ version_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Please sign in." as const };
    const { data: v } = await supabaseAdmin
      .from("page_revisions")
      .select("id, page_id, workspace_id, title, content")
      .eq("id", data.version_id)
      .single();
    if (!v) return { error: "Version not found" as const };
    const acc = await ensurePageAccess(v.page_id, userId);
    if ("error" in acc) return acc;

    // Snapshot a new version that points to the restored one as parent
    const newText = extractText(v.content);
    await supabaseAdmin
      .from("page_revisions")
      .insert({
        workspace_id: v.workspace_id,
        page_id: v.page_id,
        title: v.title,
        content: v.content as never,
        edited_by: userId,
        parent_version_id: v.id,
        changes_summary: `Restored from earlier version`,
        status: "draft",
      } as never);

    await supabaseAdmin
      .from("pages")
      .update({
        title: v.title,
        content: v.content as never,
        content_text: newText,
        updated_by: userId,
      } as never)
      .eq("id", v.page_id);

    return { ok: true };
  });

export const updateVersionStatus = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        version_id: z.string().uuid(),
        status: z.enum(["draft", "review", "published", "archived"]),
        version_label: z.string().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Please sign in." as const };
    const { data: v } = await supabaseAdmin
      .from("page_revisions")
      .select("id, page_id")
      .eq("id", data.version_id)
      .single();
    if (!v) return { error: "Version not found" as const };
    const acc = await ensurePageAccess(v.page_id, userId);
    if ("error" in acc) return acc;
    const patch: Record<string, unknown> = { status: data.status };
    if (data.version_label !== undefined) patch.version_label = data.version_label;
    await supabaseAdmin.from("page_revisions").update(patch as never).eq("id", data.version_id);
    return { ok: true };
  });
