import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertTemplateMember(templateId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("project_templates")
    .select("workspace_id")
    .eq("id", templateId)
    .maybeSingle();
  if (!data) throw new Error("Template not found");
  const { data: m } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", data.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!m) throw new Error("Not a workspace member");
  return data.workspace_id as string;
}

async function assertProjectMember(projectId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("projects")
    .select("workspace_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!data) throw new Error("Project not found");
  const { data: m } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", data.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!m) throw new Error("Not a workspace member");
  return data.workspace_id as string;
}

const PhaseInputSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/, "lowercase letters, numbers, _ or -"),
  name: z.string().min(1).max(120),
  order_index: z.number().int().min(0).optional(),
  color: z.string().max(32).nullable().optional(),
  icon: z.string().max(64).nullable().optional(),
  owner_role: z.string().max(64).nullable().optional(),
  target_days: z.number().int().min(0).max(3650).nullable().optional(),
  is_terminal: z.boolean().optional(),
  entry_criteria: z.array(z.string().max(200)).optional(),
  exit_criteria: z.array(z.string().max(200)).optional(),
});

export const listTemplatePhases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ template_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertTemplateMember(data.template_id, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("template_phases")
      .select("*")
      .eq("template_id", data.template_id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const replaceTemplatePhases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        template_id: z.string().uuid(),
        phases: z.array(PhaseInputSchema).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertTemplateMember(data.template_id, context.userId);
    // enforce unique keys client-side
    const keys = new Set<string>();
    for (const p of data.phases) {
      if (keys.has(p.key)) throw new Error(`Duplicate phase key: ${p.key}`);
      keys.add(p.key);
    }
    await supabaseAdmin.from("template_phases").delete().eq("template_id", data.template_id);
    if (data.phases.length) {
      const rows = data.phases.map((p, idx) => ({
        template_id: data.template_id,
        key: p.key,
        name: p.name,
        order_index: p.order_index ?? idx,
        color: p.color ?? null,
        icon: p.icon ?? null,
        owner_role: p.owner_role ?? null,
        target_days: p.target_days ?? null,
        is_terminal: p.is_terminal ?? false,
        entry_criteria: (p.entry_criteria ?? []) as unknown as never,
        exit_criteria: (p.exit_criteria ?? []) as unknown as never,
      }));
      const { error } = await supabaseAdmin.from("template_phases").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listEngagementPhases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertProjectMember(data.project_id, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("engagement_phases")
      .select("*")
      .eq("project_id", data.project_id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const advanceEngagementPhase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        phase_id: z.string().uuid(),
        action: z.enum(["complete", "skip", "activate"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertProjectMember(data.project_id, context.userId);
    const { data: phases, error } = await supabaseAdmin
      .from("engagement_phases")
      .select("*")
      .eq("project_id", data.project_id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    const list = phases ?? [];
    const idx = list.findIndex((p) => p.id === data.phase_id);
    if (idx === -1) throw new Error("Phase not found on this project");
    const phase = list[idx];

    const now = new Date().toISOString();
    let activatedPhaseId: string | null = null;
    if (data.action === "activate") {
      await supabaseAdmin
        .from("engagement_phases")
        .update({ status: "active", started_at: phase.started_at ?? now })
        .eq("id", phase.id);
      activatedPhaseId = phase.id;
    } else {
      const nextStatus = data.action === "complete" ? "completed" : "skipped";
      await supabaseAdmin
        .from("engagement_phases")
        .update({
          status: nextStatus,
          completed_at: now,
          completed_by: context.userId,
          started_at: phase.started_at ?? now,
        })
        .eq("id", phase.id);
      const next = list[idx + 1];
      if (next && next.status === "planned") {
        await supabaseAdmin
          .from("engagement_phases")
          .update({ status: "active", started_at: now })
          .eq("id", next.id);
        await supabaseAdmin.from("projects").update({ current_phase_id: next.id }).eq("id", data.project_id);
        activatedPhaseId = next.id;
      } else if (!next) {
        await supabaseAdmin.from("projects").update({ current_phase_id: null }).eq("id", data.project_id);
      }
    }
    if (data.action === "activate") {
      await supabaseAdmin.from("projects").update({ current_phase_id: phase.id }).eq("id", data.project_id);
    }
    if (activatedPhaseId) {
      try {
        const { triggerArtifactOnPhaseChange } = await import("./ai-artifacts.functions");
        await triggerArtifactOnPhaseChange({
          data: { projectId: data.project_id, phaseKey: activatedPhaseId },
        });
      } catch (e) {
        console.error("triggerArtifactOnPhaseChange failed", e);
      }
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Phase templates: pick / apply / save-from-project
// ---------------------------------------------------------------------------

export const listPhaseTemplatesForProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const wsId = await assertProjectMember(data.project_id, context.userId);
    const { data: templates, error } = await supabaseAdmin
      .from("project_templates")
      .select("id, name, description, category, default_duration_days, is_active, created_at")
      .eq("workspace_id", wsId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (templates ?? []).map((t) => t.id);
    if (!ids.length) return [];
    const { data: phases } = await supabaseAdmin
      .from("template_phases")
      .select("template_id, id, key, name, color, order_index, owner_role, target_days, is_terminal")
      .in("template_id", ids)
      .order("order_index", { ascending: true });
    const byTemplate = new Map<string, typeof phases>();
    for (const p of phases ?? []) {
      const arr = byTemplate.get(p.template_id) ?? [];
      arr.push(p);
      byTemplate.set(p.template_id, arr);
    }
    return (templates ?? []).map((t) => ({
      ...t,
      phases: byTemplate.get(t.id) ?? [],
    }));
  });

export const applyPhaseTemplateToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        template_id: z.string().uuid(),
        replace: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const wsId = await assertProjectMember(data.project_id, context.userId);
    // Make sure the template belongs to the same workspace.
    const { data: tmpl } = await supabaseAdmin
      .from("project_templates")
      .select("workspace_id")
      .eq("id", data.template_id)
      .maybeSingle();
    if (!tmpl || tmpl.workspace_id !== wsId) {
      throw new Error("Template not found in this workspace");
    }
    const { data: tplPhases, error: tpErr } = await supabaseAdmin
      .from("template_phases")
      .select("*")
      .eq("template_id", data.template_id)
      .order("order_index", { ascending: true });
    if (tpErr) throw new Error(tpErr.message);
    if (!tplPhases?.length) throw new Error("Template has no phases");

    if (data.replace) {
      await supabaseAdmin.from("engagement_phases").delete().eq("project_id", data.project_id);
      await supabaseAdmin
        .from("projects")
        .update({ current_phase_id: null })
        .eq("id", data.project_id);
    }

    // Find existing keys to avoid the (project_id, key) unique conflict.
    const { data: existing } = await supabaseAdmin
      .from("engagement_phases")
      .select("key, order_index")
      .eq("project_id", data.project_id);
    const usedKeys = new Set((existing ?? []).map((p) => p.key));
    const startOrder = (existing ?? []).reduce((m, p) => Math.max(m, p.order_index), -1) + 1;

    const rows = tplPhases
      .filter((p) => !usedKeys.has(p.key))
      .map((p, idx) => ({
        workspace_id: wsId,
        project_id: data.project_id,
        template_phase_id: p.id,
        key: p.key,
        name: p.name,
        order_index: startOrder + idx,
        color: p.color,
        icon: p.icon,
        owner_role: p.owner_role,
        target_days: p.target_days,
        is_terminal: p.is_terminal,
        exit_criteria: p.exit_criteria,
        status: "planned" as const,
      }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from("engagement_phases").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true, applied: rows.length, skipped: tplPhases.length - rows.length };
  });

export const saveProjectPhasesAsTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        name: z.string().min(1).max(120),
        description: z.string().max(2000).nullable().optional(),
        category: z.enum(["web_build", "retainer", "consulting", "implementation", "custom"]).default("custom"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const wsId = await assertProjectMember(data.project_id, context.userId);
    const { data: phases, error: pErr } = await supabaseAdmin
      .from("engagement_phases")
      .select("*")
      .eq("project_id", data.project_id)
      .order("order_index", { ascending: true });
    if (pErr) throw new Error(pErr.message);
    if (!phases?.length) throw new Error("This project has no phases to save");

    const { data: tmpl, error: tErr } = await supabaseAdmin
      .from("project_templates")
      .insert({
        workspace_id: wsId,
        name: data.name,
        description: data.description ?? null,
        category: data.category,
        created_by: context.userId,
        is_active: true,
      })
      .select("id")
      .single();
    if (tErr || !tmpl) throw new Error(tErr?.message ?? "Could not create template");

    const phaseRows = phases.map((p, idx) => ({
      template_id: tmpl.id,
      key: p.key,
      name: p.name,
      order_index: idx,
      color: p.color,
      icon: p.icon,
      owner_role: p.owner_role,
      target_days: p.target_days,
      is_terminal: p.is_terminal,
      entry_criteria: [],
      exit_criteria: p.exit_criteria,
    }));
    const { error: pInsErr } = await supabaseAdmin.from("template_phases").insert(phaseRows);
    if (pInsErr) throw new Error(pInsErr.message);
    return { ok: true, template_id: tmpl.id };
  });

