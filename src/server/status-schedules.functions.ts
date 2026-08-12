/**
 * Status report schedule management (CRUD).
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    .select("id, workspace_id")
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

async function safeRun<T extends object>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    return { error: (e as Error).message };
  }
}

const scheduleSchema = z.object({
  project_id: z.string().uuid(),
  cadence: z.enum(["weekly", "biweekly", "monthly"]).default("weekly"),
  day_of_week: z.number().int().min(0).max(6).default(5),
  hour_utc: z.number().int().min(0).max(23).default(14),
  visibility: z.enum(["internal", "client", "both"]).default("internal"),
  auto_publish: z.boolean().default(false),
  active: z.boolean().default(true),
});
export type StatusScheduleInput = z.infer<typeof scheduleSchema>;

// GET schedule for a project
export const getStatusSchedule = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(({ data }) =>
    safeRun(async () => {
      await requireProjectMember(data.project_id);
      const { data: row } = await supabaseAdmin
        .from("status_report_schedules")
        .select("*")
        .eq("project_id", data.project_id)
        .maybeSingle();
      return { schedule: row };
    }),
  );

// UPSERT schedule
export const upsertStatusSchedule = createServerFn({ method: "POST" })
  .inputValidator((d) => scheduleSchema.parse(d))
  .handler(({ data }) =>
    safeRun(async () => {
      const { userId, project } = await requireProjectMember(data.project_id);

      // compute next_run_at using db helper for consistency
      const { data: nextRow } = await supabaseAdmin.rpc("compute_next_status_run", {
        _from: new Date().toISOString(),
        _cadence: data.cadence,
        _day_of_week: data.day_of_week,
        _hour_utc: data.hour_utc,
      });
      const next_run_at = (nextRow as unknown as string) ?? null;

      const payload = {
        workspace_id: project.workspace_id,
        project_id: project.id,
        cadence: data.cadence,
        day_of_week: data.day_of_week,
        hour_utc: data.hour_utc,
        visibility: data.visibility,
        auto_publish: data.auto_publish,
        active: data.active,
        next_run_at,
        created_by: userId,
      };
      const { data: row, error } = await supabaseAdmin
        .from("status_report_schedules")
        .upsert(payload, { onConflict: "project_id" })
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { schedule: row };
    }),
  );

// DELETE schedule
export const deleteStatusSchedule = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(({ data }) =>
    safeRun(async () => {
      await requireProjectMember(data.project_id);
      const { error } = await supabaseAdmin
        .from("status_report_schedules")
        .delete()
        .eq("project_id", data.project_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );
