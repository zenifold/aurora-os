/**
 * Project Status Updates + CSAT — server functions (Phase 2 foundation).
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

class AuthError extends Error {}

async function requireProjectMember(projectId: string) {
  const userId = await authedUserId();
  if (!userId) throw new AuthError("Please sign in again.");
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id, workspace_id, name, start_date, target_end_date, client_name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new AuthError("Project not found.");
  const { data: membership } = await supabaseAdmin
    .from("user_roles")
    .select("workspace_id")
    .eq("workspace_id", project.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) throw new AuthError("Not a workspace member.");
  return { userId, project };
}

async function safeRun<T extends object>(
  fn: () => Promise<T>,
): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    return { error: (e as Error).message };
  }
}

// ---------- LIST ----------
export const listStatusUpdates = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(({ data }) =>
    safeRun(async () => {
      await requireProjectMember(data.project_id);
      const { data: rows } = await supabaseAdmin
        .from("project_status_updates")
        .select(
          "id, period_start, period_end, health, headline, summary, status, visibility, ai_generated, published_at, created_at, updated_at, created_by",
        )
        .eq("project_id", data.project_id)
        .order("created_at", { ascending: false })
        .limit(40);
      return { ok: true as const, updates: rows ?? [] };
    }),
  );

// ---------- GET one ----------
export const getStatusUpdate = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), project_id: z.string().uuid() }).parse(d),
  )
  .handler(({ data }) =>
    safeRun(async () => {
      await requireProjectMember(data.project_id);
      const { data: row } = await supabaseAdmin
        .from("project_status_updates")
        .select("*")
        .eq("id", data.id)
        .eq("project_id", data.project_id)
        .maybeSingle();
      if (!row) throw new AuthError("Not found");
      return { ok: true as const, update: row };
    }),
  );

const UpsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid(),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  health: z.enum(["on_track", "at_risk", "off_track", "complete"]).default("on_track"),
  headline: z.string().max(280).nullable().optional(),
  summary: z.string().max(8000).nullable().optional(),
  accomplishments: z.string().max(8000).nullable().optional(),
  next_period: z.string().max(8000).nullable().optional(),
  risks: z.string().max(8000).nullable().optional(),
  asks: z.string().max(8000).nullable().optional(),
  visibility: z.enum(["internal", "client", "both"]).default("internal"),
  ai_generated: z.boolean().optional(),
});
export type StatusUpdateInput = z.infer<typeof UpsertSchema>;

// ---------- SAVE ----------
export const saveStatusUpdate = createServerFn({ method: "POST" })
  .inputValidator((d) => UpsertSchema.parse(d))
  .handler(({ data }) =>
    safeRun(async () => {
      const { userId, project } = await requireProjectMember(data.project_id);
      const payload = {
        workspace_id: project.workspace_id,
        project_id: project.id,
        period_start: data.period_start ?? null,
        period_end: data.period_end ?? null,
        health: data.health,
        headline: data.headline ?? null,
        summary: data.summary ?? null,
        accomplishments: data.accomplishments ?? null,
        next_period: data.next_period ?? null,
        risks: data.risks ?? null,
        asks: data.asks ?? null,
        visibility: data.visibility,
        ai_generated: data.ai_generated ?? false,
        created_by: userId,
        status: "draft" as const,
      };
      if (data.id) {
        const { data: row, error } = await supabaseAdmin
          .from("project_status_updates")
          .update(payload)
          .eq("id", data.id)
          .select("id")
          .maybeSingle();
        if (error) throw new AuthError(error.message);
        return { ok: true as const, id: row?.id ?? data.id };
      }
      const { data: row, error } = await supabaseAdmin
        .from("project_status_updates")
        .insert(payload)
        .select("id")
        .maybeSingle();
      if (error) throw new AuthError(error.message);
      return { ok: true as const, id: row?.id ?? null };
    }),
  );

// ---------- PUBLISH ----------
export const publishStatusUpdate = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), project_id: z.string().uuid() }).parse(d),
  )
  .handler(({ data }) =>
    safeRun(async () => {
      const { userId } = await requireProjectMember(data.project_id);
      const { error } = await supabaseAdmin
        .from("project_status_updates")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          published_by: userId,
        })
        .eq("id", data.id)
        .eq("project_id", data.project_id);
      if (error) throw new AuthError(error.message);
      return { ok: true as const };
    }),
  );

// ---------- DELETE ----------
export const deleteStatusUpdate = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), project_id: z.string().uuid() }).parse(d),
  )
  .handler(({ data }) =>
    safeRun(async () => {
      await requireProjectMember(data.project_id);
      const { error } = await supabaseAdmin
        .from("project_status_updates")
        .delete()
        .eq("id", data.id)
        .eq("project_id", data.project_id);
      if (error) throw new AuthError(error.message);
      return { ok: true as const };
    }),
  );

// ---------- AI DRAFT ----------
export const aiDraftStatusUpdate = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        period_start: z.string().nullable().optional(),
        period_end: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(({ data }) =>
    safeRun(async () => {
      const { project } = await requireProjectMember(data.project_id);

      const end = data.period_end ? new Date(data.period_end) : new Date();
      const start = data.period_start
        ? new Date(data.period_start)
        : new Date(end.getTime() - 7 * 86_400_000);
      const startIso = start.toISOString();
      const endIso = end.toISOString();

      const [tasksDone, tasksOpen, milestones, escalations, meetings] = await Promise.all([
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
        supabaseAdmin
          .from("meetings")
          .select("title, scheduled_at, summary")
          .eq("project_id", project.id)
          .gte("scheduled_at", startIso)
          .lte("scheduled_at", endIso)
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
        meetings: meetings.data ?? [],
      };

      const apiKey = await resolveOpenRouterKey(project.workspace_id);
      if (!apiKey) throw new AuthError(OPENROUTER_KEY_MISSING_ERROR);

      const system = `You are a senior delivery lead writing a concise weekly status update for a client project.
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

      const user = `Project context:\n${JSON.stringify(context, null, 2)}`;

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.4,
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new AuthError(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      let parsed: Record<string, string>;
      try {
        parsed = JSON.parse(content) as Record<string, string>;
      } catch {
        throw new AuthError("AI returned invalid JSON");
      }

      return {
        ok: true as const,
        draft: {
          health: ((parsed.health as string) ?? "on_track") as
            | "on_track"
            | "at_risk"
            | "off_track"
            | "complete",
          headline: parsed.headline ?? "",
          summary: parsed.summary ?? "",
          accomplishments: parsed.accomplishments ?? "",
          next_period: parsed.next_period ?? "",
          risks: parsed.risks ?? "",
          asks: parsed.asks ?? "",
          period_start: start.toISOString().slice(0, 10),
          period_end: end.toISOString().slice(0, 10),
          model: "google/gemini-2.5-flash",
        },
      };
    }),
  );

// ---------- CSAT — list responses for project ----------
export const listProjectCsat = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(d),
  )
  .handler(({ data }) =>
    safeRun(async () => {
      await requireProjectMember(data.project_id);
      const { data: rows } = await supabaseAdmin
        .from("csat_responses")
        .select(
          "id, score, comment, source, respondent_name, respondent_email, milestone_id, status_update_id, created_at",
        )
        .eq("project_id", data.project_id)
        .order("created_at", { ascending: false })
        .limit(data.limit);
      const list = (rows ?? []) as Array<{ score: number }>;
      const avg = list.length > 0 ? list.reduce((s, r) => s + r.score, 0) / list.length : null;
      return { ok: true as const, responses: rows ?? [], avg, count: list.length };
    }),
  );
