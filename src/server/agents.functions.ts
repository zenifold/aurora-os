import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Agentic Aura — Phase 1 server functions.
 * Agent identity CRUD, tool registry, executions, approvals.
 */

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

// ─── Agents ──────────────────────────────────────────────────────────────────

export const listAgents = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a member" };

    const { data: rows, error } = await supabaseAdmin
      .from("ai_agents")
      .select("*")
      .eq("workspace_id", data.workspace_id)
      .order("created_at", { ascending: true });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, agents: rows ?? [] };
  });

export const upsertAgent = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        workspace_id: z.string().uuid(),
        name: z.string().min(1).max(80),
        handle: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/i).optional(),
        description: z.string().max(500).optional(),
        avatar_emoji: z.string().max(8).optional(),
        avatar_url: z.string().url().optional().nullable(),
        capabilities: z.array(z.string()).default([]),
        autonomy_level: z.enum(["suggest", "bounded", "autonomous"]).default("suggest"),
        guardrails: z.record(z.string(), z.any()).optional(),
        system_prompt: z.string().min(1).max(4000).optional(),
        model_config: z.record(z.string(), z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a member" };

    const payload: Record<string, unknown> = {
      workspace_id: data.workspace_id,
      name: data.name,
      handle: data.handle ?? null,
      description: data.description ?? null,
      avatar_emoji: data.avatar_emoji ?? "🤖",
      avatar_url: data.avatar_url ?? null,
      capabilities: data.capabilities,
      autonomy_level: data.autonomy_level,
      created_by: userId,
    };
    if (data.guardrails) payload.guardrails = data.guardrails;
    if (data.system_prompt) payload.system_prompt = data.system_prompt;
    if (data.model_config) payload.model_config = data.model_config;

    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("ai_agents")
        .update(payload as never)
        .eq("id", data.id)
        .select("*")
        .maybeSingle();
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, agent: row };
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("ai_agents")
        .insert(payload as never)
        .select("*")
        .maybeSingle();
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, agent: row };
    }
  });

export const deleteAgent = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    const { error } = await supabaseAdmin.from("ai_agents").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ─── Tools registry ──────────────────────────────────────────────────────────

const DEFAULT_TOOLS = [
  {
    name: "create_task",
    description: "Create a task in Aura",
    tool_type: "internal_api" as const,
    requires_approval: false,
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        project_id: { type: "string" },
        assignee_id: { type: "string" },
        due_date: { type: "string", format: "date" },
        priority: { enum: ["low", "medium", "high", "urgent"] },
        description: { type: "string" },
      },
      required: ["title", "project_id"],
    },
  },
  {
    name: "send_email",
    description: "Send an email to an external recipient",
    tool_type: "external_api" as const,
    requires_approval: true,
    schema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "query_database",
    description: "Query Aura workspace data",
    tool_type: "internal_api" as const,
    requires_approval: false,
    schema: {
      type: "object",
      properties: {
        query_type: { enum: ["tasks", "projects", "resources", "time_logs", "financials"] },
        filters: { type: "object" },
      },
    },
  },
  {
    name: "generate_document",
    description: "Create a note or document",
    tool_type: "internal_api" as const,
    requires_approval: false,
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        document_type: { enum: ["note", "proposal", "report", "email_draft"] },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "notify_human",
    description: "Send notification to a team member",
    tool_type: "internal_api" as const,
    requires_approval: false,
    schema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        message: { type: "string" },
        urgency: { enum: ["low", "medium", "high", "blocking"] },
      },
      required: ["user_id", "message"],
    },
  },
  {
    name: "human_handoff",
    description: "Escalate to a human when blocked or needing approval",
    tool_type: "human_handoff" as const,
    requires_approval: false,
    schema: {
      type: "object",
      properties: {
        reason: { type: "string" },
        context: { type: "string" },
        suggested_action: { type: "string" },
      },
      required: ["reason"],
    },
  },
  {
    name: "remember",
    description: "Store a long-term memory about a preference, outcome, person, or pattern.",
    tool_type: "internal_api" as const,
    requires_approval: false,
    schema: {
      type: "object",
      properties: {
        memory_type: { enum: ["preference", "outcome", "relationship", "pattern", "feedback"] },
        content: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["memory_type", "content"],
    },
  },
  {
    name: "delegate_to_agent",
    description: "Hand a sub-goal to another agent by handle. Creates a child run.",
    tool_type: "internal_api" as const,
    requires_approval: false,
    schema: {
      type: "object",
      properties: {
        handle: { type: "string" },
        goal: { type: "string" },
      },
      required: ["handle", "goal"],
    },
  },
  {
    name: "find_project",
    description: "Find projects by fuzzy name match. Returns up to 5 with id, name, status.",
    tool_type: "internal_api" as const,
    requires_approval: false,
    schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "find_task",
    description: "Find tasks by title (fuzzy). Optional project_id filter.",
    tool_type: "internal_api" as const,
    requires_approval: false,
    schema: {
      type: "object",
      properties: { query: { type: "string" }, project_id: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "update_task",
    description: "Update fields on an existing task. Provide task_id and any subset of fields.",
    tool_type: "internal_api" as const,
    requires_approval: false,
    schema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        status: { enum: ["todo", "in_progress", "in_review", "done", "blocked"] },
        priority: { enum: ["low", "medium", "high", "urgent"] },
        due_date: { type: "string", format: "date" },
        assignee_id: { type: "string" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "complete_task",
    description: "Mark a task as done by id.",
    tool_type: "internal_api" as const,
    requires_approval: false,
    schema: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] },
  },
  {
    name: "list_overdue_tasks",
    description: "List tasks past their due date and not done. Optional project_id.",
    tool_type: "internal_api" as const,
    requires_approval: false,
    schema: {
      type: "object",
      properties: { project_id: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "update_milestone",
    description: "Update a milestone status or actual_date.",
    tool_type: "internal_api" as const,
    requires_approval: false,
    schema: {
      type: "object",
      properties: {
        milestone_id: { type: "string" },
        status: { enum: ["upcoming", "at_risk", "completed", "missed"] },
        actual_date: { type: "string", format: "date" },
      },
      required: ["milestone_id"],
    },
  },
  {
    name: "post_status_update",
    description: "Draft a project status update (RAG, accomplishments, risks, asks).",
    tool_type: "internal_api" as const,
    requires_approval: true,
    schema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        headline: { type: "string" },
        health: { enum: ["green", "yellow", "red"] },
        accomplishments: { type: "string" },
        risks: { type: "string" },
        asks: { type: "string" },
        next_period: { type: "string" },
      },
      required: ["project_id", "health"],
    },
  },
  {
    name: "create_invoice_draft",
    description: "Create a draft invoice for a project. Approval required before sending.",
    tool_type: "internal_api" as const,
    requires_approval: true,
    schema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        subtotal: { type: "number" },
        tax_rate: { type: "number" },
        currency: { type: "string" },
        notes: { type: "string" },
      },
      required: ["project_id", "subtotal"],
    },
  },
  {
    name: "summarize_project",
    description: "Get project stats: task counts by status, overdue, milestones.",
    tool_type: "internal_api" as const,
    requires_approval: false,
    schema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] },
  },
];

export const listAgentTools = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a member" };

    const { data: rows, error } = await supabaseAdmin
      .from("agent_tools")
      .select("*")
      .eq("workspace_id", data.workspace_id)
      .order("name");
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, tools: rows ?? [] };
  });

export const seedDefaultTools = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a member" };

    const rows = DEFAULT_TOOLS.map((t) => ({
      workspace_id: data.workspace_id,
      ...t,
    }));
    const { error } = await supabaseAdmin
      .from("agent_tools")
      .upsert(rows as never, { onConflict: "workspace_id,name" });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, count: rows.length };
  });

// ─── Executions & approvals ──────────────────────────────────────────────────

export const listAgentExecutions = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        agent_id: z.string().uuid().optional(),
        status: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(40),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a member" };

    let q = supabaseAdmin
      .from("agent_executions")
      .select("*")
      .eq("workspace_id", data.workspace_id)
      .order("started_at", { ascending: false })
      .limit(data.limit);
    if (data.agent_id) q = q.eq("agent_id", data.agent_id);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, executions: rows ?? [] };
  });

export const listPendingApprovals = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a member" };

    const { data: rows, error } = await supabaseAdmin
      .from("agent_action_approvals")
      .select("*, agent:ai_agents(id,name,handle,avatar_emoji,avatar_url)")
      .eq("workspace_id", data.workspace_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, approvals: rows ?? [] };
  });

export const decideApproval = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };

    // Load approval
    const { data: appr } = await supabaseAdmin
      .from("agent_action_approvals")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!appr) return { ok: false as const, error: "Approval not found" };

    if (data.decision === "rejected") {
      await supabaseAdmin
        .from("agent_action_approvals")
        .update({
          status: "rejected",
          decided_by: userId,
          decided_at: new Date().toISOString(),
          decision_note: data.note ?? null,
        } as never)
        .eq("id", data.id);
      return { ok: true as const };
    }

    // Approved — try to execute the underlying action
    const result = await runTool({
      workspaceId: appr.workspace_id as string,
      agentId: appr.agent_id as string,
      executionId: (appr.execution_id as string) ?? null,
      tool: appr.tool_name as string,
      payload: (appr.payload as Record<string, unknown>) ?? {},
      actorId: userId,
    });

    await supabaseAdmin
      .from("agent_action_approvals")
      .update({
        status: result.ok ? "executed" : "rejected",
        decided_by: userId,
        decided_at: new Date().toISOString(),
        decision_note: data.note ?? (result.ok ? null : result.error),
      } as never)
      .eq("id", data.id);

    return result.ok
      ? { ok: true as const }
      : { ok: false as const, error: result.error };
  });

// ─── Tool dispatcher ─────────────────────────────────────────────────────────

type ToolResult = { ok: true; data?: unknown } | { ok: false; error: string };

async function runTool(args: {
  workspaceId: string;
  agentId: string;
  executionId: string | null;
  tool: string;
  payload: Record<string, unknown>;
  actorId: string;
}): Promise<ToolResult> {
  const { workspaceId, payload, actorId } = args;
  try {
    switch (args.tool) {
      case "create_task": {
        let projectId: string | null = (payload.project_id as string | undefined) ?? null;
        if (!projectId) {
          const { data: p } = await supabaseAdmin
            .from("projects")
            .select("id")
            .eq("workspace_id", workspaceId)
            .limit(1)
            .maybeSingle();
          projectId = (p?.id as string | undefined) ?? null;
        }
        if (!projectId) return { ok: false, error: "No project available" };
        const title = String(payload.title ?? "Untitled task");
        const priority = (payload.priority as string) ?? "medium";
        const due = (payload.due_date as string) ?? null;
        const desc = payload.description
          ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: String(payload.description) }] }] }
          : null;
        const { data: row, error } = await supabaseAdmin
          .from("tasks")
          .insert({
            workspace_id: workspaceId,
            project_id: projectId,
            title,
            priority: priority as never,
            due_date: due,
            description: desc as never,
            created_by: actorId,
          } as never)
          .select("id")
          .maybeSingle();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: row };
      }
      case "generate_document": {
        const { data: row, error } = await supabaseAdmin
          .from("notes")
          .insert({
            workspace_id: workspaceId,
            created_by: actorId,
            title: String(payload.title ?? "Agent note"),
            content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: String(payload.content ?? "") }] }] } as never,
          } as never)
          .select("id")
          .maybeSingle();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: row };
      }
      case "notify_human": {
        const recipient = (payload.user_id as string) ?? actorId;
        const { error } = await supabaseAdmin.from("notifications").insert({
          workspace_id: workspaceId,
          recipient_id: recipient,
          type: "agent_message",
          title: "Agent update",
          body: String(payload.message ?? ""),
        } as never);
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      }
      case "query_database": {
        const qt = (payload.query_type as string) ?? "tasks";
        if (qt === "projects") {
          const { data } = await supabaseAdmin
            .from("projects")
            .select("id,name,status")
            .eq("workspace_id", workspaceId)
            .limit(20);
          return { ok: true, data };
        }
        const { data } = await supabaseAdmin
          .from("tasks")
          .select("id,title,status,priority,due_date")
          .eq("workspace_id", workspaceId)
          .limit(20);
        return { ok: true, data };
      }
      case "remember": {
        const { error } = await supabaseAdmin.from("agent_memories").insert({
          workspace_id: workspaceId,
          agent_id: args.agentId,
          memory_type: String(payload.memory_type ?? "outcome"),
          content: String(payload.content ?? ""),
          confidence: typeof payload.confidence === "number" ? payload.confidence : 0.8,
        } as never);
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      }
      case "delegate_to_agent": {
        const handle = String(payload.handle ?? "").replace(/^@/, "");
        const goal = String(payload.goal ?? "");
        if (!handle || !goal) return { ok: false, error: "handle and goal required" };
        const { data: target } = await supabaseAdmin
          .from("ai_agents")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("handle", handle)
          .maybeSingle();
        if (!target) return { ok: false, error: `No agent @${handle}` };
        const { data: child } = await supabaseAdmin
          .from("agent_executions")
          .insert({
            workspace_id: workspaceId,
            agent_id: target.id,
            parent_execution_id: args.executionId,
            trigger: "user_request",
            goal,
            context: { delegated_by: args.agentId },
            status: "planning",
            requested_by: actorId,
          } as never)
          .select("id")
          .maybeSingle();
        if (!child) return { ok: false, error: "Could not create child run" };
        const result = await runPlanLoop({
          executionId: child.id as string,
          workspaceId,
          agentId: target.id as string,
          actorId,
        });
        return result.ok
          ? { ok: true, data: { child_execution_id: child.id, status: result.status } }
          : { ok: false, error: result.error };
      }
      case "find_project": {
        const q = String(payload.query ?? "").trim();
        if (!q) return { ok: false, error: "query required" };
        const { data } = await supabaseAdmin
          .from("projects")
          .select("id,name,status,health")
          .eq("workspace_id", workspaceId)
          .ilike("name", `%${q}%`)
          .limit(5);
        return { ok: true, data };
      }
      case "find_task": {
        const q = String(payload.query ?? "").trim();
        let qb = supabaseAdmin
          .from("tasks")
          .select("id,title,status,priority,due_date,project_id")
          .eq("workspace_id", workspaceId)
          .ilike("title", `%${q}%`)
          .limit(10);
        if (payload.project_id) qb = qb.eq("project_id", String(payload.project_id));
        const { data } = await qb;
        return { ok: true, data };
      }
      case "update_task": {
        const id = String(payload.task_id ?? "");
        if (!id) return { ok: false, error: "task_id required" };
        const patch: Record<string, unknown> = {};
        if (payload.status) patch.status = payload.status;
        if (payload.priority) patch.priority = payload.priority;
        if (payload.due_date) patch.due_date = payload.due_date;
        if (payload.assignee_id) patch.assignee_id = payload.assignee_id;
        if (Object.keys(patch).length === 0) return { ok: false, error: "no fields to update" };
        const { data, error } = await supabaseAdmin
          .from("tasks")
          .update(patch as never)
          .eq("id", id)
          .eq("workspace_id", workspaceId)
          .select("id,title,status")
          .maybeSingle();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }
      case "complete_task": {
        const id = String(payload.task_id ?? "");
        if (!id) return { ok: false, error: "task_id required" };
        const { data, error } = await supabaseAdmin
          .from("tasks")
          .update({ status: "done", completed_at: new Date().toISOString() } as never)
          .eq("id", id)
          .eq("workspace_id", workspaceId)
          .select("id,title")
          .maybeSingle();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }
      case "list_overdue_tasks": {
        const today = new Date().toISOString().slice(0, 10);
        let qb = supabaseAdmin
          .from("tasks")
          .select("id,title,due_date,priority,project_id,assignee_id")
          .eq("workspace_id", workspaceId)
          .lt("due_date", today)
          .neq("status", "done")
          .order("due_date", { ascending: true })
          .limit(Number(payload.limit ?? 15));
        if (payload.project_id) qb = qb.eq("project_id", String(payload.project_id));
        const { data } = await qb;
        return { ok: true, data };
      }
      case "update_milestone": {
        const id = String(payload.milestone_id ?? "");
        if (!id) return { ok: false, error: "milestone_id required" };
        const patch: Record<string, unknown> = {};
        if (payload.status) patch.status = payload.status;
        if (payload.actual_date) patch.actual_date = payload.actual_date;
        if (Object.keys(patch).length === 0) return { ok: false, error: "no fields" };
        const { data, error } = await supabaseAdmin
          .from("milestones")
          .update(patch as never)
          .eq("id", id)
          .eq("workspace_id", workspaceId)
          .select("id,name,status")
          .maybeSingle();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }
      case "post_status_update": {
        const pid = String(payload.project_id ?? "");
        if (!pid) return { ok: false, error: "project_id required" };
        const { data, error } = await supabaseAdmin
          .from("project_status_updates")
          .insert({
            workspace_id: workspaceId,
            project_id: pid,
            created_by: actorId,
            headline: (payload.headline as string) ?? null,
            health: (payload.health as string) ?? "green",
            accomplishments: (payload.accomplishments as string) ?? null,
            risks: (payload.risks as string) ?? null,
            asks: (payload.asks as string) ?? null,
            next_period: (payload.next_period as string) ?? null,
            ai_generated: true,
            status: "draft",
          } as never)
          .select("id")
          .maybeSingle();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }
      case "create_invoice_draft": {
        const pid = String(payload.project_id ?? "");
        if (!pid) return { ok: false, error: "project_id required" };
        const subtotal = Number(payload.subtotal ?? 0);
        const taxRate = Number(payload.tax_rate ?? 0);
        const taxAmount = +(subtotal * (taxRate / 100)).toFixed(2);
        const total = +(subtotal + taxAmount).toFixed(2);
        const invNum = `AI-${Date.now().toString().slice(-8)}`;
        const { data, error } = await supabaseAdmin
          .from("invoices")
          .insert({
            workspace_id: workspaceId,
            project_id: pid,
            created_by: actorId,
            invoice_number: invNum,
            currency: (payload.currency as string) ?? "USD",
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total,
            notes: (payload.notes as string) ?? null,
            status: "draft",
          } as never)
          .select("id,invoice_number,total")
          .maybeSingle();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }
      case "summarize_project": {
        const pid = String(payload.project_id ?? "");
        if (!pid) return { ok: false, error: "project_id required" };
        const today = new Date().toISOString().slice(0, 10);
        const [tasksRes, overdueRes, milestonesRes] = await Promise.all([
          supabaseAdmin
            .from("tasks")
            .select("status", { count: "exact" })
            .eq("workspace_id", workspaceId)
            .eq("project_id", pid),
          supabaseAdmin
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("project_id", pid)
            .lt("due_date", today)
            .neq("status", "done"),
          supabaseAdmin
            .from("milestones")
            .select("id,name,status,target_date")
            .eq("workspace_id", workspaceId)
            .eq("project_id", pid)
            .order("target_date", { ascending: true })
            .limit(10),
        ]);
        const counts: Record<string, number> = {};
        (tasksRes.data ?? []).forEach((t: any) => {
          counts[t.status] = (counts[t.status] ?? 0) + 1;
        });
        return {
          ok: true,
          data: {
            task_counts: counts,
            overdue_count: overdueRes.count ?? 0,
            milestones: milestonesRes.data ?? [],
          },
        };
      }
      case "send_email":
      case "human_handoff":
        // Recorded but no external side-effect available
        return { ok: true, data: { note: "Logged (no external integration)" } };
      default:
        return { ok: false, error: `Unknown tool: ${args.tool}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Tool failed" };
  }
}

async function recallMemories(workspaceId: string, agentId: string, limit = 8): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("agent_memories")
    .select("memory_type,content")
    .eq("workspace_id", workspaceId)
    .eq("agent_id", agentId)
    .order("last_accessed", { ascending: false })
    .limit(limit);
  return (data ?? []).map((m) => `[${m.memory_type}] ${m.content}`);
}

// ─── Execute: planner + dispatcher ───────────────────────────────────────────

interface PlannedAction {
  tool: string;
  summary: string;
  payload: Record<string, unknown>;
}

async function getOpenRouterKey(workspaceId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("workspace_ai_secrets")
    .select("openrouter_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return (data?.openrouter_api_key as string) ?? null;
}

async function planWithLLM(args: {
  apiKey: string;
  agent: { name: string; system_prompt?: string | null; capabilities?: string[] };
  goal: string;
  toolNames: string[];
  memories?: string[];
  observations?: string[]; // results from prior iterations
  iteration: number;
  maxIterations: number;
}): Promise<{ thought: string; actions: PlannedAction[]; done: boolean }> {
  const memBlock = args.memories && args.memories.length
    ? `\n\nLong-term memories:\n${args.memories.map((m) => `- ${m}`).join("\n")}`
    : "";
  const obsBlock = args.observations && args.observations.length
    ? `\n\nPrior tool observations (results of your earlier actions):\n${args.observations.map((o, i) => `[step ${i + 1}] ${o}`).join("\n")}`
    : "";
  const sys = `You are ${args.agent.name}, an autonomous workspace agent.
${args.agent.system_prompt ?? ""}${memBlock}

You operate in an iterative loop: plan → call tools → observe results → decide if more steps needed.
Iteration ${args.iteration + 1} of max ${args.maxIterations}.

Available tools: ${args.toolNames.join(", ")}.

Respond with STRICT JSON:
{"thought":"reasoning","done":false,"actions":[{"tool":"...","summary":"...","payload":{...}}]}

Set "done":true and an empty actions array when the goal is fully satisfied OR no further useful action is possible.
Use lookup tools (find_project, find_task, list_overdue_tasks, summarize_project, query_database) BEFORE mutating tools when you lack IDs.
Tool payload reference:
- create_task: {title, project_id, description?, priority?, due_date?}
- update_task: {task_id, status?, priority?, due_date?, assignee_id?}
- complete_task: {task_id}
- find_project: {query}
- find_task: {query, project_id?}
- list_overdue_tasks: {project_id?, limit?}
- update_milestone: {milestone_id, status?, actual_date?}
- post_status_update: {project_id, health, headline?, accomplishments?, risks?, asks?, next_period?}
- create_invoice_draft: {project_id, subtotal, tax_rate?, currency?, notes?}
- summarize_project: {project_id}
- generate_document: {title, content}
- notify_human: {user_id?, message}
- query_database: {query_type:"tasks|projects"}
- remember: {memory_type, content}
- delegate_to_agent: {handle, goal}
- human_handoff: {reason, context?}
Return at most 3 actions per iteration. Prefer one focused action when possible.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/zenifold/aurora-os",
      "X-Title": "Aurora Agent Runtime",
    },
    body: JSON.stringify({
      model: "xiaomi/mimo-v2-flash",
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: args.goal + obsBlock },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Planner ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { thought?: string; actions?: PlannedAction[]; done?: boolean };
    return {
      thought: parsed.thought ?? "",
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3) : [],
      done: !!parsed.done,
    };
  } catch {
    return { thought: raw.slice(0, 400), actions: [], done: true };
  }
}

async function runPlanLoop(args: {
  executionId: string;
  workspaceId: string;
  agentId: string;
  actorId: string;
}): Promise<
  | { ok: true; status: "completed" | "awaiting_approval"; actionCount: number }
  | { ok: false; error: string }
> {
  const { executionId, workspaceId, agentId, actorId } = args;

  const { data: exec } = await supabaseAdmin
    .from("agent_executions")
    .select("*")
    .eq("id", executionId)
    .maybeSingle();
  if (!exec) return { ok: false, error: "Execution not found" };

  const { data: agent } = await supabaseAdmin
    .from("ai_agents")
    .select("*")
    .eq("id", agentId)
    .maybeSingle();
  if (!agent) return { ok: false, error: "Agent missing" };

  const { data: tools } = await supabaseAdmin
    .from("agent_tools")
    .select("name,requires_approval")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);
  const toolMap = new Map<string, boolean>(
    (tools ?? []).map((t) => [t.name as string, !!t.requires_approval]),
  );
  if (toolMap.size === 0) {
    await supabaseAdmin.from("agent_tools").upsert(
      DEFAULT_TOOLS.map((t) => ({ workspace_id: workspaceId, ...t })) as never,
      { onConflict: "workspace_id,name" },
    );
    for (const t of DEFAULT_TOOLS) toolMap.set(t.name, t.requires_approval);
  }

  await supabaseAdmin
    .from("agent_executions")
    .update({ status: "running" } as never)
    .eq("id", executionId);

  const apiKey = await getOpenRouterKey(workspaceId);
  if (!apiKey) {
    await supabaseAdmin
      .from("agent_executions")
      .update({
        status: "failed",
        error_message: "AI key not configured for workspace",
        completed_at: new Date().toISOString(),
      } as never)
      .eq("id", executionId);
    await supabaseAdmin.from("ai_agents").update({ status: "error" } as never).eq("id", agentId);
    return { ok: false, error: "AI key missing" };
  }

  const memories = await recallMemories(workspaceId, agentId);
  const autonomy = (agent.autonomy_level as string) ?? "suggest";
  const toolNames = Array.from(toolMap.keys());
  const MAX_ITERATIONS = 5;

  type StepRecord = {
    iteration: number;
    thought: string;
    actions: Array<{ tool: string; status: string; summary: string; result?: unknown; error?: string }>;
  };
  const trace: StepRecord[] = [];
  const observations: string[] = [];
  let queuedAny = false;
  let totalActions = 0;
  let lastThought = "";

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let plan: { thought: string; actions: PlannedAction[]; done: boolean };
    try {
      plan = await planWithLLM({
        apiKey,
        agent: {
          name: agent.name as string,
          system_prompt: agent.system_prompt as string | null,
          capabilities: (agent.capabilities as string[]) ?? [],
        },
        goal: exec.goal as string,
        toolNames,
        memories,
        observations,
        iteration: i,
        maxIterations: MAX_ITERATIONS,
      });
    } catch (e) {
      await supabaseAdmin
        .from("agent_executions")
        .update({
          status: "failed",
          error_message: e instanceof Error ? e.message : "Planning failed",
          actions: trace as never,
          completed_at: new Date().toISOString(),
        } as never)
        .eq("id", executionId);
      await supabaseAdmin.from("ai_agents").update({ status: "error" } as never).eq("id", agentId);
      return { ok: false, error: "Planning failed" };
    }

    lastThought = plan.thought;
    const stepActions: StepRecord["actions"] = [];

    if (plan.actions.length === 0 || plan.done) {
      trace.push({ iteration: i, thought: plan.thought, actions: [] });
      break;
    }

    for (const action of plan.actions) {
      if (!toolMap.has(action.tool)) {
        stepActions.push({ tool: action.tool, status: "skipped", summary: action.summary, error: "Unknown tool" });
        observations.push(`${action.tool}: unknown tool, skipped`);
        continue;
      }
      const needsApproval =
        autonomy === "suggest" ||
        toolMap.get(action.tool) === true ||
        (autonomy === "bounded" && action.tool === "send_email");

      if (needsApproval) {
        await supabaseAdmin.from("agent_action_approvals").insert({
          workspace_id: workspaceId,
          execution_id: executionId,
          agent_id: agentId,
          tool_name: action.tool,
          action_summary: action.summary,
          payload: action.payload,
        } as never);
        stepActions.push({ tool: action.tool, status: "queued", summary: action.summary });
        observations.push(`${action.tool}: queued for human approval`);
        queuedAny = true;
      } else {
        const r = await runTool({
          workspaceId,
          agentId,
          executionId,
          tool: action.tool,
          payload: action.payload ?? {},
          actorId,
        });
        stepActions.push({
          tool: action.tool,
          status: r.ok ? "executed" : "failed",
          summary: action.summary,
          result: r.ok ? r.data : undefined,
          error: r.ok ? undefined : r.error,
        });
        const obsStr = r.ok
          ? `${action.tool}: ok ${JSON.stringify(r.data ?? {}).slice(0, 220)}`
          : `${action.tool}: ERROR ${r.error}`;
        observations.push(obsStr);
      }
      totalActions++;
    }

    trace.push({ iteration: i, thought: plan.thought, actions: stepActions });

    // If we queued approvals, pause the loop — human decision will resume separately.
    if (queuedAny) break;
    // If all actions in this iteration failed, give up.
    if (stepActions.every((s) => s.status === "failed" || s.status === "skipped")) break;
  }

  const finalStatus: "awaiting_approval" | "completed" = queuedAny ? "awaiting_approval" : "completed";
  await supabaseAdmin
    .from("agent_executions")
    .update({
      status: finalStatus,
      plan: trace as never,
      actions: trace as never,
      result: { thought: lastThought, iterations: trace.length, total_actions: totalActions } as never,
      completed_at: queuedAny ? null : new Date().toISOString(),
    } as never)
    .eq("id", executionId);

  await supabaseAdmin
    .from("ai_agents")
    .update({ status: queuedAny ? "blocked" : "idle" } as never)
    .eq("id", agentId);

  // Surface agent activity in the user's notification inbox
  try {
    const agentName = (agent.name as string) ?? "Agent";
    const emoji = (agent.avatar_emoji as string) ?? "🤖";
    if (queuedAny) {
      await supabaseAdmin.from("notifications").insert({
        workspace_id: workspaceId,
        recipient_id: actorId,
        type: "approval",
        title: `${emoji} ${agentName} needs approval`,
        body: lastThought.slice(0, 200) || (exec.goal as string).slice(0, 200),
        link: "/app/approvals",
      } as never);
    } else if (totalActions > 0) {
      await supabaseAdmin.from("notifications").insert({
        workspace_id: workspaceId,
        recipient_id: actorId,
        type: "agent",
        title: `${emoji} ${agentName} finished a run`,
        body: `${totalActions} action${totalActions === 1 ? "" : "s"} · ${(exec.goal as string).slice(0, 120)}`,
        link: `/app/runs/${executionId}`,
      } as never);
    }
  } catch {
    /* notifications are best-effort */
  }

  return { ok: true, status: finalStatus, actionCount: totalActions };
}

export const executeAgent = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ execution_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };

    const { data: exec } = await supabaseAdmin
      .from("agent_executions")
      .select("workspace_id,agent_id")
      .eq("id", data.execution_id)
      .maybeSingle();
    if (!exec) return { ok: false as const, error: "Execution not found" };
    if (!(await ensureMember(exec.workspace_id as string, userId)))
      return { ok: false as const, error: "Not a member" };

    const r = await runPlanLoop({
      executionId: data.execution_id,
      workspaceId: exec.workspace_id as string,
      agentId: exec.agent_id as string,
      actorId: userId,
    });
    if (!r.ok) return { ok: false as const, error: r.error };
    return { ok: true as const, status: r.status, actionCount: r.actionCount };
  });


// ─── Brief: assign work to agent (creates pending execution) ────────────────

export const briefAgent = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        agent_id: z.string().uuid(),
        goal: z.string().min(1).max(2000),
        context: z.record(z.string(), z.any()).optional(),
        autonomy_override: z.enum(["suggest", "bounded", "autonomous"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a member" };

    const { data: row, error } = await supabaseAdmin
      .from("agent_executions")
      .insert({
        workspace_id: data.workspace_id,
        agent_id: data.agent_id,
        trigger: "user_request",
        goal: data.goal,
        context: data.context ?? {},
        status: "planning",
        requested_by: userId,
      } as never)
      .select("*")
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };

    // Mark agent as working
    await supabaseAdmin
      .from("ai_agents")
      .update({ status: "working" } as never)
      .eq("id", data.agent_id);

    return { ok: true as const, execution: row };
  });

// ─── Memories ────────────────────────────────────────────────────────────────

export const listAgentMemories = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        agent_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a member" };

    let q = supabaseAdmin
      .from("agent_memories")
      .select("*, agent:ai_agents(id,name,avatar_emoji)")
      .eq("workspace_id", data.workspace_id)
      .order("last_accessed", { ascending: false })
      .limit(data.limit);
    if (data.agent_id) q = q.eq("agent_id", data.agent_id);
    const { data: rows, error } = await q;
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, memories: rows ?? [] };
  });

export const deleteAgentMemory = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    const { error } = await supabaseAdmin.from("agent_memories").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ─── Triggers (schedule + event) ─────────────────────────────────────────────

function computeNextRunAt(config: Record<string, unknown>, from = new Date()): string | null {
  const interval = Number(config.interval_minutes);
  if (!Number.isFinite(interval) || interval <= 0) return null;
  return new Date(from.getTime() + interval * 60_000).toISOString();
}

export const listAgentTriggers = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ workspace_id: z.string().uuid(), agent_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a member" };

    let q = supabaseAdmin
      .from("agent_triggers")
      .select("*, agent:ai_agents(id,name,avatar_emoji,handle)")
      .eq("workspace_id", data.workspace_id)
      .order("created_at", { ascending: false });
    if (data.agent_id) q = q.eq("agent_id", data.agent_id);
    const { data: rows, error } = await q;
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, triggers: rows ?? [] };
  });

export const upsertAgentTrigger = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        workspace_id: z.string().uuid(),
        agent_id: z.string().uuid(),
        name: z.string().min(1).max(120),
        trigger_type: z.enum(["schedule", "event"]),
        config: z.record(z.string(), z.any()).default({}),
        goal_template: z.string().min(1).max(2000),
        is_active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a member" };

    const next =
      data.trigger_type === "schedule" ? computeNextRunAt(data.config) : null;

    const payload = {
      workspace_id: data.workspace_id,
      agent_id: data.agent_id,
      name: data.name,
      trigger_type: data.trigger_type,
      config: data.config,
      goal_template: data.goal_template,
      is_active: data.is_active,
      next_run_at: next,
      created_by: userId,
    } as never;

    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("agent_triggers")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .maybeSingle();
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, trigger: row };
    }
    const { data: row, error } = await supabaseAdmin
      .from("agent_triggers")
      .insert(payload)
      .select("*")
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, trigger: row };
  });

export const deleteAgentTrigger = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    const { error } = await supabaseAdmin.from("agent_triggers").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

async function fireTrigger(trigger: {
  id: string;
  workspace_id: string;
  agent_id: string;
  goal_template: string;
  config: Record<string, unknown>;
  trigger_type: string;
}, actorId: string, eventPayload?: Record<string, unknown>) {
  let goal = trigger.goal_template;
  if (eventPayload) {
    for (const [k, v] of Object.entries(eventPayload)) {
      goal = goal.replaceAll(`{{${k}}}`, String(v));
    }
  }
  const { data: exec } = await supabaseAdmin
    .from("agent_executions")
    .insert({
      workspace_id: trigger.workspace_id,
      agent_id: trigger.agent_id,
      trigger: trigger.trigger_type === "schedule" ? "scheduled" : "event",
      goal,
      context: { trigger_id: trigger.id, ...(eventPayload ?? {}) },
      status: "planning",
      requested_by: actorId,
    } as never)
    .select("id")
    .maybeSingle();
  if (!exec) return { ok: false, error: "Could not create execution" };
  const result = await runPlanLoop({
    executionId: exec.id as string,
    workspaceId: trigger.workspace_id,
    agentId: trigger.agent_id,
    actorId,
  });
  const nextAt = trigger.trigger_type === "schedule" ? computeNextRunAt(trigger.config) : null;
  await supabaseAdmin
    .from("agent_triggers")
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: result.ok ? result.status : "failed",
      next_run_at: nextAt,
    } as never)
    .eq("id", trigger.id);
  return result;
}

export const runTriggerNow = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    const { data: trig } = await supabaseAdmin
      .from("agent_triggers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!trig) return { ok: false as const, error: "Trigger not found" };
    if (!(await ensureMember(trig.workspace_id as string, userId)))
      return { ok: false as const, error: "Not a member" };
    const r = await fireTrigger(trig as never, userId);
    if (!r.ok) return { ok: false as const, error: r.error };
    return { ok: true as const };
  });

/** Called by cron. Processes all schedule triggers whose next_run_at is due. */
async function _processDueScheduledTriggers(limit = 25): Promise<{ ran: number }> {
  const now = new Date().toISOString();
  const { data: due } = await supabaseAdmin
    .from("agent_triggers")
    .select("*")
    .eq("is_active", true)
    .eq("trigger_type", "schedule")
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(limit);
  let ran = 0;
  for (const t of due ?? []) {
    await fireTrigger(t as never, (t as { created_by: string }).created_by);
    ran++;
  }
  return { ran };
}

export const processDueScheduledTriggers = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => _processDueScheduledTriggers(data.limit ?? 25));

/**
 * Admin-side event dispatcher. Called by the public webhook from DB triggers.
 * No user auth — runs each matching trigger as its creator.
 */
async function _processEventDispatch(params: {
  log_id?: string;
  workspace_id: string;
  event_name: string;
  payload: Record<string, unknown>;
}): Promise<{ fired: number }> {
  const { data: triggers } = await supabaseAdmin
    .from("agent_triggers")
    .select("*")
    .eq("workspace_id", params.workspace_id)
    .eq("trigger_type", "event")
    .eq("is_active", true);

  const matches = (triggers ?? []).filter(
    (t) =>
      ((t.config as Record<string, unknown>)?.event_name as string) ===
      params.event_name,
  );

  let fired = 0;
  for (const t of matches) {
    await fireTrigger(
      t as never,
      (t as { created_by: string }).created_by,
      params.payload,
    );
    fired++;
  }

  if (params.log_id) {
    await supabaseAdmin
      .from("agent_event_log")
      .update({
        dispatched_at: new Date().toISOString(),
        triggers_matched: fired,
      } as never)
      .eq("id", params.log_id);
  }

  return { fired };
}

export const processEventDispatch = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        log_id: z.string().uuid().optional(),
        workspace_id: z.string().uuid(),
        event_name: z.string().min(1).max(80),
        payload: z.record(z.string(), z.any()).default({}),
      })
      .parse(d),
  )
  .handler(async ({ data }) => _processEventDispatch(data));

/** Fire event-type triggers matching event_name in a workspace. */
export const dispatchAgentEvent = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        event_name: z.string().min(1).max(80),
        payload: z.record(z.string(), z.any()).default({}),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a member" };

    const { data: triggers } = await supabaseAdmin
      .from("agent_triggers")
      .select("*")
      .eq("workspace_id", data.workspace_id)
      .eq("trigger_type", "event")
      .eq("is_active", true);

    const matches = (triggers ?? []).filter(
      (t) => ((t.config as Record<string, unknown>)?.event_name as string) === data.event_name,
    );
    let fired = 0;
    for (const t of matches) {
      await fireTrigger(t as never, userId, data.payload);
      fired++;
    }
    return { ok: true as const, fired };
  });

// ─── Execution detail (for trace viewer) ─────────────────────────────────────

export const getAgentExecution = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    const { data: row, error } = await supabaseAdmin
      .from("agent_executions")
      .select("*, agent:ai_agents(id,name,avatar_emoji,handle), approvals:agent_action_approvals(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    if (!row) return { ok: false as const, error: "Not found" };
    if (!(await ensureMember(row.workspace_id as string, userId)))
      return { ok: false as const, error: "Not a member" };
    return { ok: true as const, execution: row };
  });

// ─── AI: Draft a trigger from a natural-language prompt ──────────────────────
export const draftTriggerFromPrompt = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        prompt: z.string().min(4).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { ok: false as const, error: "Sign in required" };
    if (!(await ensureMember(data.workspace_id, userId)))
      return { ok: false as const, error: "Not a workspace member" };

    const { data: secret } = await supabaseAdmin
      .from("workspace_ai_secrets")
      .select("openrouter_api_key")
      .eq("workspace_id", data.workspace_id)
      .maybeSingle();
    const apiKey = secret?.openrouter_api_key as string | undefined;
    if (!apiKey)
      return {
        ok: false as const,
        error: "No AI key configured. Add one in Settings → AI agents.",
      };

    const { data: agents } = await supabaseAdmin
      .from("ai_agents")
      .select("id, name, handle, description")
      .eq("workspace_id", data.workspace_id)
      .order("created_at", { ascending: true });
    const agentList = (agents ?? []).map(
      (a) => `- ${a.id}  ${a.name}${a.handle ? ` (@${a.handle})` : ""}${a.description ? ` — ${String(a.description).slice(0, 140)}` : ""}`,
    ).join("\n") || "(no agents yet — leave agent_id empty)";

    const eventNames = [
      "task.created",
      "task.overdue",
      "task.completed",
      "project.status_changed",
      "milestone.due_soon",
      "invoice.sent",
      "client.message_received",
    ];
    const cadences = [15, 60, 240, 720, 1440, 10080];

    const system = `You design agent triggers for a workspace automation tool.
Return ONLY a JSON object matching this TypeScript type:
{
  "name": string,                          // short, human, 2-6 words
  "trigger_type": "schedule" | "event",
  "config": {
    "interval_minutes"?: number,           // when schedule. Must be one of: ${cadences.join(", ")}
    "event_name"?: string                  // when event. Must be one of the allowed events
  },
  "goal_template": string,                 // instruction sent to the agent. Use {{key}} placeholders for event payload fields when relevant
  "agent_id": string | null,               // pick the best matching agent id from the list, or null
  "is_active": true,
  "rationale": string                       // 1 sentence explaining the choice
}
Allowed events: ${eventNames.join(", ")}.
Workspace agents:
${agentList}
Rules:
- Prefer "event" when the user describes "when X happens"; prefer "schedule" for cadences ("every day", "hourly").
- Snap interval_minutes to the closest allowed cadence.
- Goal template must be specific and actionable; reference {{project_name}}, {{task_title}}, etc. for events.
- Do NOT wrap the JSON in markdown.`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/zenifold/aurora-os",
        "X-Title": "Aurora Trigger Draft",
      },
      body: JSON.stringify({
        model: "xiaomi/mimo-v2-flash",
        temperature: 0.3,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.prompt },
        ],
      }),
    });
    if (!res.ok) {
      return {
        ok: false as const,
        error: `AI gateway ${res.status}: ${(await res.text()).slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const txt = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { name?: unknown; trigger_type?: unknown; config?: unknown; goal_template?: unknown; agent_id?: unknown; rationale?: unknown };
    try {
      parsed = JSON.parse(txt);
    } catch {
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) return { ok: false as const, error: "AI did not return JSON" };
      parsed = JSON.parse(m[0]);
    }

    const allowedIds = new Set((agents ?? []).map((a) => a.id as string));
    const draft = {
      name: String(parsed.name ?? "Untitled trigger").slice(0, 80),
      trigger_type: (parsed.trigger_type === "event" ? "event" : "schedule") as "schedule" | "event",
      config: (parsed.config && typeof parsed.config === "object" ? parsed.config : {}) as Record<string, number | string>,
      goal_template: String(parsed.goal_template ?? ""),
      agent_id:
        typeof parsed.agent_id === "string" && allowedIds.has(parsed.agent_id)
          ? (parsed.agent_id as string)
          : null,
      is_active: true,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    };

    if (draft.trigger_type === "schedule") {
      const raw = Number((draft.config as { interval_minutes?: number }).interval_minutes ?? 60);
      const snap = cadences.reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a), cadences[0]);
      draft.config = { interval_minutes: snap };
    } else {
      const ev = String((draft.config as { event_name?: string }).event_name ?? "");
      draft.config = { event_name: eventNames.includes(ev) ? ev : eventNames[0] };
    }

    return { ok: true as const, draft };
  });
