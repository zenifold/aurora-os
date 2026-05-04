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
    const { supabase, userId } = context;

    const { data: task, error: tErr } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", data.task_id)
      .single();
    if (tErr || !task) return { ran: 0, skipped: 0 };

    const workspaceId = task.workspace_id as string;

    const { data: rules } = await supabase
      .from("ai_automations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    if (!rules || rules.length === 0) return { ran: 0, skipped: 0 };

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

      if (!apiKey) {
        await supabaseAdmin.from("ai_automation_runs").insert({
          workspace_id: workspaceId,
          automation_id: rule.id,
          task_id: task.id,
          status: "failed",
          trigger_event: data.event,
          error_message: "No OpenRouter API key configured for workspace.",
          duration_ms: Date.now() - start,
        });
        continue;
      }

      const { data: agent } = await supabaseAdmin
        .from("ai_agents")
        .select("*")
        .eq("id", rule.agent_id)
        .maybeSingle();

      if (!agent) {
        await supabaseAdmin.from("ai_automation_runs").insert({
          workspace_id: workspaceId,
          automation_id: rule.id,
          task_id: task.id,
          status: "failed",
          trigger_event: data.event,
          error_message: "Agent not found",
          duration_ms: Date.now() - start,
        });
        continue;
      }

      const userPrompt = rule.instructions_template
        ? renderTemplate(rule.instructions_template, taskRec)
        : `Task: ${task.title}\n\nDescription: ${getField(taskRec, "description")}`;

      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://lovable.dev",
            "X-Title": "Aura Tasks Automation",
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
        });

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

        // Apply action
        if (output) {
          if (rule.apply_action === "comment") {
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
          } else if (rule.apply_action === "description_append") {
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
          } else if (rule.apply_action === "tag") {
            // Parse comma/newline separated tags from output
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

        await supabaseAdmin.from("ai_automation_runs").insert({
          workspace_id: workspaceId,
          automation_id: rule.id,
          task_id: task.id,
          status: "success",
          trigger_event: data.event,
          output: output.slice(0, 4000),
          duration_ms: Date.now() - start,
          tokens_used: tokens,
        });

        await supabaseAdmin
          .from("ai_automations")
          .update({
            run_count: (rule.run_count ?? 0) + 1,
            last_run_at: new Date().toISOString(),
          })
          .eq("id", rule.id);

        ran++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await supabaseAdmin.from("ai_automation_runs").insert({
          workspace_id: workspaceId,
          automation_id: rule.id,
          task_id: task.id,
          status: "failed",
          trigger_event: data.event,
          error_message: message,
          duration_ms: Date.now() - start,
        });
      }
    }

    return { ran, skipped };
  });
