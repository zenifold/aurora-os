/**
 * Project baselines — capture a snapshot of plan (dates, milestones, tasks,
 * budget) and compute variance against the current project state.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

class AuthError extends Error {}

async function authedUserId(): Promise<string | null> {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

async function requireProjectMember(projectId: string) {
  const userId = await authedUserId();
  if (!userId) throw new AuthError("Please sign in again.");
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id, workspace_id, name, start_date, target_end_date")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new AuthError("Project not found.");
  const { data: m } = await supabaseAdmin
    .from("user_roles")
    .select("workspace_id")
    .eq("workspace_id", project.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!m) throw new AuthError("Not a workspace member.");
  return { userId, project };
}

async function safeRun<T extends object>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try { return await fn(); }
  catch (e) { return { error: e instanceof Error ? e.message : "Unknown error" }; }
}

interface MilestoneSnap { id: string; name: string; target_date: string | null; status: string | null }
interface TaskSnap { id: string; title: string; due_date: string | null; status: string | null }

// ---------- LIST ----------
export const listBaselines = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(({ data }) => safeRun(async () => {
    await requireProjectMember(data.project_id);
    const { data: rows } = await supabaseAdmin
      .from("project_baselines")
      .select("id, name, is_active, start_date, target_end_date, total_budget_hours, total_budget_amount, notes, created_at, created_by")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false });
    return { ok: true as const, baselines: rows ?? [] };
  }));

// ---------- CAPTURE ----------
export const captureBaseline = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    project_id: z.string().uuid(),
    name: z.string().min(1).max(120).default("Baseline"),
    notes: z.string().max(2000).optional().nullable(),
    set_active: z.boolean().default(true),
  }).parse(d))
  .handler(({ data }) => safeRun(async () => {
    const { userId, project } = await requireProjectMember(data.project_id);

    const [{ data: milestones }, { data: tasks }, { data: fin }] = await Promise.all([
      supabaseAdmin.from("milestones")
        .select("id, name, target_date, status").eq("project_id", data.project_id).order("target_date"),
      supabaseAdmin.from("tasks")
        .select("id, title, due_date, status").eq("project_id", data.project_id).limit(2000),
      supabaseAdmin.from("project_financials")
        .select("contract_value").eq("project_id", data.project_id).maybeSingle(),
    ]);

    if (data.set_active) {
      await supabaseAdmin.from("project_baselines")
        .update({ is_active: false })
        .eq("project_id", data.project_id).eq("is_active", true);
    }

    const { data: inserted, error } = await supabaseAdmin.from("project_baselines").insert({
      workspace_id: project.workspace_id,
      project_id: data.project_id,
      name: data.name,
      is_active: data.set_active,
      start_date: project.start_date,
      target_end_date: project.target_end_date,
      total_budget_amount: fin?.contract_value ?? null,
      milestones_snapshot: (milestones ?? []) as unknown as never,
      tasks_snapshot: (tasks ?? []) as unknown as never,
      notes: data.notes ?? null,
      created_by: userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: inserted!.id };
  }));

// ---------- SET ACTIVE / DELETE ----------
export const setActiveBaseline = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ project_id: z.string().uuid(), id: z.string().uuid() }).parse(d))
  .handler(({ data }) => safeRun(async () => {
    await requireProjectMember(data.project_id);
    await supabaseAdmin.from("project_baselines").update({ is_active: false })
      .eq("project_id", data.project_id);
    await supabaseAdmin.from("project_baselines").update({ is_active: true })
      .eq("id", data.id).eq("project_id", data.project_id);
    return { ok: true as const };
  }));

export const deleteBaseline = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ project_id: z.string().uuid(), id: z.string().uuid() }).parse(d))
  .handler(({ data }) => safeRun(async () => {
    await requireProjectMember(data.project_id);
    await supabaseAdmin.from("project_baselines").delete()
      .eq("id", data.id).eq("project_id", data.project_id);
    return { ok: true as const };
  }));

// ---------- VARIANCE ----------
export const getBaselineVariance = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ project_id: z.string().uuid(), baseline_id: z.string().uuid().optional() }).parse(d))
  .handler(({ data }) => safeRun(async () => {
    const { project } = await requireProjectMember(data.project_id);

    let baselineQ = supabaseAdmin.from("project_baselines")
      .select("id, name, start_date, target_end_date, total_budget_amount, milestones_snapshot, tasks_snapshot, created_at")
      .eq("project_id", data.project_id);
    baselineQ = data.baseline_id ? baselineQ.eq("id", data.baseline_id) : baselineQ.eq("is_active", true);
    const { data: baseline } = await baselineQ.maybeSingle();
    if (!baseline) return { ok: true as const, baseline: null };

    const [{ data: milestones }, { data: tasks }, { data: fin }] = await Promise.all([
      supabaseAdmin.from("milestones").select("id, name, target_date, status").eq("project_id", data.project_id),
      supabaseAdmin.from("tasks").select("id, status").eq("project_id", data.project_id).limit(2000),
      supabaseAdmin.from("project_financials").select("contract_value").eq("project_id", data.project_id).maybeSingle(),
    ]);

    const dayDiff = (a: string | null, b: string | null) => {
      if (!a || !b) return null;
      return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
    };

    const baseMs = (baseline.milestones_snapshot as unknown as MilestoneSnap[]) ?? [];
    const currMsMap = new Map((milestones ?? []).map((m) => [m.id, m]));
    const milestoneDiffs = baseMs.map((b) => {
      const c = currMsMap.get(b.id);
      return {
        id: b.id,
        name: b.name,
        baseline_due: b.target_date,
        current_due: c?.target_date ?? null,
        slip_days: dayDiff(c?.target_date ?? null, b.target_date),
        status: c?.status ?? "removed",
      };
    });
    const slipped = milestoneDiffs.filter((m) => (m.slip_days ?? 0) > 0).length;
    const onTime = milestoneDiffs.filter((m) => (m.slip_days ?? 0) <= 0).length;

    const baseTasks = (baseline.tasks_snapshot as unknown as TaskSnap[]) ?? [];
    const currTaskIds = new Set((tasks ?? []).map((t) => t.id));
    const scopeAdded = (tasks ?? []).length - baseTasks.filter((t) => currTaskIds.has(t.id)).length;
    const scopeRemoved = baseTasks.filter((t) => !currTaskIds.has(t.id)).length;

    return {
      ok: true as const,
      baseline: {
        id: baseline.id,
        name: baseline.name,
        captured_at: baseline.created_at,
        start_date_baseline: baseline.start_date,
        start_date_current: project.start_date,
        start_slip_days: dayDiff(project.start_date, baseline.start_date),
        end_date_baseline: baseline.target_end_date,
        end_date_current: project.target_end_date,
        end_slip_days: dayDiff(project.target_end_date, baseline.target_end_date),
        budget_baseline: baseline.total_budget_amount,
        budget_current: fin?.contract_value ?? null,
        budget_delta: (fin?.contract_value != null && baseline.total_budget_amount != null)
          ? Number(fin.contract_value) - Number(baseline.total_budget_amount) : null,
        milestones_total: baseMs.length,
        milestones_slipped: slipped,
        milestones_on_time: onTime,
        milestone_diffs: milestoneDiffs,
        scope_added_tasks: Math.max(0, scopeAdded),
        scope_removed_tasks: scopeRemoved,
      },
    };
  }));
