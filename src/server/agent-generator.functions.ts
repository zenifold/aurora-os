import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Use OpenRouter to draft a complete AI agent spec from a single natural-language prompt.
 * Returns name, emoji, description, system prompt, and a recommended model id.
 */
export const generateAgentSpec = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        prompt: z.string().min(3).max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Verify caller is workspace member
    const { data: membership } = await supabase
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", data.workspace_id)
      .maybeSingle();
    if (!membership) throw new Error("Not a workspace member");

    const { data: secret } = await supabaseAdmin
      .from("workspace_ai_secrets")
      .select("openrouter_api_key")
      .eq("workspace_id", data.workspace_id)
      .maybeSingle();
    const apiKey = secret?.openrouter_api_key;
    if (!apiKey)
      throw new Error("No OpenRouter API key configured. Add one above first.");

    const systemPrompt = `You design AI agent personas for a project management app. Given a short user description, output a complete agent spec as JSON only.

Recommend a model id from this short list (pick the cheapest one that fits the job):
- "openai/gpt-4o-mini" — fast, cheap, general purpose (default)
- "openai/gpt-4o" — strong reasoning, more expensive
- "anthropic/claude-3.5-sonnet" — best for writing, analysis
- "anthropic/claude-3.5-haiku" — fast, cheap, good writing
- "google/gemini-2.0-flash-exp:free" — free tier, general

Respond with ONLY valid JSON, no markdown, matching:
{
  "name": "string (max 40 chars, role-based, e.g. 'Content Writer')",
  "avatar_emoji": "single emoji that fits the role",
  "description": "string (max 120 chars, one sentence)",
  "system_prompt": "string (detailed instructions for the AI, 2-5 sentences, written in second person)",
  "model": "one of the model ids above",
  "temperature": number (0-1, lower for analytical, higher for creative),
  "max_tokens": number (500-4000)
}`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lovable.dev",
        "X-Title": "Aura Agent Builder",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: data.prompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI didn't return JSON. Try rephrasing.");
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        throw new Error("AI returned invalid JSON. Try again.");
      }
    }

    const schema = z.object({
      name: z.string().min(1).max(80),
      avatar_emoji: z.string().min(1).max(8).default("🤖"),
      description: z.string().max(300).default(""),
      system_prompt: z.string().min(10).max(4000),
      model: z.string().min(3).default("openai/gpt-4o-mini"),
      temperature: z.number().min(0).max(2).default(0.7),
      max_tokens: z.number().int().min(100).max(8000).default(2000),
    });

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new Error("AI response was missing required fields. Try again.");
    }
    return result.data;
  });
