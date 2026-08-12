/**
 * Status report scheduler — runner endpoint.
 * Called hourly by pg_cron. Finds active schedules whose next_run_at is in the
 * past, drafts a status update via the AI gateway using the same context shape
 * as the manual aiDraftStatusUpdate, inserts it (as draft or published), and
 * advances next_run_at.
 *
 * Auth: this endpoint is under /api/public/ and relies on the cron job to
 * supply a valid Supabase apikey header. We additionally require that header
 * to match the publishable key — external callers cannot trigger drafting.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  OPENROUTER_KEY_MISSING_ERROR,
  resolveOpenRouterKey,
} from "@/server/openrouter-key.server";

interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  client_name: string | null;
  start_date: string | null;
  target_end_date: string | null;
}

interface ScheduleRow {
  id: string;
  workspace_id: string;
  project_id: string;
  cadence: "weekly" | "biweekly" | "monthly";
  day_of_week: number;
  hour_utc: number;
  visibility: "internal" | "client" | "both";
  auto_publish: boolean;
  next_run_at: string | null;
}

async function generateForSchedule(s: ScheduleRow): Promise<void> {
  const end = new Date();
  const days = s.cadence === "weekly" ? 7 : s.cadence === "biweekly" ? 14 : 28;
  const start = new Date(end.getTime() - days * 86_400_000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id, workspace_id, name, client_name, start_date, target_end_date")
    .eq("id", s.project_id)
    .maybeSingle<ProjectRow>();
  if (!project) throw new Error("Project missing");

  const [tasksDone, tasksOpen, milestones, escalations] = await Promise.all([
    supabaseAdmin
      .from("tasks")
      .select("title, status, updated_at, priority")
      .eq("project_id", project.id)
      .eq("status", "done")
      .gte("updated_at", startIso)
      .lte("updated_at", endIso)
      .limit(40),
    supabaseAdmin
      .from("tasks")
      .select("title, status, due_date, priority")
      .eq("project_id", project.id)
      .in("status", ["in_progress", "todo"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
    supabaseAdmin
      .from("milestones")
      .select("name, status, target_date, actual_date")
      .eq("project_id", project.id)
      .order("target_date", { ascending: true })
      .limit(15),
    supabaseAdmin
      .from("escalations")
      .select("title, severity, status, created_at")
      .eq("project_id", project.id)
      .gte("created_at", startIso)
      .limit(10),
  ]);

  const context = {
    project: {
      name: project.name,
      client: project.client_name,
      start_date: project.start_date,
      end_date: project.target_end_date,
    },
    period: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
    completed_tasks: tasksDone.data ?? [],
    open_tasks: tasksOpen.data ?? [],
    milestones: milestones.data ?? [],
    escalations: escalations.data ?? [],
  };

  const apiKey = await resolveOpenRouterKey(project.workspace_id);
  if (!apiKey) throw new Error(OPENROUTER_KEY_MISSING_ERROR);

  const system = `You are a senior delivery lead writing a concise scheduled status update for a client project.
Tone: factual, calm, executive-appropriate, no fluff. Use crisp bullet points.
Health: choose one of on_track | at_risk | off_track | complete based on the data.
Return STRICT JSON with fields:
{
  "health": "on_track" | "at_risk" | "off_track" | "complete",
  "headline": "one short sentence summary (max 120 chars)",
  "summary": "2-4 sentence paragraph in plain English",
  "accomplishments": "markdown bullets of what shipped this period",
  "next_period": "markdown bullets of what's planned next period",
  "risks": "markdown bullets of risks/blockers, or 'None' if none",
  "asks": "markdown bullets of what we need from the client, or 'None' if none"
}
No prose outside the JSON. No code fences.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Project context:\n${JSON.stringify(context, null, 2)}` },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as Record<string, string>;

  const now = new Date().toISOString();
  const insertRow = {
    workspace_id: project.workspace_id,
    project_id: project.id,
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
    health: (parsed.health ?? "on_track") as "on_track" | "at_risk" | "off_track" | "complete",
    headline: parsed.headline ?? null,
    summary: parsed.summary ?? null,
    accomplishments: parsed.accomplishments ?? null,
    next_period: parsed.next_period ?? null,
    risks: parsed.risks ?? null,
    asks: parsed.asks ?? null,
    visibility: s.visibility,
    ai_generated: true,
    status: s.auto_publish ? "published" : "draft",
    published_at: s.auto_publish ? now : null,
  };
  const { data: update, error: insErr } = await supabaseAdmin
    .from("project_status_updates")
    .insert(insertRow)
    .select("id")
    .maybeSingle();
  if (insErr) throw new Error(insErr.message);

  // Advance next_run_at
  const { data: nextRow } = await supabaseAdmin.rpc("compute_next_status_run", {
    _from: new Date().toISOString(),
    _cadence: s.cadence,
    _day_of_week: s.day_of_week,
    _hour_utc: s.hour_utc,
  });
  await supabaseAdmin
    .from("status_report_schedules")
    .update({
      last_run_at: now,
      last_status_update_id: update?.id ?? null,
      last_error: null,
      next_run_at: (nextRow as unknown as string) ?? null,
    })
    .eq("id", s.id);
}

export const Route = createFileRoute("/api/public/status-reports/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Lightweight gate: require the Supabase apikey header used by the cron job
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!apikey || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const nowIso = new Date().toISOString();
        const { data: due } = await supabaseAdmin
          .from("status_report_schedules")
          .select("id, workspace_id, project_id, cadence, day_of_week, hour_utc, visibility, auto_publish, next_run_at")
          .eq("active", true)
          .lte("next_run_at", nowIso)
          .limit(20);

        const results: { project_id: string; ok: boolean; error?: string }[] = [];
        for (const s of (due ?? []) as unknown as ScheduleRow[]) {
          try {
            await generateForSchedule(s);
            results.push({ project_id: s.project_id, ok: true });
          } catch (e) {
            const msg = (e as Error).message;
            await supabaseAdmin
              .from("status_report_schedules")
              .update({ last_error: msg, last_run_at: nowIso })
              .eq("id", s.id);
            results.push({ project_id: s.project_id, ok: false, error: msg });
          }
        }

        return Response.json({ processed: results.length, results });
      },
    },
  },
});
