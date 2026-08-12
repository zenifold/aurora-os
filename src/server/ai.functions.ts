import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiGenerateCanvasElements } from "./canvas-ai.functions";

const MAX_DEPTH = 3;
const MAX_ITERATIONS = 6;

interface ToolCallLog {
  iteration: number;
  name: string;
  arguments: Record<string, unknown>;
  result: { ok: boolean; data?: unknown; error?: string };
  at: string;
}

interface OpenRouterMessage {
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

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "create_subtask",
      description:
        "Create a new subtask under the current task. Use to break work into smaller units.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short imperative title" },
          description: { type: "string", description: "Optional details" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "assign_agent",
      description:
        "Assign an AI agent to work on a task. The agent will execute autonomously and may itself create subtasks or assign other agents. Use to delegate specialized work.",
      parameters: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "Task UUID. Use a subtask you just created, or the current task.",
          },
          agent_id: {
            type: "string",
            description: "Agent UUID from the available_agents list in the system prompt.",
          },
          instructions: { type: "string", description: "What this agent should accomplish" },
        },
        required: ["task_id", "agent_id", "instructions"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "post_comment",
      description: "Post a comment on the current task to communicate progress, findings, or questions.",
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
      name: "create_page",
      description:
        "Create a collaborative page (PRD, runbook, decision log, doc) attached to the project. Use to capture deliverables.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          page_type: {
            type: "string",
            enum: ["doc", "prd", "decision", "runbook", "meeting_notes"],
          },
          markdown: {
            type: "string",
            description: "Body in plain markdown-ish text. Use # for headings, - for bullets.",
          },
        },
        required: ["title", "markdown"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "upload_file",
      description:
        "Generate a deliverable file (markdown, csv, json, or plain text) and store it as a project document. Use for reports, exports, structured data, or any artifact a human will download.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Filename with extension, e.g. risk-register.csv" },
          content: { type: "string", description: "Full file contents as a string." },
          document_type: {
            type: "string",
            enum: ["sow", "contract", "msa", "amendment", "proposal", "invoice", "timesheet", "legal", "compliance", "other"],
            description: "Categorization. Use 'other' for generic deliverables.",
          },
          description: { type: "string" },
        },
        required: ["filename", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_diagram",
      description:
        "Create a page containing a Mermaid diagram (flowchart, sequence, decision tree, ER, gantt). Use for architecture, decision trees, process flows.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          mermaid: {
            type: "string",
            description: "Valid Mermaid syntax. Start with a directive like 'graph TD', 'sequenceDiagram', 'flowchart LR', etc. Do NOT include ```mermaid fences.",
          },
          notes: { type: "string", description: "Optional explanation rendered above the diagram." },
        },
        required: ["title", "mermaid"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_status_report",
      description:
        "Generate a status report page summarizing recent project activity (tasks completed, comments, milestones) over the last N days. Posts the report as a journal-style page on the project.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Look-back window in days (default 7)." },
          audience: {
            type: "string",
            enum: ["internal", "client"],
            description: "Tone & detail level. 'client' is higher-level, 'internal' is detailed.",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_canvas",
      description:
        "Create an editable visual canvas page (Excalidraw scene) for wireframes, flowcharts, user journeys, system diagrams, or mind maps. The AI drafts the scene; users can then drag, edit, and add shapes visually. Prefer this over create_diagram when humans need to edit the result visually.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          prompt: {
            type: "string",
            description:
              "What the canvas should depict, in plain language. e.g. 'login flow for a mobile app with email + Google OAuth'.",
          },
        },
        required: ["title", "prompt"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_folder_tree",
      description:
        "Create a hierarchy of folders (and optionally a project) by specifying a parent folder PATH inside a top-level section. Use this to autonomously build out workspace structure. Existing folders along the path are reused (idempotent). Path segments are matched case-insensitively by name. Examples: { division: 'delivery', path: ['Acme Corp', 'Website Redesign'] } creates Acme Corp → Website Redesign if missing.",
      parameters: {
        type: "object",
        properties: {
          division: {
            type: "string",
            description:
              "Top-level section identifier. Match by slug (e.g. 'delivery', 'ops') or name (e.g. 'Sales'). Required.",
          },
          path: {
            type: "array",
            items: { type: "string" },
            description:
              "Ordered folder names from the top-level section down to the leaf folder to create or ensure. Empty array = no folders, just resolves the division.",
          },
          folder_type: {
            type: "string",
            enum: ["client", "portfolio", "project", "phase", "generic"],
            description: "Type for the LEAF folder. Defaults to 'generic'.",
          },
          description: { type: "string", description: "Optional description for the leaf folder." },
          create_project: {
            type: "object",
            description:
              "If provided, also creates a project inside the leaf folder.",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              is_client_project: { type: "boolean" },
              client_name: { type: "string" },
            },
            required: ["name"],
          },
        },
        required: ["division", "path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "finish",
      description:
        "Signal that the task is complete. Provide a final summary of work performed and links to deliverables.",
      parameters: {
        type: "object",
        properties: { summary: { type: "string" } },
        required: ["summary"],
      },
    },
  },
];

/* --------------------------------- helpers --------------------------------- */

function markdownToTipTap(md: string) {
  const lines = md.split(/\r?\n/);
  const nodes: unknown[] = [];
  let bullets: string[] | null = null;
  const flushBullets = () => {
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
      flushBullets();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushBullets();
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
    flushBullets();
    nodes.push({ type: "paragraph", content: [{ type: "text", text: line }] });
  }
  flushBullets();
  if (nodes.length === 0) nodes.push({ type: "paragraph" });
  return { type: "doc", content: nodes };
}

async function execTool(
  name: string,
  args: Record<string, unknown>,
  ctx: {
    workspaceId: string;
    taskId: string;
    projectId: string;
    userId: string | null;
    assignmentId: string;
    depth: number;
    apiKey: string;
  },
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    if (name === "create_subtask") {
      const title = String(args.title ?? "").slice(0, 200);
      if (!title) return { ok: false, error: "title required" };
      const priority = ["low", "medium", "high"].includes(String(args.priority))
        ? (args.priority as string)
        : "medium";
      const description = args.description
        ? {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: String(args.description) }] },
            ],
          }
        : null;
      const { data: row, error } = await supabaseAdmin
        .from("tasks")
        .insert({
          workspace_id: ctx.workspaceId,
          project_id: ctx.projectId,
          parent_task_id: ctx.taskId,
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
      return { ok: true, data: row };
    }

    if (name === "post_comment") {
      const text = String(args.content ?? "").slice(0, 4000);
      if (!text) return { ok: false, error: "content required" };
      const { error } = await supabaseAdmin.from("comments").insert({
        workspace_id: ctx.workspaceId,
        task_id: ctx.taskId,
        author_id: ctx.userId,
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: `🤖 ${text}` }] },
          ],
        },
      } as never);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    if (name === "create_page") {
      const title = String(args.title ?? "").slice(0, 200);
      const md = String(args.markdown ?? "");
      const page_type = ["doc", "prd", "decision", "runbook", "meeting_notes"].includes(
        String(args.page_type),
      )
        ? (args.page_type as string)
        : "doc";
      if (!title || !md) return { ok: false, error: "title and markdown required" };
      const content = markdownToTipTap(md);
      const contentText = md.slice(0, 50000);
      const { data: page, error } = await supabaseAdmin
        .from("pages")
        .insert({
          workspace_id: ctx.workspaceId,
          scope: "project",
          scope_id: ctx.projectId,
          page_type,
          title,
          icon: "✨",
          content: content as never,
          content_text: contentText,
          created_by: ctx.userId,
          updated_by: ctx.userId,
        } as never)
        .select("id, title")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: page };
    }

    if (name === "upload_file") {
      const filename = String(args.filename ?? "").slice(0, 200).replace(/[^\w.\-]/g, "_");
      const content = String(args.content ?? "");
      if (!filename || !content) return { ok: false, error: "filename and content required" };
      const doc_type = ["sow","contract","msa","amendment","proposal","invoice","timesheet","legal","compliance","other"].includes(String(args.document_type))
        ? (args.document_type as string) : "other";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "txt";
      const mimeMap: Record<string, string> = {
        md: "text/markdown", csv: "text/csv", json: "application/json",
        txt: "text/plain", html: "text/html", xml: "application/xml", yaml: "text/yaml", yml: "text/yaml",
      };
      const mime = mimeMap[ext] ?? "text/plain";
      const path = `${ctx.workspaceId}/${ctx.projectId}/ai/${Date.now()}-${filename}`;
      const bytes = new TextEncoder().encode(content);
      const { error: upErr } = await supabaseAdmin.storage
        .from("project-documents")
        .upload(path, bytes, { contentType: mime, upsert: false });
      if (upErr) return { ok: false, error: upErr.message };
      const { data: doc, error } = await supabaseAdmin
        .from("project_documents")
        .insert({
          workspace_id: ctx.workspaceId,
          project_id: ctx.projectId,
          name: filename,
          description: args.description ? String(args.description) : null,
          document_type: doc_type,
          file_path: path,
          file_size_bytes: bytes.byteLength,
          mime_type: mime,
          uploaded_by: ctx.userId,
        } as never)
        .select("id, name, file_path")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: doc };
    }

    if (name === "create_diagram") {
      const title = String(args.title ?? "").slice(0, 200);
      const mermaid = String(args.mermaid ?? "").trim().replace(/^```mermaid\s*|```$/g, "");
      const notes = args.notes ? String(args.notes) : "";
      if (!title || !mermaid) return { ok: false, error: "title and mermaid required" };
      const docContent: Record<string, unknown> = {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: title }] },
          ...(notes ? [{ type: "paragraph", content: [{ type: "text", text: notes }] }] : []),
          {
            type: "codeBlock",
            attrs: { language: "mermaid" },
            content: [{ type: "text", text: mermaid }],
          },
        ],
      };
      const { data: page, error } = await supabaseAdmin
        .from("pages")
        .insert({
          workspace_id: ctx.workspaceId,
          scope: "project",
          scope_id: ctx.projectId,
          page_type: "doc",
          title,
          icon: "📊",
          content: docContent as never,
          content_text: `${notes}\n\n${mermaid}`.slice(0, 50000),
          created_by: ctx.userId,
          updated_by: ctx.userId,
        } as never)
        .select("id, title")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: page };
    }

    if (name === "generate_status_report") {
      const days = Math.max(1, Math.min(90, Number(args.days) || 7));
      const audience = args.audience === "client" ? "client" : "internal";
      const since = new Date(Date.now() - days * 86400000).toISOString();

      const [{ data: doneTasks }, { data: openTasks }, { data: recentComments }, { data: ms }] = await Promise.all([
        supabaseAdmin.from("tasks").select("id,title,status,priority,updated_at").eq("project_id", ctx.projectId).eq("status", "done").gte("updated_at", since).limit(50),
        supabaseAdmin.from("tasks").select("id,title,status,priority,due_date").eq("project_id", ctx.projectId).neq("status", "done").limit(50),
        supabaseAdmin.from("comments").select("content,created_at,task_id").gte("created_at", since).limit(30),
        supabaseAdmin.from("milestones").select("name,status,target_date,actual_date").eq("project_id", ctx.projectId).limit(20),
      ]);

      const summary = {
        window_days: days,
        completed_tasks: doneTasks ?? [],
        in_flight_tasks: openTasks ?? [],
        recent_comments: recentComments ?? [],
        milestones: ms ?? [],
      };

      const userTone = audience === "client"
        ? "Write a concise client-facing status report. Avoid jargon. Highlight progress, value delivered, upcoming milestones, and any items needing client input. No internal-only details."
        : "Write a detailed internal status report. Cover what shipped, what is in flight, blockers/risks, decisions needed, and next steps.";

      const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "xiaomi/mimo-v2-flash",
          temperature: 0.3,
          max_tokens: 1500,
          messages: [
            { role: "system", content: "You produce structured project status reports in markdown with clear headings (## Highlights, ## In Flight, ## Risks, ## Next Steps). Use bullet points." },
            { role: "user", content: `${userTone}\n\nActivity data (JSON):\n${JSON.stringify(summary).slice(0, 8000)}` },
          ],
        }),
      });
      if (!aiRes.ok) return { ok: false, error: `Status report AI failed: ${aiRes.status}` };
      const aiJson = await aiRes.json() as { choices?: { message?: { content?: string } }[] };
      const md = aiJson.choices?.[0]?.message?.content ?? "";
      if (!md) return { ok: false, error: "Empty AI response" };

      const title = `Status Report — ${new Date().toISOString().slice(0, 10)} (${audience})`;
      const content = markdownToTipTap(md);
      const { data: page, error } = await supabaseAdmin
        .from("pages")
        .insert({
          workspace_id: ctx.workspaceId,
          scope: "project",
          scope_id: ctx.projectId,
          page_type: "journal",
          title,
          icon: "📈",
          content: content as never,
          content_text: md.slice(0, 50000),
          created_by: ctx.userId,
          updated_by: ctx.userId,
        } as never)
        .select("id, title")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: page };
    }

    if (name === "create_canvas") {
      const title = String(args.title ?? "").slice(0, 200);
      const prompt = String(args.prompt ?? "").slice(0, 2000);
      if (!title || !prompt) return { ok: false, error: "title and prompt required" };
      let elements: Record<string, unknown>[] = [];
      try {
        elements = await aiGenerateCanvasElements(ctx.apiKey, prompt);
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
      const scene = { type: "excalidraw", elements, appState: {}, files: {} };
      const { data: page, error } = await supabaseAdmin
        .from("pages")
        .insert({
          workspace_id: ctx.workspaceId,
          scope: "project",
          scope_id: ctx.projectId,
          page_type: "canvas",
          title,
          icon: "🎨",
          content: scene as never,
          content_text: prompt.slice(0, 50000),
          created_by: ctx.userId,
          updated_by: ctx.userId,
        } as never)
        .select("id, title")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: { ...page, element_count: elements.length } };
    }

    if (name === "create_folder_tree") {
      // Divisions removed — feature disabled.
      return { ok: false, error: "Divisions feature has been removed." };
    }

    if (name === "assign_agent") {
      if (ctx.depth >= MAX_DEPTH) {
        return { ok: false, error: `Max delegation depth (${MAX_DEPTH}) reached.` };
      }
      const taskId = String(args.task_id ?? "");
      const agentId = String(args.agent_id ?? "");
      const instructions = String(args.instructions ?? "");
      if (!taskId || !agentId) return { ok: false, error: "task_id and agent_id required" };

      // Verify task & agent in same workspace
      const [{ data: task }, { data: agent }] = await Promise.all([
        supabaseAdmin
          .from("tasks")
          .select("id, workspace_id")
          .eq("id", taskId)
          .maybeSingle(),
        supabaseAdmin
          .from("ai_agents")
          .select("id, workspace_id, is_active")
          .eq("id", agentId)
          .maybeSingle(),
      ]);
      if (!task || task.workspace_id !== ctx.workspaceId)
        return { ok: false, error: "Task not in workspace" };
      if (!agent || agent.workspace_id !== ctx.workspaceId || !agent.is_active)
        return { ok: false, error: "Agent not available" };

      const { data: child, error } = await supabaseAdmin
        .from("ai_task_assignments")
        .insert({
          workspace_id: ctx.workspaceId,
          task_id: taskId,
          agent_id: agentId,
          instructions: instructions || null,
          created_by: ctx.userId,
          status: "queued",
          parent_assignment_id: ctx.assignmentId,
          depth: ctx.depth + 1,
        } as never)
        .select("id")
        .single();
      if (error || !child) return { ok: false, error: error?.message ?? "Failed" };

      // Run synchronously so the parent agent can react to results.
      const result = await runAgentLoop(child.id);
      return { ok: result.ok, data: { child_assignment_id: child.id, output: result.output, error: result.error } };
    }

    return { ok: false, error: `Unknown tool: ${name}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
  tools: typeof TOOLS,
  temperature: number,
  maxTokens: number,
): Promise<{
  content: string | null;
  tool_calls?: NonNullable<OpenRouterMessage["tool_calls"]>;
  tokens?: number;
  model?: string;
}> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/zenifold/aurora-os",
      "X-Title": "Aurora Agentic",
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      tools,
      tool_choice: "auto",
      messages,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${txt.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: OpenRouterMessage }[];
    usage?: { total_tokens?: number };
    model?: string;
  };
  const msg = json.choices?.[0]?.message;
  return {
    content: msg?.content ?? null,
    tool_calls: msg?.tool_calls,
    tokens: json.usage?.total_tokens,
    model: json.model,
  };
}

/**
 * Core agentic loop. Returns when the model calls finish, runs out of iterations,
 * or stops calling tools.
 */
async function runAgentLoop(
  assignmentId: string,
): Promise<{ ok: boolean; output?: string; error?: string }> {
  const { data: assignment } = await supabaseAdmin
    .from("ai_task_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) return { ok: false, error: "Assignment not found" };

  const { data: agent } = await supabaseAdmin
    .from("ai_agents")
    .select("*")
    .eq("id", assignment.agent_id)
    .maybeSingle();
  if (!agent) {
    await supabaseAdmin
      .from("ai_task_assignments")
      .update({ status: "failed", error_message: "Agent not found", completed_at: new Date().toISOString() })
      .eq("id", assignmentId);
    return { ok: false, error: "Agent not found" };
  }

  const { data: task } = await supabaseAdmin
    .from("tasks")
    .select("id, project_id, workspace_id, title, description, status, priority, due_date, tags")
    .eq("id", assignment.task_id)
    .maybeSingle();
  if (!task) {
    await supabaseAdmin
      .from("ai_task_assignments")
      .update({ status: "failed", error_message: "Task not found", completed_at: new Date().toISOString() })
      .eq("id", assignmentId);
    return { ok: false, error: "Task not found" };
  }

  const { data: secret } = await supabaseAdmin
    .from("workspace_ai_secrets")
    .select("openrouter_api_key")
    .eq("workspace_id", assignment.workspace_id)
    .maybeSingle();
  const apiKey = secret?.openrouter_api_key;
  if (!apiKey) {
    await supabaseAdmin
      .from("ai_task_assignments")
      .update({
        status: "failed",
        error_message: "No OpenRouter API key configured. Add one in Settings → AI.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", assignmentId);
    return { ok: false, error: "No API key" };
  }

  // Load other agents for delegation
  const { data: agents } = await supabaseAdmin
    .from("ai_agents")
    .select("id, name, description, avatar_emoji")
    .eq("workspace_id", assignment.workspace_id)
    .eq("is_active", true);

  const agentDirectory = (agents ?? [])
    .map((a) => `- ${a.id} :: ${a.avatar_emoji ?? "🤖"} ${a.name}${a.description ? " — " + a.description : ""}`)
    .join("\n");

  const descText = task.description
    ? typeof task.description === "string"
      ? task.description
      : JSON.stringify(task.description).slice(0, 2000)
    : "(no description)";

  const systemMessage = [
    agent.system_prompt,
    "",
    "You are an autonomous agent working on a task. Your tools:",
    "- create_subtask: break work into smaller items",
    "- post_comment: communicate progress on the task",
    "- create_page: write PRDs, runbooks, decision logs",
    "- create_diagram: draw Mermaid diagrams (flowcharts, decision trees, architecture)",
    "- create_canvas: draft an editable visual canvas (Excalidraw) for wireframes, flowcharts, user journeys, system maps — humans can edit shapes after",
    "- upload_file: produce real downloadable deliverables (CSV, JSON, MD reports) into project documents",
    "- generate_status_report: AI-summarize recent project activity into a status page",
    "- create_folder_tree: build out org structure by section + folder path (idempotent), optionally creating a project at the leaf",
    "- assign_agent: DELEGATE to another AI agent (recursive)",
    "- finish: signal completion with a summary",
    "Prefer concrete artifacts (pages, files, diagrams) over plain comments. When the work is large or specialized, break it down and delegate.",
    `Recursion depth: you are at depth ${assignment.depth}. Max depth is ${MAX_DEPTH}.`,
    "When the task is large or needs specialized skills, break it into subtasks and assign agents to them. When done, call finish with a summary.",
    "",
    "Available agents you can delegate to:",
    agentDirectory || "(none)",
  ].join("\n");

  const userPrompt = [
    `Task ID: ${task.id}`,
    `Title: ${task.title}`,
    `Status: ${task.status} · Priority: ${task.priority}`,
    task.due_date ? `Due: ${task.due_date}` : null,
    task.tags?.length ? `Tags: ${task.tags.join(", ")}` : null,
    "",
    "Description:",
    descText,
    "",
    assignment.instructions ? `Instructions:\n${assignment.instructions}` : "Plan and execute. Use tools.",
  ]
    .filter(Boolean)
    .join("\n");

  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemMessage },
    { role: "user", content: userPrompt },
  ];

  await supabaseAdmin
    .from("ai_task_assignments")
    .update({ status: "running", started_at: new Date().toISOString(), error_message: null })
    .eq("id", assignmentId);

  const toolLog: ToolCallLog[] = Array.isArray(assignment.tool_calls)
    ? (assignment.tool_calls as unknown as ToolCallLog[])
    : [];
  let totalTokens = 0;
  let lastModel = agent.model;
  let finalOutput = "";

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const resp = await callOpenRouter(
        apiKey,
        agent.model,
        messages,
        TOOLS,
        Number(agent.temperature),
        agent.max_tokens,
      );
      totalTokens += resp.tokens ?? 0;
      lastModel = resp.model ?? lastModel;

      // No tool calls → final answer
      if (!resp.tool_calls || resp.tool_calls.length === 0) {
        finalOutput = resp.content ?? "";
        break;
      }

      // Append assistant turn (with tool_calls)
      messages.push({
        role: "assistant",
        content: resp.content,
        tool_calls: resp.tool_calls,
      });

      let finished = false;

      for (const tc of resp.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }

        if (tc.function.name === "finish") {
          finalOutput = String(args.summary ?? resp.content ?? "");
          toolLog.push({
            iteration: iter,
            name: "finish",
            arguments: args,
            result: { ok: true },
            at: new Date().toISOString(),
          });
          finished = true;
          break;
        }

        const result = await execTool(tc.function.name, args, {
          workspaceId: assignment.workspace_id,
          taskId: task.id,
          projectId: task.project_id,
          userId: assignment.created_by,
          assignmentId,
          depth: assignment.depth ?? 0,
          apiKey,
        });

        toolLog.push({
          iteration: iter,
          name: tc.function.name,
          arguments: args,
          result,
          at: new Date().toISOString(),
        });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(result).slice(0, 4000),
        });
      }

      // Persist progress for live UI
      await supabaseAdmin
        .from("ai_task_assignments")
        .update({
          tool_calls: toolLog as never,
          iterations: iter + 1,
          tokens_used: totalTokens,
        })
        .eq("id", assignmentId);

      if (finished) break;
    }

    await supabaseAdmin
      .from("ai_task_assignments")
      .update({
        status: "review_needed",
        output: finalOutput || "(no output)",
        tokens_used: totalTokens,
        model_used: lastModel,
        tool_calls: toolLog as never,
        completed_at: new Date().toISOString(),
      })
      .eq("id", assignmentId);

    return { ok: true, output: finalOutput };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("ai_task_assignments")
      .update({
        status: "failed",
        error_message: message,
        tool_calls: toolLog as never,
        completed_at: new Date().toISOString(),
      })
      .eq("id", assignmentId);
    return { ok: false, error: message };
  }
}

/**
 * Run an AI agent on a task assignment using an agentic loop with tool calls.
 * The agent can spawn subtasks, post comments, create pages, and delegate
 * to other AI agents (recursive, capped at MAX_DEPTH).
 */
export const runAiAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ assignment_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Verify caller has access via RLS
    const { data: assignment, error } = await supabase
      .from("ai_task_assignments")
      .select("id")
      .eq("id", data.assignment_id)
      .single();
    if (error || !assignment) throw new Error("Assignment not found");

    const result = await runAgentLoop(data.assignment_id);
    if (!result.ok) throw new Error(result.error ?? "Agent run failed");
    return { ok: true, output: result.output };
  });
