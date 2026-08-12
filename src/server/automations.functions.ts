import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Condition = {
  field: string;
  op: "eq" | "neq" | "contains" | "in" | "is_empty" | "is_not_empty" | "changed_to";
  value?: unknown;
};

function getField(task: Record<string, unknown>, field: string): unknown {
  if (field === "description") {
    const d = task.description;
    if (!d) return "";
    return typeof d === "string" ? d : JSON.stringify(d);
  }
  return task[field];
}

function evalCondition(
  cond: Condition,
  task: Record<string, unknown>,
  prev: Record<string, unknown> | null,
): boolean {
  const v = getField(task, cond.field);
  switch (cond.op) {
    case "eq":
      return v === cond.value;
    case "neq":
      return v !== cond.value;
    case "contains":
      return typeof v === "string" && typeof cond.value === "string" && v.toLowerCase().includes(cond.value.toLowerCase());
    case "in":
      return Array.isArray(cond.value) && (cond.value as unknown[]).includes(v);
    case "is_empty":
      return v == null || v === "" || (Array.isArray(v) && v.length === 0);
    case "is_not_empty":
      return v != null && v !== "" && !(Array.isArray(v) && v.length === 0);
    case "changed_to":
      if (!prev) return false;
      return getField(prev, cond.field) !== v && v === cond.value;
    default:
      return false;
  }
}

function renderTemplate(tpl: string, task: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => {
    const v = getField(task, key);
    if (v == null) return "";
    return typeof v === "string" ? v : JSON.stringify(v);
  });
}

/**
 * Trigger automations for a task event. Called from the client after task create/update.
 * Server-authoritative: re-loads task, re-checks workspace membership, evaluates rules,
 * runs matching agents, and applies their outputs as comments / description appends.
 */
export const triggerTaskAutomations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        task_id: z.string().uuid(),
        event: z.enum(["task.created", "task.updated", "task.status_changed"]),
        prev: z.record(z.string(), z.unknown()).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context;

      const { data: task, error: tErr } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", data.task_id)
        .single();
      if (tErr || !task) return { ran: 0, skipped: 0, error: null };

      const workspaceId = task.workspace_id as string;

      const { data: rules } = await supabase
        .from("ai_automations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true);

      if (!rules || rules.length === 0) return { ran: 0, skipped: 0, error: null };

      const { data: secret } = await supabaseAdmin
        .from("workspace_ai_secrets")
        .select("openrouter_api_key")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      const apiKey = secret?.openrouter_api_key;

      let ran = 0;
      let skipped = 0;
      const taskRec = task as Record<string, unknown>;
      const prevRec = (data.prev ?? null) as Record<string, unknown> | null;

      for (const rule of rules) {
        const matches = rule.trigger_event === data.event ||
          (data.event === "task.status_changed" && rule.trigger_event === "task.updated");
        if (!matches) {
          skipped++;
          continue;
        }

        const conditions = (rule.conditions as Condition[] | null) ?? [];
        const allPass = conditions.every((c) => evalCondition(c, taskRec, prevRec));
        if (!allPass) {
          skipped++;
          continue;
        }

        const start = Date.now();
        const action = rule.apply_action as string;
        const isAiAction = action === "comment" || action === "description_append" || action === "tag";
        const cfg = (rule.action_config ?? {}) as Record<string, unknown>;

        const recordRun = async (
          status: "success" | "failed",
          output: string | null,
          error_message: string | null,
          tokens: number | null,
        ) => {
          await supabaseAdmin.from("ai_automation_runs").insert({
            workspace_id: workspaceId,
            automation_id: rule.id,
            task_id: task.id,
            status,
            trigger_event: data.event,
            output: output ? output.slice(0, 4000) : null,
            error_message,
            duration_ms: Date.now() - start,
            tokens_used: tokens,
          });
          if (status === "success") {
            await supabaseAdmin
              .from("ai_automations")
              .update({
                run_count: (rule.run_count ?? 0) + 1,
                last_run_at: new Date().toISOString(),
              })
              .eq("id", rule.id);
            ran++;
          }
        };

        // ---- Deterministic actions (no AI required) ----
        if (!isAiAction && action !== "none") {
          try {
            let summary = "";
            if (action === "set_status" && typeof cfg.status === "string") {
              await supabaseAdmin.from("tasks").update({ status: cfg.status }).eq("id", task.id);
              summary = `Set status → ${cfg.status}`;
            } else if (action === "set_priority" && typeof cfg.priority === "string") {
              await supabaseAdmin.from("tasks").update({ priority: cfg.priority as "low" | "medium" | "high" | "urgent" }).eq("id", task.id);
              summary = `Set priority → ${cfg.priority}`;
            } else if (action === "add_tags" && Array.isArray(cfg.tags)) {
              const existing = (task.tags as string[] | null) ?? [];
              const merged = Array.from(new Set([...existing, ...(cfg.tags as string[])]));
              await supabaseAdmin.from("tasks").update({ tags: merged }).eq("id", task.id);
              summary = `Added tags: ${(cfg.tags as string[]).join(", ")}`;
            } else if (action === "remove_tags" && Array.isArray(cfg.tags)) {
              const existing = (task.tags as string[] | null) ?? [];
              const toRemove = new Set((cfg.tags as string[]).map((t) => t.toLowerCase()));
              const filtered = existing.filter((t) => !toRemove.has(t.toLowerCase()));
              await supabaseAdmin.from("tasks").update({ tags: filtered }).eq("id", task.id);
              summary = `Removed tags: ${(cfg.tags as string[]).join(", ")}`;
            } else if (action === "set_due_date") {
              let due: string | null = null;
              if (typeof cfg.due_date_offset_days === "number") {
                const d = new Date();
                d.setDate(d.getDate() + cfg.due_date_offset_days);
                due = d.toISOString().slice(0, 10);
              } else if (typeof cfg.due_date === "string" && cfg.due_date) {
                due = cfg.due_date;
              }
              if (due) {
                await supabaseAdmin.from("tasks").update({ due_date: due }).eq("id", task.id);
                summary = `Set due date → ${due}`;
              } else {
                summary = "Set due date skipped (no value)";
              }
            } else if (action === "add_assignee" && typeof cfg.assignee_id === "string") {
              const existing = (task.assignee_ids as string[] | null) ?? [];
              if (!existing.includes(cfg.assignee_id)) {
                await supabaseAdmin
                  .from("tasks")
                  .update({ assignee_ids: [...existing, cfg.assignee_id] })
                  .eq("id", task.id);
              }
              summary = `Assigned to ${cfg.assignee_id}`;
            } else if (action === "webhook" && typeof cfg.webhook_url === "string") {
              const ctrl = new AbortController();
              const timer = setTimeout(() => ctrl.abort(), 10_000);
              const res = await fetch(cfg.webhook_url, {
                method: (cfg.webhook_method as string) ?? "POST",
                signal: ctrl.signal,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: data.event,
                  automation: { id: rule.id, name: rule.name },
                  task: taskRec,
                }),
              }).finally(() => clearTimeout(timer));
              summary = `Webhook ${res.status} → ${cfg.webhook_url}`;
              if (!res.ok) throw new Error(summary);
            } else if (action === "notify") {
              const message = (cfg.notify_message as string) ?? `Automation "${rule.name}" fired on "${task.title}"`;
              const recipients = (cfg.notify_user_ids as string[] | undefined) ?? [];
              const targets = recipients.length > 0 ? recipients : ((task.assignee_ids as string[] | null) ?? []);
              if (targets.length > 0) {
                await supabaseAdmin.from("notifications").insert(
                  targets.map((uid) => ({
                    workspace_id: workspaceId,
                    recipient_id: uid,
                    actor_id: userId,
                    type: "automation",
                    title: rule.name,
                    body: renderTemplate(message, taskRec),
                    task_id: task.id,
                  })),
                );
              }
              summary = `Notified ${targets.length} user(s)`;
            } else {
              summary = "No-op (action not configured)";
            }
            await recordRun("success", summary, null, null);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await recordRun("failed", null, message, null);
          }
          continue;
        }

        if (action === "none") {
          await recordRun("success", "Logged (no action)", null, null);
          continue;
        }

        // ---- AI-backed actions ----
        if (!apiKey) {
          await recordRun("failed", null, "No OpenRouter API key configured for workspace.", null);
          continue;
        }
        if (!rule.agent_id) {
          await recordRun("failed", null, "AI action requires an agent.", null);
          continue;
        }

        const { data: agent } = await supabaseAdmin
          .from("ai_agents")
          .select("*")
          .eq("id", rule.agent_id)
          .maybeSingle();

        if (!agent) {
          await recordRun("failed", null, "Agent not found", null);
          continue;
        }

        const userPrompt = rule.instructions_template
          ? renderTemplate(rule.instructions_template, taskRec)
          : `Task: ${task.title}\n\nDescription: ${getField(taskRec, "description")}`;

        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 25_000);
          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            signal: ctrl.signal,
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://github.com/zenifold/aurora-os",
              "X-Title": "Aurora Tasks Automation",
            },
            body: JSON.stringify({
              model: agent.model,
              temperature: Number(agent.temperature),
              max_tokens: agent.max_tokens,
              messages: [
                { role: "system", content: agent.system_prompt },
                { role: "user", content: userPrompt },
              ],
            }),
          }).finally(() => clearTimeout(timer));

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 300)}`);
          }

          const json = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
            usage?: { total_tokens?: number };
          };
          const output = (json.choices?.[0]?.message?.content ?? "").trim();
          const tokens = json.usage?.total_tokens ?? null;

          if (output) {
            if (action === "comment") {
              await supabaseAdmin.from("comments").insert({
                workspace_id: workspaceId,
                task_id: task.id,
                author_id: userId,
                content: {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: `🤖 ${agent.name}: ${output}` }],
                    },
                  ],
                },
              });
            } else if (action === "description_append") {
              const current = getField(taskRec, "description") as string;
              const appended = (current ? current + "\n\n" : "") + `🤖 ${agent.name}:\n${output}`;
              await supabaseAdmin
                .from("tasks")
                .update({
                  description: {
                    type: "doc",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: appended }],
                      },
                    ],
                  },
                })
                .eq("id", task.id);
            } else if (action === "tag") {
              const newTags = output
                .split(/[,\n]/)
                .map((s) => s.trim().replace(/^#/, ""))
                .filter((s) => s.length > 0 && s.length < 32)
                .slice(0, 5);
              const existing = (task.tags as string[] | null) ?? [];
              const merged = Array.from(new Set([...existing, ...newTags]));
              await supabaseAdmin.from("tasks").update({ tags: merged }).eq("id", task.id);
            }
          }

          await recordRun("success", output, null, tokens);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await recordRun("failed", null, message, null);
        }
      }

      return { ran, skipped, error: null };
    } catch (err) {
      // NEVER throw to the client — would surface as a runtime error / blank screen
      const message = err instanceof Error ? err.message : String(err);
      console.error("triggerTaskAutomations failed:", message);
      return { ran: 0, skipped: 0, error: message };
    }
  });
