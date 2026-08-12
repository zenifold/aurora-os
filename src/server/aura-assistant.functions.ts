import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runArtifactGeneration } from "@/server/ai-create.server";

/**
 * Aura Assistant — workspace-grounded Q&A with optional artifact generation.
 *
 * The model can call a `generate_artifacts` tool to create folders, pages,
 * canvases, plans, or projects in the user's workspace based on the request.
 */

interface Citation {
  kind: "project" | "task" | "meeting";
  id: string;
  label: string;
}

interface CreatedArtifact {
  kind: string;
  id: string;
  title: string;
  path?: string;
}

interface ClarifyingQuestion {
  question: string;
  options: { label: string; description?: string }[];
  allow_other?: boolean;
  multi_select?: boolean;
}

async function authedUserId(): Promise<string | null> {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

async function persistAuraExchange(args: {
  conversationId: string | null;
  userId: string;
  workspaceId: string;
  question: string;
  answer: string;
  citations: Citation[];
  created: CreatedArtifact[];
  persistedHistory: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string | null> {
  try {
    const userMsg = { role: "user" as const, content: args.question, created_at: new Date().toISOString() };
    const aiMsg = {
      role: "assistant" as const,
      content: args.answer,
      citations: args.citations,
      created: args.created,
      created_at: new Date().toISOString(),
    };
    if (!args.conversationId) {
      const title = args.question.slice(0, 60).replace(/\s+/g, " ").trim() || "New conversation";
      const { data: row } = await supabaseAdmin
        .from("workspace_ai_conversations")
        .insert({
          workspace_id: args.workspaceId,
          user_id: args.userId,
          title,
          scope_type: "workspace",
          messages: [userMsg, aiMsg] as unknown as never,
        })
        .select("id")
        .single();
      return (row?.id as string) ?? null;
    }
    const newMessages = [
      ...args.persistedHistory.map((m) => ({ role: m.role, content: m.content })),
      userMsg,
      aiMsg,
    ];
    await supabaseAdmin
      .from("workspace_ai_conversations")
      .update({ messages: newMessages as unknown as never })
      .eq("id", args.conversationId)
      .eq("user_id", args.userId);
    return args.conversationId;
  } catch (e) {
    console.error("persistAuraExchange failed", e);
    return args.conversationId;
  }
}

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "generate_artifacts",
      description:
        "Create workspace artifacts (pages, canvases, plans, folders, projects) when the user asks you to build, create, draft, set up, or generate something. Use mode='agentic' for multi-artifact requests; 'one_shot' for a single artifact. Only call AFTER you have enough information — use ask_clarifying_questions first if the request is ambiguous.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["folder", "page", "canvas", "plan", "project", "auto"],
            description: "Artifact kind. Use 'auto' for agentic multi-artifact requests.",
          },
          mode: { type: "string", enum: ["one_shot", "agentic"] },
          prompt: {
            type: "string",
            description: "A clear, self-contained brief describing what to create.",
          },
        },
        required: ["kind", "mode", "prompt"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ask_clarifying_questions",
      description:
        "Ask the user 1-3 clarifying multiple-choice questions BEFORE generating artifacts when the request is ambiguous (e.g. unclear stack, scope, audience, format, or goals). Each question has options the user can pick from, and may allow a free-text 'Other' answer. Do NOT use for trivial requests — only when answers will materially change the output.",
      parameters: {
        type: "object",
        properties: {
          preface: {
            type: "string",
            description: "One short sentence framing why you need clarification.",
          },
          questions: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                options: {
                  type: "array",
                  minItems: 2,
                  maxItems: 5,
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["label"],
                  },
                },
                allow_other: { type: "boolean" },
                multi_select: { type: "boolean" },
              },
              required: ["question", "options"],
            },
          },
        },
        required: ["preface", "questions"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_task",
      description:
        "Update an existing task by id. Use the id from a [task:UUID] bracket tag in the workspace context. Only include fields you want to change. For status, pass the status NAME (e.g. 'In Progress').",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "UUID of the task to update" },
          title: { type: "string" },
          description_markdown: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          due_date: { type: "string", description: "YYYY-MM-DD or null to clear" },
          status_name: { type: "string", description: "Workflow status name e.g. 'Done'" },
          assignee_ids: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          add_comment: { type: "string", description: "Optional comment to post on the task." },
        },
        required: ["task_id"],
      },
    },
  },
];

export const askAura = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        question: z.string().min(2).max(2000),
        scope_project_id: z.string().uuid().nullable().optional(),
        scope_page_id: z.string().uuid().nullable().optional(),
        route_context: z
          .object({
            pathname: z.string().max(300),
            kind: z.string().max(40),
            section: z.string().max(60).optional(),
            label: z.string().max(120),
            ids: z
              .object({
                projectId: z.string().optional(),
                taskId: z.string().optional(),
                pageId: z.string().optional(),
                meetingId: z.string().optional(),
                folderId: z.string().optional(),
                divisionSlug: z.string().optional(),
                escalationId: z.string().optional(),
              })
              .partial()
              .optional(),
          })
          .nullable()
          .optional(),
        conversation_id: z.string().uuid().nullable().optional(),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(4000),
            }),
          )
          .max(10)
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Please sign in again." };

    const { data: membership } = await supabaseAdmin
      .from("user_roles")
      .select("workspace_id, role")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return { ok: false as const, error: "Not a workspace member." };

    // Load persisted history if conversation_id provided
    let conversationId: string | null = data.conversation_id ?? null;
    let persistedHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (conversationId) {
      const { data: row } = await supabaseAdmin
        .from("workspace_ai_conversations")
        .select("messages")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
      const msgs = (row?.messages as unknown as Array<{ role: "user" | "assistant"; content: string }>) ?? [];
      persistedHistory = msgs.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    }
    const effectiveHistory = persistedHistory.length ? persistedHistory : (data.history ?? []);

    const { data: secret } = await supabaseAdmin
      .from("workspace_ai_secrets")
      .select("openrouter_api_key")
      .eq("workspace_id", data.workspace_id)
      .maybeSingle();
    const apiKey = secret?.openrouter_api_key;
    if (!apiKey) {
      return {
        ok: false as const,
        error: "No OpenRouter API key configured. Add one in Settings → AI.",
      };
    }

    // Divisions removed.
    const defaultDivisionId: string | undefined = undefined;

    // Project scope -> use that project's folder.
    // Auto-derive from route_context if not explicitly passed.
    const routeProjectId = data.route_context?.ids?.projectId ?? null;
    const routePageId = data.route_context?.ids?.pageId ?? null;
    const routeTaskId = data.route_context?.ids?.taskId ?? null;
    const routeMeetingId = data.route_context?.ids?.meetingId ?? null;
    const scopeProject = data.scope_project_id ?? routeProjectId ?? null;
    const effectivePageId = data.scope_page_id ?? routePageId ?? null;
    let scopeDivisionId: string | undefined;
    let scopeFolderId: string | null = null;
    if (scopeProject) {
      const { data: proj } = await supabaseAdmin
        .from("projects")
        .select("folder_id")
        .eq("id", scopeProject)
        .maybeSingle();
      const p = proj as { folder_id: string | null } | null;
      scopeFolderId = p?.folder_id ?? null;
    }

    // ---- Build grounding context ----
    let projectsQ = supabaseAdmin
      .from("projects")
      .select("id, name, phase, health, target_end_date, description")
      .eq("workspace_id", data.workspace_id)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(scopeProject ? 1 : 25);
    if (scopeProject) projectsQ = projectsQ.eq("id", scopeProject);
    const { data: projectsData } = await projectsQ;
    const projects = projectsData ?? [];

    let tasksQ = supabaseAdmin
      .from("tasks")
      .select("id, title, status, priority, due_date, project_id, assignee_ids")
      .eq("workspace_id", data.workspace_id)
      .neq("status", "done")
      .order("updated_at", { ascending: false })
      .limit(scopeProject ? 60 : 80);
    if (scopeProject) tasksQ = tasksQ.eq("project_id", scopeProject);
    const { data: tasksData } = await tasksQ;
    const tasks = tasksData ?? [];

    let meetingsQ = supabaseAdmin
      .from("meetings")
      .select("id, title, actual_start, summary, project_id")
      .eq("workspace_id", data.workspace_id)
      .order("actual_start", { ascending: false, nullsFirst: false })
      .limit(scopeProject ? 8 : 12);
    if (scopeProject) meetingsQ = meetingsQ.eq("project_id", scopeProject);
    const { data: meetingsData } = await meetingsQ;
    const meetings = meetingsData ?? [];

    const projectMap = new Map(
      (projects ?? []).map((p) => [p.id as string, p.name as string]),
    );

    const projectLines = projects.map(
      (p) =>
        `[project:${p.id}] ${p.name} — phase:${p.phase ?? "?"} health:${p.health ?? "?"} due:${p.target_end_date ?? "—"}`,
    );

    const overdueIso = new Date().toISOString().slice(0, 10);
    const taskLines = tasks.map((t) => {
      const overdue = t.due_date && t.due_date < overdueIso ? " OVERDUE" : "";
      const proj = t.project_id ? projectMap.get(t.project_id) ?? "" : "";
      return `[task:${t.id}] ${t.title} — ${t.status}/${t.priority}${overdue} due:${t.due_date ?? "—"} project:${proj}`;
    });

    const meetingLines = meetings.map((m) => {
      const sum =
        m.summary && typeof m.summary === "object" && "overview" in (m.summary as Record<string, unknown>)
          ? String((m.summary as Record<string, unknown>).overview).slice(0, 240)
          : "";
      return `[meeting:${m.id}] ${m.title} (${m.actual_start ?? "—"}) ${sum}`;
    });

    // Optional active page focus
    let pageFocusBlock = "";
    if (effectivePageId) {
      const { data: pg } = await supabaseAdmin
        .from("pages")
        .select("id, title, page_type, scope, scope_id, content_text, icon")
        .eq("id", effectivePageId)
        .eq("workspace_id", data.workspace_id)
        .maybeSingle();
      if (pg) {
        const excerpt = (pg.content_text ?? "").slice(0, 1800);
        pageFocusBlock = `\n## Active page (the user is currently viewing this)\n[page:${pg.id}] ${pg.icon ?? "📄"} ${pg.title} (type:${pg.page_type}, scope:${pg.scope})\n---\n${excerpt}\n---\n`;
      }
    }

    // Active task focus (from ?task=<id> on any route)
    let taskFocusBlock = "";
    if (routeTaskId) {
      const { data: t } = await supabaseAdmin
        .from("tasks")
        .select("id, title, status, priority, due_date, description, assignee_ids, project_id")
        .eq("id", routeTaskId)
        .eq("workspace_id", data.workspace_id)
        .maybeSingle();
      if (t) {
        const desc = typeof t.description === "string" ? t.description.slice(0, 800) : "";
        taskFocusBlock = `\n## Active task (open in side panel)\n[task:${t.id}] ${t.title} — ${t.status}/${t.priority} due:${t.due_date ?? "—"}\n${desc}\n`;
      }
    }

    // Active meeting focus
    let meetingFocusBlock = "";
    if (routeMeetingId) {
      const { data: m } = await supabaseAdmin
        .from("meetings")
        .select("id, title, actual_start, summary, project_id")
        .eq("id", routeMeetingId)
        .eq("workspace_id", data.workspace_id)
        .maybeSingle();
      if (m) {
        const sum =
          m.summary && typeof m.summary === "object" && "overview" in (m.summary as Record<string, unknown>)
            ? String((m.summary as Record<string, unknown>).overview).slice(0, 1200)
            : "";
        meetingFocusBlock = `\n## Active meeting\n[meeting:${m.id}] ${m.title} (${m.actual_start ?? "—"})\n${sum}\n`;
      }
    }

    // Generic route awareness — describe WHERE the user is even when no
    // single entity is in focus (capacity, delivery, inbox, my-tasks, etc.).
    let routeBlock = "";
    if (data.route_context) {
      const rc = data.route_context;
      const idBits = Object.entries(rc.ids ?? {})
        .filter(([, v]) => !!v)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      routeBlock = `\n## Where the user is\nRoute: ${rc.pathname}\nView: ${rc.label}${rc.section ? ` (${rc.section})` : ""}${idBits ? `\nEntities: ${idBits}` : ""}\nWhen the user says "this", "here", "current", or asks open-ended questions, assume they mean this view. Tailor answers to it.\n`;
    }

    // Workspace memory — pinned facts/preferences/style notes the admin wants
    // Aura to always remember (clients, brand tone, contracts, conventions).
    let memoryBlock = "";
    try {
      const { data: memRows } = await supabaseAdmin
        .from("workspace_ai_memory")
        .select("kind, content, pinned, sort_order")
        .eq("workspace_id", data.workspace_id)
        .order("pinned", { ascending: false })
        .order("sort_order", { ascending: true })
        .limit(40);
      const pinned = (memRows ?? []).filter((m) => m.pinned);
      if (pinned.length) {
        memoryBlock =
          "\n## Workspace memory (always apply)\n" +
          pinned.map((m) => `- (${m.kind}) ${String(m.content).slice(0, 400)}`).join("\n") +
          "\n";
      }
    } catch { /* memory is best-effort */ }

    const ctx = [
      memoryBlock,
      `## Projects (${projectLines.length})`,
      projectLines.slice(0, 25).join("\n"),
      `\n## Open tasks (${taskLines.length})`,
      taskLines.slice(0, 80).join("\n"),
      `\n## Recent meetings (${meetingLines.length})`,
      meetingLines.slice(0, 12).join("\n"),
      pageFocusBlock,
      taskFocusBlock,
      meetingFocusBlock,
      routeBlock,
    ].join("\n");

    const systemPrompt = `You are Aura, the workspace assistant for the Aurora delivery platform.

You can:
1. ANSWER questions using the workspace context.
2. ASK clarifying multiple-choice questions via the \`ask_clarifying_questions\` tool when the user's request is ambiguous and the answers will materially change what you build (e.g. tech stack, target audience, scope, format, framework). Prefer 1-3 focused questions with 2-5 concrete options each. Always include an "Other" option (allow_other: true) so the user can type their own answer.
3. ACT by calling \`generate_artifacts\` to create pages, canvases, plans, folders, and projects.
4. UPDATE existing tasks via \`update_task\` (pass the task_id from a [task:UUID] tag in the workspace context). When the user says "update task X", "mark X done", "change priority", etc. — use update_task, NOT generate_artifacts. Only use generate_artifacts when they ask to CREATE something new.

Decision flow for build/create requests:
- If you have enough information → call \`generate_artifacts\` directly.
- If a key decision is missing (stack, audience, scope, deliverable type, depth) → call \`ask_clarifying_questions\` FIRST. Do NOT call generate_artifacts in the same turn.
- Once the user answers your questions in a follow-up message, proceed to call \`generate_artifacts\`.
- If the user explicitly says "just do it", "you decide", "surprise me", or similar — skip clarifying and generate with sensible defaults.

For \`generate_artifacts\`:
- mode='agentic' with kind='auto' for multi-artifact requests (e.g. "build a launch plan with PRD and roadmap").
- mode='one_shot' with a specific kind for single-artifact requests (e.g. "draft a PRD for X").
- After the tool runs, briefly summarise what you created.

For pure Q&A: answer using ONLY the workspace context. Cite items inline using their bracket tags exactly as shown — for example [task:abc-123] or [project:xyz]. Keep answers concise (under 180 words). Never invent IDs.

WORKSPACE CONTEXT:
${ctx}`;

    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt },
      ...(effectiveHistory as Array<Record<string, unknown>>),
      { role: "user", content: data.question },
    ];

    const created: CreatedArtifact[] = [];
    let pendingClarify: { preface: string; questions: ClarifyingQuestion[] } | null = null;

    try {
      // Up to 2 turns: tool call, then final reply.
      for (let turn = 0; turn < 2; turn++) {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/zenifold/aurora-os",
            "X-Title": "Aurora Aura Assistant",
          },
          body: JSON.stringify({
            model: "xiaomi/mimo-v2-flash",
            temperature: 0.2,
            max_tokens: 1200,
            tools: TOOLS,
            tool_choice: "auto",
            messages,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          return { ok: false as const, error: `AI error ${res.status}: ${txt.slice(0, 200)}` };
        }
        const json = (await res.json()) as {
          choices?: {
            message?: {
              content?: string | null;
              tool_calls?: { id: string; function: { name: string; arguments: string } }[];
            };
          }[];
        };
        const msg = json.choices?.[0]?.message;
        const toolCalls = msg?.tool_calls ?? [];

        if (toolCalls.length === 0) {
          const answer = (msg?.content ?? "").trim() || (pendingClarify ? "" : "(no response)");
          // citations
          const citations: Citation[] = [];
          const seen = new Set<string>();
          const re = /\[(project|task|meeting):([0-9a-f-]{8,})\]/gi;
          let m: RegExpExecArray | null;
          while ((m = re.exec(answer)) !== null) {
            const key = `${m[1]}:${m[2]}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const kind = m[1] as Citation["kind"];
            const id = m[2];
            let label = id.slice(0, 8);
            if (kind === "project") label = projectMap.get(id) ?? label;
            else if (kind === "task") {
              const t = tasks.find((x) => x.id === id);
              if (t) label = t.title as string;
            } else if (kind === "meeting") {
              const mt = meetings.find((x) => x.id === id);
              if (mt) label = mt.title as string;
            }
            citations.push({ kind, id, label });
          }
          const finalAnswer = pendingClarify ? (answer || (pendingClarify as { preface: string }).preface) : answer;
          conversationId = await persistAuraExchange({
            conversationId, userId, workspaceId: data.workspace_id,
            question: data.question, answer: finalAnswer, citations,
            created, persistedHistory,
          });
          return {
            ok: true as const,
            conversation_id: conversationId,
            answer: finalAnswer,
            citations,
            created,
            clarify: pendingClarify,
          };
        }

        // Execute tool calls
        messages.push({
          role: "assistant",
          content: msg?.content ?? "",
          tool_calls: toolCalls,
        });

        for (const tc of toolCalls) {
          const fnName = tc.function.name;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {
            // ignore
          }

          if (fnName === "ask_clarifying_questions") {
            const preface = typeof args.preface === "string" ? args.preface : "I need a bit more info to do this well.";
            const rawQs = Array.isArray(args.questions) ? args.questions : [];
            const questions: ClarifyingQuestion[] = rawQs
              .map((q: Record<string, unknown>) => {
                const opts = Array.isArray(q.options) ? q.options : [];
                return {
                  question: String(q.question ?? "").slice(0, 400),
                  options: opts
                    .map((o: Record<string, unknown>) => ({
                      label: String(o.label ?? "").slice(0, 120),
                      description: o.description ? String(o.description).slice(0, 200) : undefined,
                    }))
                    .filter((o) => o.label),
                  allow_other: q.allow_other !== false,
                  multi_select: !!q.multi_select,
                };
              })
              .filter((q) => q.question && q.options.length >= 2)
              .slice(0, 3);

            if (questions.length > 0) {
              pendingClarify = { preface, questions };
            }
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ ok: true, delivered: questions.length }),
            });
            continue;
          }

          if (fnName === "update_task") {
            const taskId = String(args.task_id ?? "");
            if (!taskId) {
              messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "task_id required" }) });
              continue;
            }
            const { data: t } = await supabaseAdmin
              .from("tasks")
              .select("id, workspace_id, project_id, title, description")
              .eq("id", taskId)
              .maybeSingle();
            if (!t || t.workspace_id !== data.workspace_id) {
              messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "task not found" }) });
              continue;
            }
            const patch: Record<string, unknown> = {};
            if (typeof args.title === "string") patch.title = args.title.slice(0, 300);
            if (typeof args.priority === "string") patch.priority = args.priority;
            if ("due_date" in args) patch.due_date = args.due_date ? String(args.due_date) : null;
            if (Array.isArray(args.assignee_ids)) patch.assignee_ids = (args.assignee_ids as unknown[]).map(String);
            if (Array.isArray(args.tags)) patch.tags = (args.tags as unknown[]).map((x) => String(x).slice(0, 60));
            if (typeof args.description_markdown === "string") {
              const { mdToTipTap } = await import("@/server/md-to-tiptap.server");
              patch.description = mdToTipTap(args.description_markdown);
            }
            if (typeof args.status_name === "string" && args.status_name) {
              const { data: statuses } = await supabaseAdmin
                .from("workflow_statuses").select("id, name").eq("project_id", t.project_id);
              const match = (statuses ?? []).find((s) => s.name.toLowerCase() === String(args.status_name).toLowerCase());
              if (match) {
                patch.workflow_status_id = match.id;
                patch.status = match.name;
              }
            }
            let updateError: string | null = null;
            if (Object.keys(patch).length > 0) {
              const { error } = await supabaseAdmin.from("tasks").update(patch as never).eq("id", taskId);
              if (error) updateError = error.message;
            }
            if (typeof args.add_comment === "string" && args.add_comment.trim()) {
              await supabaseAdmin.from("comments").insert({
                workspace_id: t.workspace_id,
                task_id: taskId,
                author_id: userId,
                content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `🤖 ${args.add_comment}` }] }] },
              } as never);
            }
            if (!updateError) {
              created.push({
                kind: "task",
                id: taskId,
                title: t.title,
                path: `/app/p/${t.project_id}?task=${taskId}`,
              });
            }
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(updateError ? { error: updateError } : { ok: true, fields: Object.keys(patch) }),
            });
            continue;
          }

          // generate_artifacts
          const divisionId = scopeDivisionId ?? defaultDivisionId;
          if (!divisionId) {
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ error: "No division available" }),
            });
            continue;
          }
          const allowedKinds = ["folder", "page", "canvas", "plan", "project", "auto"] as const;
          const allowedModes = ["one_shot", "agentic"] as const;
          const kindArg = typeof args.kind === "string" ? args.kind : "";
          const modeArg = typeof args.mode === "string" ? args.mode : "";
          const kind = (allowedKinds as readonly string[]).includes(kindArg)
            ? (kindArg as (typeof allowedKinds)[number])
            : "auto";
          const mode = (allowedModes as readonly string[]).includes(modeArg)
            ? (modeArg as (typeof allowedModes)[number])
            : "agentic";
          const prompt = String(args.prompt ?? data.question).slice(0, 4000);

          const result = await runArtifactGeneration({
            workspace_id: data.workspace_id,
            user_id: userId,
            division_id: divisionId,
            folder_id: scopeFolderId,
            kind,
            mode,
            prompt,
            apiKey,
          });
          if ("ok" in result && result.ok) {
            for (const c of result.created) created.push(c);
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({
                ok: true,
                summary: result.summary,
                created: result.created.map((c) => ({ kind: c.kind, title: c.title, path: c.path })),
              }),
            });
          } else {
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ error: (result as { error: string }).error }),
            });
          }
        }

        // If we asked clarifying questions, stop the loop — wait for the user's reply.
        if (pendingClarify) {
          conversationId = await persistAuraExchange({
            conversationId, userId, workspaceId: data.workspace_id,
            question: data.question, answer: pendingClarify.preface, citations: [],
            created, persistedHistory,
          });
          return {
            ok: true as const,
            conversation_id: conversationId,
            answer: pendingClarify.preface,
            citations: [] as Citation[],
            created,
            clarify: pendingClarify,
          };
        }
      }

      // Fallback if model never returned a final message
      const fallbackAnswer = created.length ? `Created ${created.length} item(s).` : "(no response)";
      conversationId = await persistAuraExchange({
        conversationId, userId, workspaceId: data.workspace_id,
        question: data.question, answer: fallbackAnswer, citations: [], created, persistedHistory,
      });
      return {
        ok: true as const,
        conversation_id: conversationId,
        answer: fallbackAnswer,
        citations: [] as Citation[],
        created,
        clarify: null,
      };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Assistant failed",
      };
    }
  });
