import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Aura Workspace AI — Rovo-style chat with persisted conversations,
 * scope-aware retrieval (workspace / project / folder / page),
 * and inline citations.
 */

interface Citation {
  kind: "project" | "task" | "meeting" | "page" | "note" | "folder" | "contact";
  id: string;
  label: string;
}

export interface AuraAction {
  id: string;
  type: "create_task" | "create_note";
  status: "proposed" | "executed" | "dismissed";
  // create_task
  title?: string;
  description?: string;
  project_id?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  due_date?: string | null;
  // create_note
  content?: string;
  // result
  result_id?: string;
  error?: string;
}

export interface AuraMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  actions?: AuraAction[];
  created_at?: string;
}

const ScopeType = z.enum(["workspace", "division", "folder", "project", "page"]);

async function authedUserId(): Promise<string | null> {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

async function ensureMember(workspaceId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function getApiKey(workspaceId: string) {
  const { data } = await supabaseAdmin
    .from("workspace_ai_secrets")
    .select("openrouter_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data?.openrouter_api_key ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const listAuraConversations = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a member" };

    const { data: rows, error } = await supabaseAdmin
      .from("workspace_ai_conversations")
      .select("id, title, scope_type, scope_target_id, pinned, updated_at, created_at")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", userId)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, conversations: rows ?? [] };
  });

export const getAuraConversation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    const { data: row, error } = await supabaseAdmin
      .from("workspace_ai_conversations")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !row) return { ok: false as const, error: error?.message ?? "Not found" };
    return { ok: true as const, conversation: row };
  });

export const deleteAuraConversation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    const { error } = await supabaseAdmin
      .from("workspace_ai_conversations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const togglePinAuraConversation = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), pinned: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    const { error } = await supabaseAdmin
      .from("workspace_ai_conversations")
      .update({ pinned: data.pinned })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Retrieval
// ─────────────────────────────────────────────────────────────────────────────

interface SearchHit {
  kind: string;
  id: string;
  title: string;
  snippet: string;
  project_id: string | null;
  rank: number;
}

async function retrieveContext(
  workspaceId: string,
  query: string,
  scope: { type: z.infer<typeof ScopeType>; targetId: string | null },
) {
  // Use the global_search RPC (keyword + trigram)
  const projectId =
    scope.type === "project" && scope.targetId ? scope.targetId : null;

  const { data: hits } = await supabaseAdmin.rpc("global_search", {
    _workspace_id: workspaceId,
    _q: query,
    _limit: 18,
    _project_id: projectId,
  });

  let results = (hits ?? []) as SearchHit[];

  // Folder scope: filter pages whose scope = folder/<id>
  if (scope.type === "folder" && scope.targetId) {
    const { data: pageIds } = await supabaseAdmin
      .from("pages")
      .select("id")
      .eq("scope", "folder")
      .eq("scope_id", scope.targetId);
    const allowed = new Set<string>(
      (pageIds ?? []).map((p) => p.id as string),
    );
    results = results.filter(
      (r) => r.kind !== "page" || allowed.has(r.id),
    );
  }

  if (scope.type === "page" && scope.targetId) {
    results = results.filter(
      (r) => !(r.kind === "page" && r.id !== scope.targetId),
    );
  }

  return results.slice(0, 14);
}

function buildContext(hits: SearchHit[]) {
  if (hits.length === 0) return "(no relevant items found)";
  return hits
    .map(
      (h) =>
        `[${h.kind}:${h.id}] ${h.title}${h.snippet ? `\n  ${h.snippet.replace(/\s+/g, " ").slice(0, 240)}` : ""}`,
    )
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat
// ─────────────────────────────────────────────────────────────────────────────

export const sendAuraMessage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        conversation_id: z.string().uuid().nullable().optional(),
        message: z.string().min(1).max(4000),
        scope_type: ScopeType.default("workspace"),
        scope_target_id: z.string().uuid().nullable().optional(),
        deep: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a member" };

    const apiKey = await getApiKey(data.workspace_id);
    if (!apiKey)
      return {
        ok: false as const,
        error: "No OpenRouter API key. Add one in Settings → AI.",
      };

    // Load or create conversation
    let conversationId = data.conversation_id ?? null;
    let history: AuraMessage[] = [];
    if (conversationId) {
      const { data: row } = await supabaseAdmin
        .from("workspace_ai_conversations")
        .select("messages")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
      history = ((row?.messages as unknown as AuraMessage[]) ?? []).slice(-10);
    }

    const hits = await retrieveContext(data.workspace_id, data.message, {
      type: data.scope_type,
      targetId: data.scope_target_id ?? null,
    });

    const ctx = buildContext(hits);
    const scopeLabel =
      data.scope_type === "workspace"
        ? "the entire workspace"
        : `${data.scope_type} ${data.scope_target_id ?? ""}`;

    const systemPrompt = `You are Aura, the workspace intelligence assistant. Answer using ONLY the context below from ${scopeLabel}. If context is insufficient say "I don't have enough information" and suggest where to look.

Always cite items inline using their bracket tag exactly as shown — e.g. [task:abc-123] or [page:xyz]. Never invent IDs. Be concise; use bullet lists when summarising multiple items.

If the user asks you to create something (a task, a note, a follow-up), propose it as an action by appending a fenced JSON block at the very end of your reply, like this:
\`\`\`aura-actions
[
  {"type":"create_task","title":"…","description":"…","priority":"medium","project_id":null,"due_date":null}
]
\`\`\`
Only include the actions block when the user clearly asked you to create something. The user will confirm before anything is created. Valid types: create_task, create_note.

CONTEXT:
${ctx}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: data.message },
    ];

    const model = data.deep ? "xiaomi/mimo-v2-flash" : "xiaomi/mimo-v2-flash";

    let answer = "";
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/zenifold/aurora-os",
          "X-Title": "Aurora Workspace AI",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 1200,
          messages,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        return { ok: false as const, error: `AI error ${res.status}: ${t.slice(0, 200)}` };
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      answer = json.choices?.[0]?.message?.content?.trim() ?? "(no response)";
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "AI request failed",
      };
    }

    // Resolve citations from hits
    const citations: Citation[] = [];
    const seen = new Set<string>();
    const re = /\[(project|task|meeting|page|note|folder|contact):([0-9a-f-]{8,})\]/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(answer)) !== null) {
      const key = `${m[1]}:${m[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const hit = hits.find((h) => h.kind === m![1] && h.id === m![2]);
      citations.push({
        kind: m[1] as Citation["kind"],
        id: m[2],
        label: hit?.title ?? m[2].slice(0, 8),
      });
    }

    // Extract proposed actions from fenced ```aura-actions block
    const actions: AuraAction[] = [];
    let cleanedAnswer = answer;
    const actionsMatch = answer.match(/```aura-actions\s*([\s\S]*?)```/i);
    if (actionsMatch) {
      try {
        const parsed = JSON.parse(actionsMatch[1].trim()) as Partial<AuraAction>[];
        for (const a of parsed) {
          if (a?.type === "create_task" || a?.type === "create_note") {
            actions.push({
              id: crypto.randomUUID(),
              status: "proposed",
              type: a.type,
              title: a.title,
              description: a.description,
              project_id: a.project_id ?? null,
              priority: a.priority,
              due_date: a.due_date ?? null,
              content: a.content,
            });
          }
        }
        cleanedAnswer = answer.replace(actionsMatch[0], "").trim();
      } catch {
        // ignore malformed JSON
      }
    }

    const userMsg: AuraMessage = {
      role: "user",
      content: data.message,
      created_at: new Date().toISOString(),
    };
    const aiMsg: AuraMessage = {
      role: "assistant",
      content: cleanedAnswer,
      citations,
      actions: actions.length ? actions : undefined,
      created_at: new Date().toISOString(),
    };

    if (!conversationId) {
      // Create — auto-title from first user message
      const title = data.message.slice(0, 60).replace(/\s+/g, " ").trim() || "New conversation";
      const { data: created, error } = await supabaseAdmin
        .from("workspace_ai_conversations")
        .insert({
          workspace_id: data.workspace_id,
          user_id: userId,
          title,
          scope_type: data.scope_type,
          scope_target_id: data.scope_target_id ?? null,
          messages: [userMsg, aiMsg] as unknown as never,
        })
        .select("id")
        .single();
      if (error) return { ok: false as const, error: error.message };
      conversationId = created!.id as string;
    } else {
      const newMessages = [...history, userMsg, aiMsg];
      const { error } = await supabaseAdmin
        .from("workspace_ai_conversations")
        .update({ messages: newMessages as unknown as never })
        .eq("id", conversationId)
        .eq("user_id", userId);
      if (error) return { ok: false as const, error: error.message };
    }

    return {
      ok: true as const,
      conversation_id: conversationId,
      answer: cleanedAnswer,
      citations,
      actions,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Run a proposed action (user-confirmed)
// ─────────────────────────────────────────────────────────────────────────────

export const runAuraAction = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        message_index: z.number().int().min(0),
        action_id: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };

    const { data: convo, error: cErr } = await supabaseAdmin
      .from("workspace_ai_conversations")
      .select("workspace_id, messages")
      .eq("id", data.conversation_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (cErr || !convo) return { ok: false as const, error: "Conversation not found" };

    const msgs = (convo.messages as unknown as AuraMessage[]) ?? [];
    const msg = msgs[data.message_index];
    if (!msg?.actions) return { ok: false as const, error: "No actions on message" };
    const action = msg.actions.find((a) => a.id === data.action_id);
    if (!action) return { ok: false as const, error: "Action not found" };
    if (action.status !== "proposed")
      return { ok: false as const, error: `Already ${action.status}` };

    let resultId: string | undefined;
    try {
      if (action.type === "create_task") {
        // Need a project — fall back to first project in workspace if none specified
        let projectId = action.project_id ?? null;
        if (!projectId) {
          const { data: proj } = await supabaseAdmin
            .from("projects")
            .select("id")
            .eq("workspace_id", convo.workspace_id)
            .eq("is_archived", false)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          projectId = proj?.id ?? null;
        }
        if (!projectId) {
          action.status = "executed";
          action.error = "No project available — create one first.";
        } else {
          const { data: t, error } = await supabaseAdmin
            .from("tasks")
            .insert({
              workspace_id: convo.workspace_id,
              project_id: projectId,
              title: action.title ?? "Untitled task",
              description: action.description ?? null,
              priority: action.priority ?? "medium",
              status: "todo",
              due_date: action.due_date ?? null,
              created_by: userId,
            })
            .select("id")
            .single();
          if (error) action.error = error.message;
          else resultId = (action.result_id = t!.id as string);
          action.status = "executed";
        }
      } else if (action.type === "create_note") {
        const { data: n, error } = await supabaseAdmin
          .from("notes")
          .insert({
            workspace_id: convo.workspace_id,
            title: action.title ?? "Note from Aura",
            content: { text: action.content ?? action.description ?? "" } as unknown as never,
            created_by: userId,
          })
          .select("id")
          .single();
        if (error) action.error = error.message;
        else resultId = (action.result_id = n!.id as string);
        action.status = "executed";
      }
    } catch (e) {
      action.status = "executed";
      action.error = e instanceof Error ? e.message : "Action failed";
    }

    msgs[data.message_index] = msg;
    await supabaseAdmin
      .from("workspace_ai_conversations")
      .update({ messages: msgs as unknown as never })
      .eq("id", data.conversation_id)
      .eq("user_id", userId);

    return { ok: true as const, action, result_id: resultId };
  });

export const dismissAuraAction = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        message_index: z.number().int().min(0),
        action_id: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    const { data: convo } = await supabaseAdmin
      .from("workspace_ai_conversations")
      .select("messages")
      .eq("id", data.conversation_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!convo) return { ok: false as const, error: "Not found" };
    const msgs = (convo.messages as unknown as AuraMessage[]) ?? [];
    const msg = msgs[data.message_index];
    const action = msg?.actions?.find((a) => a.id === data.action_id);
    if (!action) return { ok: false as const, error: "Action not found" };
    action.status = "dismissed";
    await supabaseAdmin
      .from("workspace_ai_conversations")
      .update({ messages: msgs as unknown as never })
      .eq("id", data.conversation_id)
      .eq("user_id", userId);
    return { ok: true as const };
  });
