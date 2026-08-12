/**
 * Magic Plan — AI project generator.
 * Takes a free-text description + optional seed playbook, returns structured
 * milestones + tasks for client-side preview. No DB writes happen here.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  OPENROUTER_KEY_MISSING_ERROR,
  resolveOpenRouterKey,
} from "@/server/openrouter-key.server";

async function authedUserId(): Promise<string | null> {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

const MilestoneSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  milestone_type: z.enum(["delivery", "payment", "gate", "review"]).default("delivery"),
  day_offset: z.number().int().min(0).max(720),
  requires_signoff: z.boolean().default(false),
});

const TaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  day_offset_start: z.number().int().min(0).max(720).nullable().optional(),
  day_offset_due: z.number().int().min(0).max(720).nullable().optional(),
  is_customer_task: z.boolean().default(false),
  assignee_role_hint: z.string().max(80).nullable().optional(),
  milestone_index: z.number().int().min(0).nullable().optional(),
});

export type MagicPlanMilestone = z.infer<typeof MilestoneSchema>;
export type MagicPlanTask = z.infer<typeof TaskSchema>;

export const generateProjectPlan = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        prompt: z.string().min(10).max(2000),
        duration_days: z.number().int().min(7).max(365).default(30),
        playbook_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const userId = await authedUserId();
      if (!userId) return { ok: false as const, error: "Please sign in again." };

      const { data: membership } = await supabaseAdmin
        .from("user_roles")
        .select("workspace_id")
        .eq("workspace_id", data.workspace_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership) return { ok: false as const, error: "Not a workspace member." };

      // Optional seed from a playbook
      let seedHint = "";
      if (data.playbook_id) {
        const [{ data: pb }, { data: ms }, { data: ts }] = await Promise.all([
          supabaseAdmin
            .from("project_playbooks" as never)
            .select("name, description, kind")
            .eq("id", data.playbook_id)
            .maybeSingle(),
          supabaseAdmin
            .from("playbook_milestones" as never)
            .select("name, milestone_type, day_offset, requires_signoff")
            .eq("playbook_id", data.playbook_id)
            .order("order_index"),
          supabaseAdmin
            .from("playbook_tasks" as never)
            .select("title, priority, day_offset_due, is_customer_task")
            .eq("playbook_id", data.playbook_id)
            .order("order_index")
            .limit(40),
        ]);
        if (pb) {
          seedHint = `\n\nUse this playbook as a STRUCTURAL SEED — adapt freely to the user's prompt, don't copy verbatim:\n${JSON.stringify(
            { playbook: pb, milestones: ms ?? [], tasks: ts ?? [] },
            null,
            2,
          )}`;
        }
      }

      const apiKey = await resolveOpenRouterKey(data.workspace_id);
      if (!apiKey) return { ok: false as const, error: OPENROUTER_KEY_MISSING_ERROR };

      const system = `You are a senior delivery lead designing client-services project plans.
Generate a realistic plan from the user's brief. Be SPECIFIC to the brief — use industry-appropriate phase names, deliverables, and tasks. Avoid generic placeholders.

Return STRICT JSON only (no prose, no code fences) matching this schema:

{
  "summary": "1-sentence elevator pitch of the plan (max 200 chars)",
  "milestones": [
    {
      "name": "string (concise phase or deliverable name)",
      "description": "string (1 sentence, optional)",
      "milestone_type": "delivery" | "payment" | "gate" | "review",
      "day_offset": integer (days from project start, 0..duration),
      "requires_signoff": boolean (true for client-facing approval gates)
    }
  ],
  "tasks": [
    {
      "title": "string (action-oriented, max 100 chars)",
      "description": "string (optional, 1 sentence)",
      "priority": "low" | "medium" | "high" | "urgent",
      "day_offset_start": integer or null,
      "day_offset_due": integer or null,
      "is_customer_task": boolean (true if the CLIENT does this, not us),
      "assignee_role_hint": "string or null (e.g. 'Lead consultant', 'Client PM')",
      "milestone_index": integer or null (0-based index into the milestones array this task belongs to)
    }
  ]
}

Constraints:
- 3–7 milestones, ordered chronologically (day_offset increasing).
- 8–20 tasks total, each linked to a milestone via milestone_index when possible.
- All day offsets must be between 0 and ${data.duration_days}.
- Mark 1–3 milestones as requires_signoff if there are clear client approval points.
- Mark 1–4 tasks as is_customer_task for things the client owns (e.g., providing assets, approving designs).
- Use "payment" milestone_type for billing milestones, "gate" for approval gates, "review" for retros/reviews, "delivery" for shipped work.`;

      const user = `Project brief: ${data.prompt}
Target duration: ${data.duration_days} days.${seedHint}`;

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.5,
          response_format: { type: "json_object" },
        }),
      });

      if (res.status === 429) {
        return { ok: false as const, error: "AI rate limit hit — try again in a moment." };
      }
      if (res.status === 402) {
        return { ok: false as const, error: "AI credits exhausted. Add credits in Settings → Usage." };
      }
      if (!res.ok) {
        const t = await res.text();
        return { ok: false as const, error: `AI gateway ${res.status}: ${t.slice(0, 200)}` };
      }

      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "{}";

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) return { ok: false as const, error: "AI returned invalid JSON." };
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          return { ok: false as const, error: "AI returned invalid JSON." };
        }
      }

      const planSchema = z.object({
        summary: z.string().max(300).optional().default(""),
        milestones: z.array(MilestoneSchema).min(1).max(12),
        tasks: z.array(TaskSchema).min(1).max(40),
      });
      const result = planSchema.safeParse(parsed);
      if (!result.success) {
        return { ok: false as const, error: "AI response didn't match expected shape." };
      }

      return { ok: true as const, plan: result.data };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });
