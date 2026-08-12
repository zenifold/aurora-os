import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function authedUser() {
  const authHeader = getRequest()?.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) throw new Error("Not authenticated");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Session expired");
  return data.user.id;
}

async function assertMember(userId: string, workspaceId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Not a workspace member");
}

async function getApiKey(workspaceId: string) {
  const { data } = await supabaseAdmin
    .from("workspace_ai_secrets")
    .select("openrouter_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data?.openrouter_api_key)
    throw new Error("No OpenRouter API key configured. Add one in Settings → AI agents.");
  return data.openrouter_api_key as string;
}

async function callOpenRouter(
  apiKey: string,
  body: Record<string, unknown>,
  title: string,
) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/zenifold/aurora-os",
      "X-Title": title,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 300)}`);
  }
  return (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
}

/**
 * Suggest the best project for a captured snippet, plus a clean task title.
 */
export const suggestProjectForCapture = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        title: z.string().max(500),
        url: z.string().max(2000).optional().default(""),
        text: z.string().max(8000).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const userId = await authedUser();
    await assertMember(userId, data.workspace_id);

    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id, name, description")
      .eq("workspace_id", data.workspace_id)
      .order("name");

    const list = (projects ?? []).slice(0, 60);
    if (list.length === 0) return { project_id: null, title: data.title, reason: "No projects" };

    const apiKey = await getApiKey(data.workspace_id);

    const projectLines = list
      .map((p, i) => `${i + 1}. [${p.id}] ${p.name}${p.description ? ` — ${String(p.description).slice(0, 120)}` : ""}`)
      .join("\n");

    const json = await callOpenRouter(
      apiKey,
      {
        model: "xiaomi/mimo-v2-flash",
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You route captured web content to the best matching project. Respond with JSON only: {\"project_id\": \"<uuid or null>\", \"title\": \"<crisp action-oriented task title, max 100 chars>\", \"reason\": \"<short>\"}.",
          },
          {
            role: "user",
            content: `Projects:\n${projectLines}\n\nCapture:\nTitle: ${data.title}\nURL: ${data.url}\nSelected text: ${data.text.slice(0, 2000)}\n\nPick the single best project_id from the list, or null if none fits well.`,
          },
        ],
      },
      "Aurora Capture Routing",
    );

    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { project_id?: string | null; title?: string; reason?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          /* ignore */
        }
      }
    }
    const validId =
      parsed.project_id && list.find((p) => p.id === parsed.project_id) ? parsed.project_id : null;
    return {
      project_id: validId,
      title: (parsed.title ?? data.title).slice(0, 200),
      reason: parsed.reason ?? "",
    };
  });

/**
 * Run an AI agent over arbitrary captured text and return its response.
 * Used by "Send to Agent" right-click flow.
 */
export const runAgentOnText = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        agent_id: z.string().uuid(),
        text: z.string().min(1).max(20000),
        instructions: z.string().max(1000).optional().default(""),
        url: z.string().max(2000).optional().default(""),
        page_title: z.string().max(500).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const userId = await authedUser();
    await assertMember(userId, data.workspace_id);

    const { data: agent } = await supabaseAdmin
      .from("ai_agents")
      .select("model, temperature, max_tokens, system_prompt, name")
      .eq("id", data.agent_id)
      .eq("workspace_id", data.workspace_id)
      .maybeSingle();
    if (!agent) throw new Error("Agent not found");

    const apiKey = await getApiKey(data.workspace_id);

    const userMessage = [
      data.instructions ? `Instructions: ${data.instructions}` : "",
      data.page_title ? `Page: ${data.page_title}` : "",
      data.url ? `URL: ${data.url}` : "",
      "",
      "Content:",
      data.text,
    ]
      .filter(Boolean)
      .join("\n");

    const json = await callOpenRouter(
      apiKey,
      {
        model: agent.model,
        temperature: Number(agent.temperature),
        max_tokens: agent.max_tokens,
        messages: [
          { role: "system", content: agent.system_prompt },
          { role: "user", content: userMessage },
        ],
      },
      "Aurora Send To Agent",
    );

    return {
      output: json.choices?.[0]?.message?.content ?? "",
      tokens_used: json.usage?.total_tokens ?? null,
      model_used: agent.model,
      agent_name: agent.name,
    };
  });
