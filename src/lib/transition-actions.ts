import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/lib/types";
import type {
  WorkflowAction,
  WorkflowStatus,
  WorkflowTransition,
} from "@/lib/workflow-types";

/**
 * Supported action shapes (config schema):
 *  - notify       { user_ids?: string[]; assignees?: boolean; title?: string; body?: string }
 *  - set_field    { field: "priority" | "assignee_ids" | "due_date" | "tags";
 *                   value?: unknown; mode?: "set" | "append" | "clear";
 *                   relative_days?: number }
 *  - post_comment { body: string }
 *  - create_subtask { title: string; assignee_ids?: string[] }
 *  - webhook      { url: string; secret?: string }   // best-effort, fire-and-forget
 */

export interface ActionContext {
  task: Task;
  fromStatus?: WorkflowStatus;
  toStatus: WorkflowStatus;
  transition?: WorkflowTransition;
  actorId: string | null;
}

const tpl = (str: string, ctx: ActionContext) =>
  str
    .replace(/\{task\.title\}/g, ctx.task.title)
    .replace(/\{from\}/g, ctx.fromStatus?.name ?? "—")
    .replace(/\{to\}/g, ctx.toStatus.name);

async function runNotify(action: WorkflowAction, ctx: ActionContext) {
  const cfg = action.config as {
    user_ids?: string[];
    assignees?: boolean;
    title?: string;
    body?: string;
  };
  const recipients = new Set<string>(cfg.user_ids ?? []);
  if (cfg.assignees) ctx.task.assignee_ids?.forEach((id) => recipients.add(id));
  if (recipients.size === 0) return;

  const rows = Array.from(recipients).map((uid) => ({
    workspace_id: ctx.task.workspace_id,
    recipient_id: uid,
    actor_id: ctx.actorId,
    type: "workflow_action",
    title: tpl(cfg.title ?? "Status changed: {task.title}", ctx),
    body: tpl(cfg.body ?? "Moved {from} → {to}", ctx),
    task_id: ctx.task.id,
    project_id: ctx.task.project_id,
    link: `/app/p/${ctx.task.project_id}?task=${ctx.task.id}`,
  }));
  await supabase.from("notifications").insert(rows);
}

async function runSetField(action: WorkflowAction, ctx: ActionContext) {
  const cfg = action.config as {
    field: string;
    value?: unknown;
    mode?: "set" | "append" | "clear";
    relative_days?: number;
  };
  const patch: Record<string, unknown> = {};
  const mode = cfg.mode ?? "set";

  switch (cfg.field) {
    case "priority":
      patch.priority = cfg.value;
      break;
    case "due_date":
      if (mode === "clear") patch.due_date = null;
      else if (typeof cfg.relative_days === "number") {
        const d = new Date();
        d.setDate(d.getDate() + cfg.relative_days);
        patch.due_date = d.toISOString().slice(0, 10);
      } else patch.due_date = cfg.value;
      break;
    case "assignee_ids": {
      const next = Array.isArray(cfg.value) ? (cfg.value as string[]) : [];
      if (mode === "clear") patch.assignee_ids = [];
      else if (mode === "append")
        patch.assignee_ids = Array.from(new Set([...(ctx.task.assignee_ids ?? []), ...next]));
      else patch.assignee_ids = next;
      break;
    }
    case "tags": {
      const next = Array.isArray(cfg.value) ? (cfg.value as string[]) : [];
      if (mode === "clear") patch.tags = [];
      else if (mode === "append")
        patch.tags = Array.from(new Set([...(ctx.task.tags ?? []), ...next]));
      else patch.tags = next;
      break;
    }
    default:
      return;
  }
  if (Object.keys(patch).length === 0) return;
  await supabase.from("tasks").update(patch).eq("id", ctx.task.id);
}

async function runPostComment(action: WorkflowAction, ctx: ActionContext) {
  const cfg = action.config as { body: string };
  if (!cfg.body || !ctx.actorId) return;
  const body = tpl(cfg.body, ctx);
  await supabase.from("comments").insert({
    workspace_id: ctx.task.workspace_id,
    task_id: ctx.task.id,
    author_id: ctx.actorId,
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: body }] }],
    },
  });
}

async function runCreateSubtask(action: WorkflowAction, ctx: ActionContext) {
  const cfg = action.config as { title: string; assignee_ids?: string[] };
  if (!cfg.title) return;
  await supabase.from("tasks").insert({
    workspace_id: ctx.task.workspace_id,
    project_id: ctx.task.project_id,
    parent_task_id: ctx.task.id,
    title: tpl(cfg.title, ctx),
    assignee_ids: cfg.assignee_ids ?? [],
    created_by: ctx.actorId,
  });
}

async function runWebhook(action: WorkflowAction, ctx: ActionContext) {
  const cfg = action.config as { url: string };
  if (!cfg.url) return;
  try {
    await fetch(cfg.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "transition",
        task_id: ctx.task.id,
        from: ctx.fromStatus?.name,
        to: ctx.toStatus.name,
      }),
      mode: "no-cors",
    });
  } catch {
    /* best-effort */
  }
}

export async function runTransitionActions(
  actions: WorkflowAction[] | undefined,
  ctx: ActionContext,
) {
  if (!actions || actions.length === 0) return;
  for (const a of actions) {
    try {
      switch (a.type) {
        case "notify":
          await runNotify(a, ctx);
          break;
        case "set_field":
          await runSetField(a, ctx);
          break;
        case "create_subtask":
          await runCreateSubtask(a, ctx);
          break;
        case "webhook":
          await runWebhook(a, ctx);
          break;
        // Extended types not in DB enum but supported via config
        case "run_workflow":
          // reserved for future
          break;
        default:
          // Treat unknown type "post_comment" stored as ActionType extension
          if ((a.type as string) === "post_comment") {
            await runPostComment(a, ctx);
          }
      }
    } catch (err) {
      console.error("[transition-action] failed", a.type, err);
    }
  }
}
