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

function textNode(text: string): TipTapNode { return { type: "text", text }; }
function paragraph(text: string): TipTapNode { return { type: "paragraph", content: [textNode(text)] }; }
function heading(level: number, text: string): TipTapNode {
  return { type: "heading", attrs: { level }, content: [textNode(text)] };
}
function bulletList(items: string[]): TipTapNode {
  return {
    type: "bulletList",
    content: items.map((t) => ({
      type: "listItem",
      content: [paragraph(t)],
    })),
  };
}
function extractText(doc: unknown): string {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as TipTapNode;
    if (node.text) out.push(node.text);
    if (node.content) node.content.forEach(walk);
  };
  walk(doc);
  return out.join(" ").slice(0, 50000);
}

/**
 * Append an AI-generated journal entry to a project's journal page,
 * summarizing recent task activity, status changes, and decisions.
 */
export const updateProjectJournal = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ project_id: z.string().uuid(), page_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const authHeader = getRequest()?.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return { error: "Please sign in again." };

    const { data: authData } = await supabaseAdmin.auth.getUser(token);
    const userId = authData.user?.id;
    if (!userId) return { error: "Session expired." };

    const { data: page } = await supabaseAdmin
      .from("pages")
      .select("*")
      .eq("id", data.page_id)
      .maybeSingle();
    if (!page) return { error: "Page not found." };

    const workspace_id = page.workspace_id as string;

    const { data: membership } = await supabaseAdmin
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return { error: "Not a workspace member." };

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("name, description")
      .eq("id", data.project_id)
      .maybeSingle();

    const since = page.ai_last_summarized_at ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Recent activity: created/updated tasks, comments, status history
    const [{ data: tasks }, { data: comments }, { data: history }, { data: milestones }] = await Promise.all([
      supabaseAdmin
        .from("tasks")
        .select("id, title, status, priority, due_date, updated_at, created_at")
        .eq("project_id", data.project_id)
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(40),
      supabaseAdmin
        .from("comments")
        .select("id, task_id, content, created_at")
        .eq("workspace_id", workspace_id)
        .gte("created_at", since)
        .limit(30),
      supabaseAdmin
        .from("task_status_history")
        .select("task_id, from_status_name, to_status_name, entered_at")
        .eq("workspace_id", workspace_id)
        .gte("entered_at", since)
        .limit(50),
      supabaseAdmin
        .from("milestones")
        .select("name, status, target_date, actual_date, updated_at")
        .eq("project_id", data.project_id)
        .gte("updated_at", since)
        .limit(20),
    ]);

    const summaryInput = {
      project: project?.name,
      since,
      tasks: (tasks ?? []).map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, due: t.due_date })),
      transitions: (history ?? []).map((h) => ({ from: h.from_status_name, to: h.to_status_name, at: h.entered_at })),
      comments: (comments ?? []).map((c) => ({ at: c.created_at, text: extractText(c.content).slice(0, 240) })),
      milestones: milestones ?? [],
    };

    if (
      summaryInput.tasks.length === 0 &&
      summaryInput.transitions.length === 0 &&
      summaryInput.comments.length === 0 &&
      summaryInput.milestones.length === 0
    ) {
      return { error: "No new activity to summarize." };
    }

    const { data: secret } = await supabaseAdmin
      .from("workspace_ai_secrets")
      .select("openrouter_api_key")
      .eq("workspace_id", workspace_id)
      .maybeSingle();
    const apiKey = secret?.openrouter_api_key;
    if (!apiKey) return { error: "No OpenRouter API key configured. Add one in Settings → AI." };

    const systemPrompt =
      "You are a project chronicler. Produce a concise, factual journal entry from raw activity data. Output ONLY JSON with this shape: {\"summary\":\"1-2 sentence overview\",\"highlights\":[\"…\"],\"decisions\":[\"…\"],\"risks\":[\"…\"],\"next_steps\":[\"…\"]}.";

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/zenifold/aurora-os",
        "X-Title": "Aurora Project Journal",
      },
      body: JSON.stringify({
        model: "xiaomi/mimo-v2-flash",
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Project: ${project?.name ?? ""}\nActivity since ${since}:\n\n${JSON.stringify(summaryInput).slice(0, 12000)}` },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { error: `AI ${res.status}: ${t.slice(0, 200)}` };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { summary?: string; highlights?: string[]; decisions?: string[]; risks?: string[]; next_steps?: string[] } = {};
    try { parsed = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch { /* noop */ }
    }

    const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const newBlocks: TipTapNode[] = [
      heading(2, dateLabel),
      ...(parsed.summary ? [paragraph(parsed.summary)] : []),
      ...(parsed.highlights?.length ? [heading(3, "Highlights"), bulletList(parsed.highlights)] : []),
      ...(parsed.decisions?.length ? [heading(3, "Decisions"), bulletList(parsed.decisions)] : []),
      ...(parsed.risks?.length ? [heading(3, "Risks"), bulletList(parsed.risks)] : []),
      ...(parsed.next_steps?.length ? [heading(3, "Next steps"), bulletList(parsed.next_steps)] : []),
      { type: "horizontalRule" },
    ];

    const existing = (page.content as unknown as { type: string; content?: TipTapNode[] }) ?? { type: "doc", content: [] };
    const merged: TipTapNode = {
      type: "doc",
      content: [...newBlocks, ...(existing.content ?? [])],
    };

    const { error: updErr } = await supabaseAdmin
      .from("pages")
      .update({
        content: merged as never,
        content_text: extractText(merged),
        ai_last_summarized_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", page.id);
    if (updErr) return { error: updErr.message };

    return { ok: true, summary: parsed.summary ?? null };
  });
