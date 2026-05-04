import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Run an AI agent on a task assignment.
 * - Verifies caller is a workspace member
 * - Loads agent config + workspace OpenRouter key (admin client, server-only)
 * - Calls OpenRouter chat completions
 * - Updates the assignment row with output / error
 */
export const runAiAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ assignment_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load assignment + agent + task (RLS-scoped to caller, ensures access)
    const { data: assignment, error: aErr } = await supabase
      .from("ai_task_assignments")
      .select("*")
      .eq("id", data.assignment_id)
      .single();
    if (aErr || !assignment) throw new Error("Assignment not found");

    const { data: agent, error: agErr } = await supabase
      .from("ai_agents")
      .select("*")
      .eq("id", assignment.agent_id)
      .single();
    if (agErr || !agent) throw new Error("Agent not found");

    const { data: task, error: tErr } = await supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, tags")
      .eq("id", assignment.task_id)
      .single();
    if (tErr || !task) throw new Error("Task not found");

    // Workspace API key — read with admin (only owners can set, but anyone with task access can use)
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
          error_message:
            "No OpenRouter API key configured. Add one in Settings → AI.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", assignment.id);
      throw new Error("No OpenRouter API key configured for this workspace.");
    }

    // Mark running
    await supabaseAdmin
      .from("ai_task_assignments")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", assignment.id);

    // Build prompt
    const descText = task.description
      ? typeof task.description === "string"
        ? task.description
        : JSON.stringify(task.description)
      : "(no description)";

    const userPrompt = [
      `Task: ${task.title}`,
      `Status: ${task.status}`,
      `Priority: ${task.priority}`,
      task.due_date ? `Due: ${task.due_date}` : null,
      task.tags?.length ? `Tags: ${task.tags.join(", ")}` : null,
      ``,
      `Description:`,
      descText,
      ``,
      assignment.instructions
        ? `Specific instructions:\n${assignment.instructions}`
        : `Please help complete or analyze this task.`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://lovable.dev",
            "X-Title": "Aura Tasks",
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
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 500)}`);
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { total_tokens?: number };
        model?: string;
      };
      const output = json.choices?.[0]?.message?.content ?? "";
      const tokens = json.usage?.total_tokens ?? null;

      await supabaseAdmin
        .from("ai_task_assignments")
        .update({
          status: "review_needed",
          output,
          tokens_used: tokens,
          model_used: json.model ?? agent.model,
          iterations: (assignment.iterations ?? 0) + 1,
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", assignment.id);

      return { ok: true, output };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabaseAdmin
        .from("ai_task_assignments")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", assignment.id);
      throw new Error(message);
    } finally {
      void userId;
    }
  });
