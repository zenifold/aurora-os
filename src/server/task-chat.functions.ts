import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  OPENROUTER_KEY_MISSING_ERROR,
  resolveOpenRouterKey,
} from "@/server/openrouter-key.server";

/**
 * Task AI Chat — conversational assistant scoped to a single task.
 * The model can call tools to mutate the task, post comments / replies,
 * create linked pages / plans / canvases, etc.
 */

const MAX_ITERATIONS = 8;

interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
  name?: string;
}

interface ToolLog {
  iteration: number;
  name: string;
  arguments: Record<string, unknown>;
  result: { ok: boolean; data?: unknown; error?: string };
  at: string;
}

async function authedUserId(): Promise<string | null> {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

function mdToTipTap(md: string) {
  const lines = md.split(/\r?\n/);
  const nodes: unknown[] = [];
  let bullets: string[] | null = null;
  const flush = () => {
    if (bullets && bullets.length) {
      nodes.push({
        type: "bulletList",
        content: bullets.map((b) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: b }] }],
        })),
      });
    }
    bullets = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      nodes.push({
        type: "heading",
        attrs: { level: h[1].length },
        content: [{ type: "text", text: h[2] }],
      });
      continue;
    }
    const b = /^[-*]\s+(.*)$/.exec(line);
    if (b) {
      bullets = bullets ?? [];
      bullets.push(b[1]);
      continue;
    }
    flush();
    nodes.push({ type: "paragraph", content: [{ type: "text", text: line }] });
  }
  flush();
  if (nodes.length === 0) nodes.push({ type: "paragraph" });
  return { type: "doc", content: nodes };
}

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "update_task",
      description:
        "Update fields on the current task. Only include fields you want to change.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description_markdown: {
            type: "string",
            description: "Replace description with this markdown body.",
          },
          append_to_description_markdown: {
            type: "string",
            description: "Append this markdown to the existing description instead of replacing.",
          },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          due_date: { type: "string", description: "YYYY-MM-DD or null to clear" },
          start_date: { type: "string", description: "YYYY-MM-DD or null to clear" },
          assignee_ids: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_task_status",
      description: "Change the workflow status of the current task by status name (case-insensitive).",
      parameters: {
        type: "object",
        properties: {
          status_name: { type: "string", description: "e.g. 'In Progress', 'Done'" },
        },
        required: ["status_name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_custom_field",
      description: "Set a custom field value on the current task by field key.",
      parameters: {
        type: "object",
        properties: {
          field_key: { type: "string" },
          value: {},
        },
        required: ["field_key", "value"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "post_comment",
      description: "Post a top-level comment on the current task as the AI.",
      parameters: {
        type: "object",
        properties: { content: { type: "string" } },
        required: ["content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "reply_to_comment",
      description: "Reply to an existing comment on the current task.",
      parameters: {
        type: "object",
        properties: {
          parent_comment_id: { type: "string" },
          content: { type: "string" },
        },
        required: ["parent_comment_id", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_subtask",
      description: "Create a subtask under the current task.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_linked_page",
      description:
        "Create a page (doc/prd/decision/runbook/meeting_notes/journal) and link it to this task.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          page_type: {
            type: "string",
            enum: ["doc", "prd", "decision", "runbook", "meeting_notes", "journal"],
          },
          markdown: { type: "string" },
        },
        required: ["title", "markdown"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_linked_plan",
      description: "Create a plan-style page and link it to this task.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          markdown: { type: "string", description: "Plan body in markdown." },
        },
        required: ["title", "markdown"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_linked_canvas",
      description: "Create an empty canvas page (user can draw) and link to this task.",
      parameters: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "link_existing_page",
      description: "Attach an existing page (by id) to this task.",
      parameters: {
        type: "object",
        properties: { page_id: { type: "string" }, label: { type: "string" } },
        required: ["page_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "finish",
      description: "Finish the loop and respond to the user with a final message.",
      parameters: {
        type: "object",
        properties: { reply: { type: "string" } },
        required: ["reply"],
      },
    },
  },
];

interface Ctx {
  task: {
    id: string;
    workspace_id: string;
    project_id: string;
    title: string;
    description: unknown;
    priority: string | null;
    status: string | null;
    workflow_status_id: string | null;
    custom_values: Record<string, unknown> | null;
    tags: string[] | null;
  };
  userId: string;
}

async function execTool(
  name: string,
  args: Record<string, unknown>,
  ctx: Ctx,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    if (name === "update_task") {
      const patch: Record<string, unknown> = {};
      if (typeof args.title === "string") patch.title = String(args.title).slice(0, 300);
      if (typeof args.priority === "string") patch.priority = args.priority;
      if ("due_date" in args)
        patch.due_date = args.due_date ? String(args.due_date) : null;
      if ("start_date" in args)
        patch.start_date = args.start_date ? String(args.start_date) : null;
      if (Array.isArray(args.assignee_ids))
        patch.assignee_ids = (args.assignee_ids as unknown[]).map(String);
      if (Array.isArray(args.tags))
        patch.tags = (args.tags as unknown[]).map((t) => String(t).slice(0, 60));
      if (typeof args.description_markdown === "string") {
        patch.description = mdToTipTap(args.description_markdown);
      } else if (typeof args.append_to_description_markdown === "string") {
        const newDoc = mdToTipTap(args.append_to_description_markdown);
        const existing = ctx.task.description as { type?: string; content?: unknown[] } | null;
        if (existing && Array.isArray(existing.content)) {
          patch.description = {
            ...existing,
            content: [...existing.content, ...(newDoc.content as unknown[])],
          };
        } else {
          patch.description = newDoc;
        }
      }
      if (Object.keys(patch).length === 0) return { ok: false, error: "no fields provided" };
      const { error } = await supabaseAdmin
        .from("tasks")
        .update(patch as never)
        .eq("id", ctx.task.id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: { fields: Object.keys(patch) } };
    }

    if (name === "set_task_status") {
      const wanted = String(args.status_name ?? "").trim().toLowerCase();
      if (!wanted) return { ok: false, error: "status_name required" };
      const { data: statuses } = await supabaseAdmin
        .from("workflow_statuses")
        .select("id, name")
        .eq("project_id", ctx.task.project_id);
      const match = (statuses ?? []).find((s) => s.name.toLowerCase() === wanted);
      if (!match)
        return {
          ok: false,
          error: `Unknown status. Available: ${(statuses ?? []).map((s) => s.name).join(", ")}`,
        };
      const { error } = await supabaseAdmin
        .from("tasks")
        .update({ workflow_status_id: match.id, status: match.name } as never)
        .eq("id", ctx.task.id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: { status: match.name } };
    }

    if (name === "set_custom_field") {
      const key = String(args.field_key ?? "");
      if (!key) return { ok: false, error: "field_key required" };
      const current = (ctx.task.custom_values ?? {}) as Record<string, unknown>;
      const next = { ...current, [key]: args.value };
      const { error } = await supabaseAdmin
        .from("tasks")
        .update({ custom_values: next } as never)
        .eq("id", ctx.task.id);
      if (error) return { ok: false, error: error.message };
      ctx.task.custom_values = next;
      return { ok: true };
    }

    if (name === "post_comment") {
      const text = String(args.content ?? "").slice(0, 4000);
      if (!text) return { ok: false, error: "content required" };
      const { data, error } = await supabaseAdmin
        .from("comments")
        .insert({
          workspace_id: ctx.task.workspace_id,
          task_id: ctx.task.id,
          author_id: ctx.userId,
          content: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: `🤖 ${text}` }] }],
          },
        } as never)
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, data };
    }

    if (name === "reply_to_comment") {
      const parent = String(args.parent_comment_id ?? "");
      const text = String(args.content ?? "").slice(0, 4000);
      if (!parent || !text) return { ok: false, error: "parent_comment_id and content required" };
      const { data: parentRow } = await supabaseAdmin
        .from("comments")
        .select("id, task_id")
        .eq("id", parent)
        .maybeSingle();
      if (!parentRow || parentRow.task_id !== ctx.task.id)
        return { ok: false, error: "parent comment not on this task" };
      const { data, error } = await supabaseAdmin
        .from("comments")
        .insert({
          workspace_id: ctx.task.workspace_id,
          task_id: ctx.task.id,
          parent_id: parent,
          author_id: ctx.userId,
          content: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: `🤖 ${text}` }] }],
          },
        } as never)
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, data };
    }

    if (name === "create_subtask") {
      const title = String(args.title ?? "").slice(0, 200);
      if (!title) return { ok: false, error: "title required" };
      const description = args.description
        ? mdToTipTap(String(args.description))
        : null;
      const priority = ["low", "medium", "high"].includes(String(args.priority))
        ? (args.priority as string)
        : "medium";
      const { data, error } = await supabaseAdmin
        .from("tasks")
        .insert({
          workspace_id: ctx.task.workspace_id,
          project_id: ctx.task.project_id,
          parent_task_id: ctx.task.id,
          title,
          status: "todo",
          priority,
          task_type: "subtask",
          description,
          created_by: ctx.userId,
        } as never)
        .select("id, title")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, data };
    }

    if (
      name === "create_linked_page" ||
      name === "create_linked_plan" ||
      name === "create_linked_canvas"
    ) {
      const title = String(args.title ?? "").slice(0, 200);
      if (!title) return { ok: false, error: "title required" };
      let pageType = "doc";
      let icon = "📄";
      let content: unknown;
      let contentText = "";
      if (name === "create_linked_page") {
        const allowed = ["doc", "prd", "decision", "runbook", "meeting_notes", "journal"];
        pageType = allowed.includes(String(args.page_type)) ? (args.page_type as string) : "doc";
        const md = String(args.markdown ?? "");
        if (!md) return { ok: false, error: "markdown required" };
        content = mdToTipTap(md);
        contentText = md.slice(0, 50000);
        icon = "📄";
      } else if (name === "create_linked_plan") {
        pageType = "plan";
        const md = String(args.markdown ?? "");
        if (!md) return { ok: false, error: "markdown required" };
        content = mdToTipTap(md);
        contentText = md.slice(0, 50000);
        icon = "🗓️";
      } else {
        pageType = "canvas";
        content = { type: "excalidraw", elements: [], appState: {}, files: {} };
        contentText = "";
        icon = "🎨";
      }
      const { data: page, error } = await supabaseAdmin
        .from("pages")
        .insert({
          workspace_id: ctx.task.workspace_id,
          scope: "task",
          scope_id: ctx.task.id,
          page_type: pageType,
          title,
          icon,
          content: content as never,
          content_text: contentText,
          created_by: ctx.userId,
          updated_by: ctx.userId,
        } as never)
        .select("id, title, page_type")
        .single();
      if (error || !page) return { ok: false, error: error?.message ?? "page insert failed" };
      const linkKind =
        pageType === "plan" ? "plan" : pageType === "canvas" ? "canvas" : "page";
      await supabaseAdmin.from("task_links").insert({
        workspace_id: ctx.task.workspace_id,
        task_id: ctx.task.id,
        link_kind: linkKind,
        target_id: page.id,
        label: title,
        created_by: ctx.userId,
      } as never);
      return { ok: true, data: page };
    }

    if (name === "link_existing_page") {
      const pageId = String(args.page_id ?? "");
      if (!pageId) return { ok: false, error: "page_id required" };
      const { data: page } = await supabaseAdmin
        .from("pages")
        .select("id, title, page_type, workspace_id")
        .eq("id", pageId)
        .maybeSingle();
      if (!page || page.workspace_id !== ctx.task.workspace_id)
        return { ok: false, error: "page not found in workspace" };
      const linkKind =
        page.page_type === "plan" ? "plan" : page.page_type === "canvas" ? "canvas" : "page";
      const { error } = await supabaseAdmin.from("task_links").insert({
        workspace_id: ctx.task.workspace_id,
        task_id: ctx.task.id,
        link_kind: linkKind,
        target_id: page.id,
        label: args.label ? String(args.label) : page.title,
        created_by: ctx.userId,
      } as never);
      if (error && !error.message.includes("duplicate"))
        return { ok: false, error: error.message };
      return { ok: true, data: { id: page.id, title: page.title } };
    }

    return { ok: false, error: `Unknown tool: ${name}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function callAi(workspaceId: string, messages: ChatMsg[]) {
  const apiKey = await resolveOpenRouterKey(workspaceId);
  if (!apiKey) throw new Error(OPENROUTER_KEY_MISSING_ERROR);
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: ChatMsg }[];
  };
  const msg = json.choices?.[0]?.message;
  return {
    content: typeof msg?.content === "string" ? msg.content : "",
    tool_calls: msg?.tool_calls,
  };
}

export const taskChat = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        task_id: z.string().uuid(),
        thread_id: z.string().uuid().nullable().optional(),
        message: z.string().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Not signed in" } as const;

    const { data: task, error: taskErr } = await supabaseAdmin
      .from("tasks")
      .select(
        "id, workspace_id, project_id, title, description, priority, status, workflow_status_id, custom_values, tags",
      )
      .eq("id", data.task_id)
      .maybeSingle();
    if (taskErr || !task) return { error: "Task not found" } as const;

    // Verify membership
    const { data: member } = await supabaseAdmin
      .from("user_roles")
      .select("workspace_id")
      .eq("user_id", userId)
      .eq("workspace_id", task.workspace_id)
      .maybeSingle();
    if (!member) return { error: "Not a workspace member" } as const;

    // Load or create thread
    let thread: { id: string; messages: ChatMsg[]; tool_calls: ToolLog[] } | null = null;
    if (data.thread_id) {
      const { data: t } = await supabaseAdmin
        .from("ai_task_threads")
        .select("id, messages, tool_calls")
        .eq("id", data.thread_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (t) {
        thread = {
          id: t.id,
          messages: (t.messages as unknown as ChatMsg[]) ?? [],
          tool_calls: (t.tool_calls as unknown as ToolLog[]) ?? [],
        };
      }
    }
    if (!thread) {
      const { data: existing } = await supabaseAdmin
        .from("ai_task_threads")
        .select("id, messages, tool_calls")
        .eq("task_id", task.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        thread = {
          id: existing.id,
          messages: (existing.messages as unknown as ChatMsg[]) ?? [],
          tool_calls: (existing.tool_calls as unknown as ToolLog[]) ?? [],
        };
      } else {
        const { data: created, error: cErr } = await supabaseAdmin
          .from("ai_task_threads")
          .insert({
            workspace_id: task.workspace_id,
            task_id: task.id,
            user_id: userId,
            messages: [],
            tool_calls: [],
          } as never)
          .select("id")
          .single();
        if (cErr || !created) return { error: cErr?.message ?? "thread create failed" } as { error: string };
        thread = { id: created.id, messages: [], tool_calls: [] };
      }
    }

    // Build grounding context
    const [{ data: statuses }, { data: fields }, { data: comments }] = await Promise.all([
      supabaseAdmin
        .from("workflow_statuses")
        .select("name")
        .eq("project_id", task.project_id),
      supabaseAdmin
        .from("custom_field_defs")
        .select("id, name, field_type")
        .eq("workspace_id", task.workspace_id),
      supabaseAdmin
        .from("comments")
        .select("id, content, created_at, parent_id")
        .eq("task_id", task.id)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const ctx: Ctx = {
      task: task as Ctx["task"],
      userId,
    };

    const systemPrompt = [
      "You are an in-task AI assistant. You can edit this task, change its status, set custom fields, post or reply to comments, create subtasks, and create linked pages/plans/canvases. Always prefer using tools to make concrete changes the user asked for. Do not invent IDs.",
      "",
      `Task: ${task.title}`,
      `Current status: ${task.status ?? "(none)"}`,
      `Priority: ${task.priority ?? "(none)"}`,
      `Available statuses: ${(statuses ?? []).map((s) => s.name).join(", ") || "(none)"}`,
      `Custom fields: ${(fields ?? [])
        .map((f) => `${f.id}:${f.name}(${f.field_type})`)
        .join(", ") || "(none)"}`,
      `Recent comments (newest first): ${JSON.stringify(
        (comments ?? []).map((c) => ({
          id: c.id,
          parent: c.parent_id,
          text: extractText(c.content).slice(0, 200),
        })),
      ).slice(0, 1500)}`,
      "When you finish, call the `finish` tool with a short reply. Don't repeat tool results in the reply — just confirm what was done and ask if anything else is needed.",
    ].join("\n");

    // Append user message to thread (user-facing transcript)
    thread.messages.push({ role: "user", content: data.message });

    // Build full message list for the model: system + thread history (filter null content nodes)
    const apiMessages: ChatMsg[] = [
      { role: "system", content: systemPrompt },
      ...thread.messages,
    ];

    let finalReply = "";
    const newToolLogs: ToolLog[] = [];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const resp = await callAi(ctx.task.workspace_id, apiMessages);
      const assistantMsg: ChatMsg = {
        role: "assistant",
        content: resp.content || null,
        tool_calls: resp.tool_calls,
      };
      apiMessages.push(assistantMsg);

      if (!resp.tool_calls || resp.tool_calls.length === 0) {
        finalReply = resp.content || "";
        thread.messages.push({ role: "assistant", content: finalReply });
        break;
      }

      let finished = false;
      for (const tc of resp.tool_calls) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(tc.function.arguments || "{}");
        } catch {
          /* keep empty */
        }
        if (tc.function.name === "finish") {
          finalReply = String(parsed.reply ?? resp.content ?? "Done.");
          newToolLogs.push({
            iteration: i,
            name: "finish",
            arguments: parsed,
            result: { ok: true },
            at: new Date().toISOString(),
          });
          apiMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: "finish",
            content: "ok",
          });
          thread.messages.push({ role: "assistant", content: finalReply });
          finished = true;
          break;
        }
        const result = await execTool(tc.function.name, parsed, ctx);
        newToolLogs.push({
          iteration: i,
          name: tc.function.name,
          arguments: parsed,
          result,
          at: new Date().toISOString(),
        });
        apiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(result).slice(0, 2000),
        });
      }
      if (finished) break;
      if (i === MAX_ITERATIONS - 1) {
        finalReply = resp.content || "I hit the iteration limit. Anything else?";
        thread.messages.push({ role: "assistant", content: finalReply });
      }
    }

    // Persist thread
    await supabaseAdmin
      .from("ai_task_threads")
      .update({
        messages: thread.messages as never,
        tool_calls: [...thread.tool_calls, ...newToolLogs] as never,
      } as never)
      .eq("id", thread.id);

    const serializedToolCalls = JSON.parse(JSON.stringify(newToolLogs)) as Array<{ [x: string]: {} }>;
    return {
      thread_id: thread.id,
      reply: finalReply,
      tool_calls: serializedToolCalls,
    };
  });

export const getTaskThread = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ task_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Not signed in" } as const;
    const { data: t } = await supabaseAdmin
      .from("ai_task_threads")
      .select("id, messages, tool_calls")
      .eq("task_id", data.task_id)
      .eq("user_id", userId)
      .maybeSingle();
    return { thread: t ?? null } as const;
  });

export const clearTaskThread = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ thread_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Not signed in" } as const;
    await supabaseAdmin
      .from("ai_task_threads")
      .delete()
      .eq("id", data.thread_id)
      .eq("user_id", userId);
    return { ok: true } as const;
  });

function extractText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { text?: string; content?: unknown[] };
    if (typeof node.text === "string") out.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return out.join(" ");
}
