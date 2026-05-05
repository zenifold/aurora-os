import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Analyze a meeting transcript using the workspace's OpenRouter key.
 * Extracts summary, key points, decisions, risks, action items, topics.
 * Stores results on the meetings row and inserts meeting_action_items rows.
 */
export const analyzeMeetingTranscript = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        meeting_id: z.string().uuid(),
        model: z.string().min(1).max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const authHeader = getRequest()?.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return { ok: false, error: "Please sign in again." };

    const { data: authData } = await supabaseAdmin.auth.getUser(token);
    const userId = authData.user?.id;
    if (!userId) return { ok: false, error: "Session expired." };

    const { data: meeting, error: mErr } = await supabaseAdmin
      .from("meetings")
      .select("id, workspace_id, transcript_raw_text, title")
      .eq("id", data.meeting_id)
      .maybeSingle();
    if (mErr || !meeting) return { ok: false, error: "Meeting not found." };

    const { data: membership } = await supabaseAdmin
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", meeting.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return { ok: false, error: "Not a workspace member." };

    if (!meeting.transcript_raw_text || meeting.transcript_raw_text.trim().length < 20) {
      return { ok: false, error: "Transcript is empty or too short." };
    }

    const { data: secret } = await supabaseAdmin
      .from("workspace_ai_secrets")
      .select("openrouter_api_key")
      .eq("workspace_id", meeting.workspace_id)
      .maybeSingle();
    const apiKey = secret?.openrouter_api_key;
    if (!apiKey) {
      return { ok: false, error: "No OpenRouter API key configured. Add one in Settings → AI." };
    }

    await supabaseAdmin
      .from("meetings")
      .update({ ai_status: "processing", ai_error: null } as never)
      .eq("id", meeting.id);

    const model = data.model ?? "openai/gpt-4o-mini";
    const transcript = meeting.transcript_raw_text.slice(0, 60000);

    const systemPrompt = `You are a senior executive assistant analyzing a meeting transcript. Always respond with strict JSON only.`;
    const userMessage = `Analyze this meeting transcript titled "${meeting.title}" and respond with ONLY a JSON object matching this schema:

{
  "summary": {
    "overview": "2-3 sentence overview",
    "key_points": ["..."],
    "decisions": ["..."],
    "risks": ["..."],
    "questions_unanswered": ["..."],
    "sentiment": "positive|neutral|concerned|tense"
  },
  "action_items": [
    {
      "text": "cleaned action item",
      "assignee": "person name or null",
      "due": "YYYY-MM-DD or null",
      "priority": "low|medium|high|urgent",
      "context_quote": "exact supporting quote from transcript"
    }
  ],
  "topics": [
    { "name": "topic name", "sentiment": "positive|neutral|concerned" }
  ]
}

Transcript:
${transcript}`;

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://lovable.dev",
          "X-Title": "Aura Meetings",
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: 3000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
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
      };
      const raw = json.choices?.[0]?.message?.content ?? "";

      let parsed: {
        summary?: unknown;
        action_items?: unknown[];
        topics?: unknown[];
      } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error("AI returned invalid JSON.");
      }

      const summarySchema = z
        .object({
          overview: z.string().optional(),
          key_points: z.array(z.string()).optional(),
          decisions: z.array(z.string()).optional(),
          risks: z.array(z.string()).optional(),
          questions_unanswered: z.array(z.string()).optional(),
          sentiment: z.string().optional(),
        })
        .passthrough();

      const aiSchema = z.object({
        text: z.string().min(1).max(500),
        assignee: z.string().nullable().optional(),
        due: z.string().nullable().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        context_quote: z.string().nullable().optional(),
      });

      const topicSchema = z.object({
        name: z.string().min(1).max(120),
        sentiment: z.string().optional(),
      });

      const summary = summarySchema.safeParse(parsed.summary ?? {}).data ?? {};
      const actionItems = z.array(aiSchema).max(40).safeParse(parsed.action_items ?? []).data ?? [];
      const topics = z.array(topicSchema).max(20).safeParse(parsed.topics ?? []).data ?? [];

      // Save back to meeting
      await supabaseAdmin
        .from("meetings")
        .update({
          summary: summary as never,
          action_items: actionItems as never,
          topics: topics as never,
          ai_status: "completed",
          ai_model: model,
          ai_error: null,
        } as never)
        .eq("id", meeting.id);

      // Replace existing extracted action items
      await supabaseAdmin.from("meeting_action_items").delete().eq("meeting_id", meeting.id);

      if (actionItems.length > 0) {
        const rows = actionItems.map((a, i) => {
          const dueValid = a.due && /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : null;
          return {
            workspace_id: meeting.workspace_id,
            meeting_id: meeting.id,
            original_text: a.text,
            summary: a.text,
            context_quote: a.context_quote ?? null,
            assignee_guess_name: a.assignee ?? null,
            due_guess: dueValid,
            priority_guess: a.priority ?? "medium",
            position: i,
          };
        });
        await supabaseAdmin.from("meeting_action_items").insert(rows as never);
      }

      return { ok: true, action_items_count: actionItems.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      await supabaseAdmin
        .from("meetings")
        .update({ ai_status: "failed", ai_error: msg } as never)
        .eq("id", meeting.id);
      return { ok: false, error: msg };
    }
  });
