import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Generate a structured task list from a natural-language goal using OpenRouter.
 * Returns parsed JSON only — actual task insertion happens client-side after preview.
 */
export const generateTasksFromPrompt = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        prompt: z.string().min(3).max(2000),
        max_tasks: z.number().int().min(1).max(20).default(8),
        agent_id: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const authHeader = getRequest()?.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return { tasks: [], tokens_used: null, model_used: null, error: "Please sign in again before using Magic Add." };
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const userId = authData.user?.id;
    if (authError || !userId) {
      return { tasks: [], tokens_used: null, model_used: null, error: "Your session expired. Please sign in again." };
    }

    // Verify caller is a workspace member
    const { data: membership } = await supabaseAdmin
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) throw new Error("Not a workspace member");

    const { data: secret } = await supabaseAdmin
      .from("workspace_ai_secrets")
      .select("openrouter_api_key")
      .eq("workspace_id", data.workspace_id)
      .maybeSingle();
    const apiKey = secret?.openrouter_api_key;
    if (!apiKey) throw new Error("No OpenRouter API key configured. Add one in Settings → AI agents.");

    // Use specified agent OR fall back to defaults
    let model = "xiaomi/mimo-v2-flash";
    let temperature = 0.5;
    let max_tokens = 2000;
    let systemPrompt =
      "You are an expert project manager. Break down user goals into 3-10 concrete, actionable tasks.";

    if (data.agent_id) {
      const { data: agent } = await supabaseAdmin
        .from("ai_agents")
        .select("model, temperature, max_tokens, system_prompt")
        .eq("id", data.agent_id)
        .maybeSingle();
      if (agent) {
        model = agent.model;
        temperature = Number(agent.temperature);
        max_tokens = agent.max_tokens;
        systemPrompt = agent.system_prompt;
      }
    }

    const userMessage = `Generate up to ${data.max_tasks} tasks for this goal. Respond with ONLY a JSON object matching this schema:

{
  "tasks": [
    {
      "title": "string (max 100 chars, action-oriented)",
      "description": "string (1-2 sentence summary, optional)",
      "priority": "low" | "medium" | "high" | "urgent",
      "tags": ["string"]
    }
  ]
}

Goal: ${data.prompt}`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/zenifold/aurora-os",
        "X-Title": "Aurora Magic Add",
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt + " Always respond with valid JSON only." },
          { role: "user", content: userMessage },
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
    const raw = json.choices?.[0]?.message?.content ?? "";

    // Try to parse JSON, with fallback to extracting JSON block
    let parsed: { tasks?: unknown[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          throw new Error("AI returned invalid JSON. Try again or rephrase your prompt.");
        }
      } else {
        throw new Error("AI didn't return JSON. Try a different model.");
      }
    }

    const taskSchema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional().nullable(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
      tags: z.array(z.string().max(30)).max(8).optional().default([]),
    });

    const tasksParsed = z.array(taskSchema).max(20).safeParse(parsed.tasks ?? []);
    if (!tasksParsed.success || tasksParsed.data.length === 0) {
      throw new Error("AI response had no usable tasks.");
    }

    return {
      tasks: tasksParsed.data,
      tokens_used: json.usage?.total_tokens ?? null,
      model_used: model,
    };
  });
