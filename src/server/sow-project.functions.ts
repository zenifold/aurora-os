import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * SOW → Project agent.
 *
 * Two phases:
 *  1. `draftProjectFromBrief` — call AI to draft a project plan (JSON only, no writes).
 *     The user reviews/edits in the UI.
 *  2. `createProjectFromPlan` — atomically materialize: project + milestones (phases)
 *     + tasks per phase + a kickoff page summarizing the SOW.
 */

const phaseSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(800).optional().default(""),
  target_date: z.string().nullable().optional(),
  payment_amount: z.number().nullable().optional(),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(800).optional().default(""),
        priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
        estimate_hours: z.number().nullable().optional(),
      }),
    )
    .max(20)
    .default([]),
});

const planSchema = z.object({
  project_name: z.string().min(1).max(200),
  client_name: z.string().max(200).nullable().optional(),
  description: z.string().max(1500).optional().default(""),
  start_date: z.string().nullable().optional(),
  target_end_date: z.string().nullable().optional(),
  currency: z.string().max(5).optional().default("USD"),
  contract_value: z.number().nullable().optional(),
  billing_model: z
    .enum(["time_and_materials", "fixed_fee", "milestone", "retainer", "non_billable"])
    .optional()
    .default("fixed_fee"),
  kickoff_summary: z.string().max(8000).optional().default(""),
  phases: z.array(phaseSchema).min(1).max(12),
});

export type GeneratedPlan = z.infer<typeof planSchema>;

async function getApiKey(workspaceId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("workspace_ai_secrets")
    .select("openrouter_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return (data as unknown as { openrouter_api_key: string | null } | null)
    ?.openrouter_api_key ?? null;
}

const SYSTEM_PROMPT = `You are a senior delivery lead at a professional services firm. Given a statement of work, brief, or project description, draft a complete project plan as JSON only — no commentary, no markdown, no code fences.

Rules:
- Break the engagement into 3–7 PHASES (discovery → design → build → launch style, adapted to the work).
- Each phase becomes a payment milestone with a realistic target_date (YYYY-MM-DD) and payment_amount in the project currency.
- Under each phase, list 3–8 concrete TASKS the team will execute.
- If the brief gives a contract value, distribute it across phases so amounts sum to the total.
- If dates aren't given, start ~1 week from today and pace phases 2–4 weeks apart.
- Pick currency from text (USD, EUR, GBP); default USD.
- billing_model: "fixed_fee" if a total price is stated, "time_and_materials" if hourly/rates are mentioned, otherwise "fixed_fee".
- kickoff_summary: a concise 4–8 bullet markdown summary covering scope, deliverables, out-of-scope, assumptions, and key dates. Use "- " bullets and "## " headings only.

Respond with ONLY valid JSON matching this shape:
{
  "project_name": "string",
  "client_name": "string|null",
  "description": "string",
  "start_date": "YYYY-MM-DD|null",
  "target_end_date": "YYYY-MM-DD|null",
  "currency": "USD|EUR|GBP|...",
  "contract_value": number|null,
  "billing_model": "fixed_fee|time_and_materials|milestone|retainer|non_billable",
  "kickoff_summary": "markdown string",
  "phases": [{
    "name": "string",
    "description": "string",
    "target_date": "YYYY-MM-DD|null",
    "payment_amount": number|null,
    "tasks": [{ "title": "string", "description": "string", "priority": "low|medium|high", "estimate_hours": number|null }]
  }]
}`;

export const draftProjectFromBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        brief: z.string().min(20).max(40000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: membership } = await supabase
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", data.workspace_id)
      .maybeSingle();
    if (!membership) throw new Error("Not a workspace member");

    const apiKey = await getApiKey(data.workspace_id);
    if (!apiKey)
      throw new Error("No OpenRouter API key configured. Add one in Settings → AI first.");

    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/zenifold/aurora-os",
        "X-Title": "Aurora SOW → Project",
      },
      body: JSON.stringify({
        model: "xiaomi/mimo-v2-flash",
        temperature: 0.4,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Today is ${today}.\n\nBRIEF / SOW:\n\n${data.brief}` },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI ${res.status}: ${t.slice(0, 300)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI did not return JSON. Try again.");
      parsed = JSON.parse(m[0]);
    }
    const result = planSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("AI plan was incomplete: " + result.error.issues[0]?.message);
    }
    return result.data;
  });

function markdownToTipTap(md: string) {
  const lines = md.split(/\r?\n/);
  const nodes: unknown[] = [];
  let bullets: string[] | null = null;
  const flush = () => {
    if (bullets?.length) {
      nodes.push({
        type: "bulletList",
        content: bullets.map((b) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: b }] }],
        })),
      });
    }
    bullets = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      nodes.push({
        type: "heading",
        attrs: { level: h[1].length },
        content: [{ type: "text", text: h[2] }],
      });
      continue;
    }
    const b = /^[-*]\s+(.*)$/.exec(line);
    if (b) {
      bullets = bullets ?? [];
      bullets.push(b[1]);
      continue;
    }
    flush();
    nodes.push({ type: "paragraph", content: [{ type: "text", text: line }] });
  }
  flush();
  if (nodes.length === 0) nodes.push({ type: "paragraph" });
  return { type: "doc", content: nodes };
}

export const createProjectFromPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        plan: planSchema,
        division_id: z.string().uuid().nullable().optional(),
        folder_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const userId = context.userId;
    const { data: membership } = await supabase
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", data.workspace_id)
      .maybeSingle();
    if (!membership) throw new Error("Not a workspace member");

    const plan = data.plan;

    // Divisions removed — division_id no longer used.
    const divisionId: string | null = null;

    // 1. Project
    const { data: proj, error: pErr } = await supabaseAdmin
      .from("projects")
      .insert({
        workspace_id: data.workspace_id,
        name: plan.project_name,
        description: plan.description || null,
        color: "#8b5cf6",
        icon: "sparkles",
        created_by: userId,
        division_id: divisionId,
        client_name: plan.client_name ?? null,
        is_client_project: !!plan.client_name,
        start_date: plan.start_date ?? null,
        target_end_date: plan.target_end_date ?? null,
      } as never)
      .select("id")
      .single();
    if (pErr) throw pErr;
    const projectId = (proj as { id: string }).id;

    // 1b. Default table view
    await supabaseAdmin.from("views").insert({
      workspace_id: data.workspace_id,
      project_id: projectId,
      name: "All tasks",
      view_type: "table",
      is_default: true,
      created_by: userId,
    } as never);

    // 1c. Financials baseline
    if (plan.contract_value || plan.billing_model) {
      await supabaseAdmin.from("project_financials").upsert({
        workspace_id: data.workspace_id,
        project_id: projectId,
        currency: plan.currency || "USD",
        contract_value: plan.contract_value ?? null,
        billing_model: plan.billing_model || "fixed_fee",
      } as never);
    }

    // 2. Milestones (one per phase, type=payment if has amount, else delivery)
    const phaseIds: string[] = [];
    for (let i = 0; i < plan.phases.length; i++) {
      const ph = plan.phases[i];
      const { data: ms, error: mErr } = await supabaseAdmin
        .from("milestones")
        .insert({
          workspace_id: data.workspace_id,
          project_id: projectId,
          name: ph.name,
          description: ph.description || null,
          milestone_type: ph.payment_amount ? "payment" : "delivery",
          status: "upcoming",
          target_date:
            ph.target_date ??
            new Date(Date.now() + (i + 1) * 14 * 86400000).toISOString().slice(0, 10),
          payment_amount: ph.payment_amount ?? null,
          payment_currency: ph.payment_amount ? plan.currency || "USD" : null,
          order_index: i,
          created_by: userId,
        } as never)
        .select("id")
        .single();
      if (mErr) throw mErr;
      phaseIds.push((ms as { id: string }).id);
    }

    // 3. Tasks — bucket by phase via labels/section header (simple: just create them all)
    let totalTasks = 0;
    for (let i = 0; i < plan.phases.length; i++) {
      const ph = plan.phases[i];
      for (let t = 0; t < ph.tasks.length; t++) {
        const task = ph.tasks[t];
        const desc = task.description
          ? {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: task.description }],
                },
              ],
            }
          : null;
        const { error: tErr } = await supabaseAdmin.from("tasks").insert({
          workspace_id: data.workspace_id,
          project_id: projectId,
          title: `[${ph.name}] ${task.title}`,
          status: "todo",
          priority: task.priority || "medium",
          task_type: "task",
          description: desc,
          estimate_hours: task.estimate_hours ?? null,
          created_by: userId,
        } as never);
        if (tErr) throw tErr;
        totalTasks++;
      }
    }

    // 4. Kickoff page
    const kickoffMd =
      plan.kickoff_summary ||
      `## ${plan.project_name}\n\n${plan.description}\n\n## Phases\n${plan.phases
        .map(
          (p) =>
            `- **${p.name}** — ${p.target_date ?? "TBD"}${
              p.payment_amount ? ` · ${plan.currency} ${p.payment_amount}` : ""
            }`,
        )
        .join("\n")}`;
    const kickoffContent = markdownToTipTap(kickoffMd);
    const { data: page } = await supabaseAdmin
      .from("pages")
      .insert({
        workspace_id: data.workspace_id,
        scope: "project",
        scope_id: projectId,
        page_type: "doc",
        title: `Kickoff — ${plan.project_name}`,
        icon: "🚀",
        content: kickoffContent as never,
        content_text: kickoffMd.slice(0, 50000),
        created_by: userId,
        updated_by: userId,
        is_pinned: true,
      } as never)
      .select("id")
      .single();

    return {
      project_id: projectId,
      milestone_count: phaseIds.length,
      task_count: totalTasks,
      kickoff_page_id: (page as { id: string } | null)?.id ?? null,
    };
  });
