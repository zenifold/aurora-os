import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

const t = (text: string): TipTapNode => ({ type: "text", text });
const p = (text: string): TipTapNode => ({ type: "paragraph", content: text ? [t(text)] : [] });
const h = (level: number, text: string): TipTapNode => ({ type: "heading", attrs: { level }, content: [t(text)] });
const ul = (items: string[]): TipTapNode => ({
  type: "bulletList",
  content: items.map((x) => ({ type: "listItem", content: [p(x)] })),
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

async function chat(apiKey: string, system: string, user: string, model = "xiaomi/mimo-v2-flash") {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/zenifold/aurora-os",
      "X-Title": "Aurora Pages",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 1500,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Enhance a page (or a selection) with AI: improve / summarize / continue.
 * Returns nodes the client can append to the document.
 */
export const enhancePage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        page_id: z.string().uuid(),
        action: z.enum(["improve", "summarize", "continue"]),
        selection_text: z.string().min(1).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Please sign in." };

    const { data: page } = await supabaseAdmin.from("pages").select("workspace_id, title").eq("id", data.page_id).single();
    if (!page) return { error: "Page not found" };

    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", page.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) return { error: "No access" };

    const apiKey = await getApiKey(page.workspace_id);
    if (!apiKey) return { error: "Add an OpenRouter API key in Settings → AI." };

    const system =
      data.action === "improve"
        ? "You are an editor. Rewrite the user's text to be clearer and more concise. Preserve meaning. Return only the rewritten prose, no preamble, no markdown headings."
        : data.action === "summarize"
        ? "Summarize the user's text into a short bulleted summary. Use 3-6 dash bullets, no preamble."
        : "Continue writing in the same voice and style. Add 2-4 sentences that naturally extend the text. Return only the continuation.";

    try {
      const out = await chat(apiKey, system, data.selection_text);
      const nodes: TipTapNode[] =
        data.action === "summarize"
          ? [
              h(3, "Summary"),
              ul(
                out
                  .split(/\r?\n/)
                  .map((l) => l.replace(/^[-•*]\s*/, "").trim())
                  .filter(Boolean),
              ),
            ]
          : out
              .split(/\n{2,}/)
              .map((para) => p(para.trim()))
              .filter((n) => (n.content?.length ?? 0) > 0);
      return { nodes: nodes as object[] };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

/**
 * Extract actionable tasks from page text and create them in the project.
 * Requires the page be project-scoped.
 */
export const pageToTasks = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        page_id: z.string().uuid(),
        selection_text: z.string().min(1).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Please sign in." };

    const { data: page } = await supabaseAdmin
      .from("pages")
      .select("workspace_id, scope, scope_id, title")
      .eq("id", data.page_id)
      .single();
    if (!page) return { error: "Page not found" };

    if (page.scope !== "project" || !page.scope_id) {
      return { error: "Move this page into a project to create tasks from it." };
    }

    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", page.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) return { error: "No access" };

    const apiKey = await getApiKey(page.workspace_id);
    if (!apiKey) return { error: "Add an OpenRouter API key in Settings → AI." };

    const system = `You extract actionable tasks from a document. Return ONLY a JSON object of the form:
{"tasks":[{"title":"…","priority":"low|medium|high"}]}
- 1 task per concrete action. Skip headings, descriptions, fluff.
- Titles should be short imperative phrases ("Implement X", "Review Y").
- 0 to 12 tasks max. If none, return {"tasks":[]}.`;

    try {
      const raw = await chat(apiKey, system, data.selection_text);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { error: "AI did not return JSON" };
      const parsed = JSON.parse(jsonMatch[0]) as {
        tasks?: { title?: string; priority?: string }[];
      };
      const tasks = (parsed.tasks ?? []).filter((t) => t.title && t.title.trim().length > 0).slice(0, 12);
      if (tasks.length === 0) return { created: 0, tasks: [] };

      const rows = tasks.map((t) => ({
        workspace_id: page.workspace_id,
        project_id: page.scope_id as string,
        title: t.title!.trim().slice(0, 200),
        priority: (["low", "medium", "high"].includes(t.priority ?? "") ? t.priority : "medium") as "low" | "medium" | "high",
        created_by: userId,
        status: "todo",
        task_type: "task",
        custom_values: { source: { page_id: data.page_id, page_title: page.title } },
      }));

      const { data: inserted, error } = await supabaseAdmin
        .from("tasks")
        .insert(rows as never)
        .select("id, title");
      if (error) return { error: error.message };

      // Backlinks
      if (inserted && inserted.length) {
        await supabaseAdmin.from("page_links").insert(
          inserted.map((t) => ({
            workspace_id: page.workspace_id,
            source_page_id: data.page_id,
            target_task_id: t.id,
          })),
        );
      }

      return { created: inserted?.length ?? 0, tasks: inserted ?? [] };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

/**
 * Create a brand-new page from an AI prompt — for slash command "/ai page about X".
 */
export const generatePage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        scope: z.enum(["workspace", "project", "folder", "contact", "task"]),
        scope_id: z.string().uuid().nullable().optional(),
        page_type: z.enum(["doc", "prd", "decision", "journal", "runbook", "meeting_notes"]).default("doc"),
        prompt: z.string().min(3).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Please sign in." };

    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) return { error: "No access" };

    const apiKey = await getApiKey(data.workspace_id);
    if (!apiKey) return { error: "Add an OpenRouter API key in Settings → AI." };

    const system = `You write structured documents. Return a short JSON object:
{"title":"…","icon":"📄","sections":[{"heading":"…","paragraphs":["…"],"bullets":["…"]}]}
- 3-6 sections.
- "icon" is a single emoji.
- Each section has either paragraphs or bullets (or both).
- No markdown, no preamble.`;

    try {
      const raw = await chat(apiKey, system, data.prompt);
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return { error: "AI did not return JSON" };
      const parsed = JSON.parse(m[0]) as {
        title?: string;
        icon?: string;
        sections?: { heading?: string; paragraphs?: string[]; bullets?: string[] }[];
      };

      const nodes: TipTapNode[] = [];
      for (const s of parsed.sections ?? []) {
        if (s.heading) nodes.push(h(2, s.heading));
        for (const para of s.paragraphs ?? []) nodes.push(p(para));
        if (s.bullets && s.bullets.length) nodes.push(ul(s.bullets));
      }
      if (nodes.length === 0) nodes.push(p(""));

      const content = { type: "doc", content: nodes };
      const { data: page, error } = await supabaseAdmin
        .from("pages")
        .insert({
          workspace_id: data.workspace_id,
          scope: data.scope,
          scope_id: data.scope_id ?? null,
          page_type: data.page_type,
          title: parsed.title ?? "Generated page",
          icon: parsed.icon ?? "✨",
          content: content as never,
          content_text: extractText(content),
          created_by: userId,
          updated_by: userId,
        } as never)
        .select()
        .single();
      if (error) return { error: error.message };

      return { page };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
