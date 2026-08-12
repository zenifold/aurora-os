import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertMember(workspaceId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Not a workspace member");
}

const DEFAULT_STEPS: Array<{ key: string; title: string; stage: string; blocking: boolean }> = [
  { key: "account_setup", title: "Create / link client account", stage: "kickoff_pending", blocking: true },
  { key: "kickoff_call", title: "Schedule kickoff call", stage: "kickoff_pending", blocking: true },
  { key: "intake_form", title: "Send intake form to client", stage: "intake", blocking: true },
  { key: "intake_review", title: "Review intake responses with team", stage: "intake", blocking: false },
  { key: "project_provision", title: "Provision project from template", stage: "setup", blocking: true },
  { key: "team_allocate", title: "Allocate team members", stage: "setup", blocking: true },
  { key: "tools_access", title: "Grant tool access (docs, channels)", stage: "setup", blocking: false },
  { key: "sales_handover", title: "Sales → Delivery handover signed", stage: "handover", blocking: true },
  { key: "kickoff_executed", title: "Kickoff meeting executed", stage: "handover", blocking: true },
];

// ============ ONBOARDING CRUD ============
export const listOnboardings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("onboardings")
      .select(
        "*, client_account:client_accounts(id, name), project:projects!onboardings_project_id_fkey(id, name), template:project_templates(id, name)"
      )
      .eq("workspace_id", data.workspace_id)
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: onb, error } = await supabaseAdmin
      .from("onboardings")
      .select(
        "*, client_account:client_accounts(id, name, status, tier), project:projects!onboardings_project_id_fkey(id, name, phase), template:project_templates(id, name, category)"
      )
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    await assertMember(onb.workspace_id, context.userId);

    const [{ data: steps }, { data: packets }] = await Promise.all([
      supabaseAdmin
        .from("onboarding_steps")
        .select("*")
        .eq("onboarding_id", data.id)
        .order("order_index", { ascending: true }),
      supabaseAdmin
        .from("handover_packets")
        .select("*, items:handover_checklist_items(*)")
        .eq("onboarding_id", data.id)
        .order("created_at", { ascending: false }),
    ]);

    return { onboarding: onb, steps: steps ?? [], packets: packets ?? [] };
  });

export const startOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        client_account_id: z.string().uuid(),
        name: z.string().min(1).max(200),
        template_id: z.string().uuid().optional().nullable(),
        target_go_live: z.string().optional().nullable(),
        deal_id: z.string().uuid().optional().nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    const { data: onb, error } = await supabaseAdmin
      .from("onboardings")
      .insert({
        workspace_id: data.workspace_id,
        client_account_id: data.client_account_id,
        name: data.name,
        template_id: data.template_id ?? null,
        target_go_live: data.target_go_live ?? null,
        deal_id: data.deal_id ?? null,
        owner_id: context.userId,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("onboarding_steps").insert(
      DEFAULT_STEPS.map((s, idx) => ({
        onboarding_id: onb.id,
        step_key: s.key,
        title: s.title,
        is_blocking: s.blocking,
        order_index: idx,
      }))
    );
    return onb;
  });

export const completeOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "in_progress", "complete", "skipped", "blocked"]),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: step } = await supabaseAdmin
      .from("onboarding_steps")
      .select("id, onboarding_id, onboardings!inner(workspace_id)")
      .eq("id", data.id)
      .single();
    if (!step) throw new Error("Not found");
    const ws = (step as unknown as { onboardings: { workspace_id: string } }).onboardings
      .workspace_id;
    await assertMember(ws, context.userId);

    const updates: Record<string, unknown> = { status: data.status };
    if (data.status === "complete") {
      updates.completed_by = context.userId;
      updates.completed_at = new Date().toISOString();
    }
    const { error } = await supabaseAdmin.from("onboarding_steps").update(updates as never).eq("id", data.id);
    if (error) throw new Error(error.message);

    // refresh progress
    const { data: allSteps } = await supabaseAdmin
      .from("onboarding_steps")
      .select("status")
      .eq("onboarding_id", step.onboarding_id);
    if (allSteps && allSteps.length) {
      const done = allSteps.filter((s) => s.status === "complete" || s.status === "skipped").length;
      const progress = Math.round((done / allSteps.length) * 100);
      await supabaseAdmin
        .from("onboardings")
        .update({ progress })
        .eq("id", step.onboarding_id);
    }
    return { ok: true };
  });

export const advanceOnboardingStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        stage: z.enum(["kickoff_pending", "intake", "setup", "handover", "active", "cancelled"]),
        force: z.boolean().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: onb } = await supabaseAdmin
      .from("onboardings")
      .select("workspace_id, stage")
      .eq("id", data.id)
      .single();
    if (!onb) throw new Error("Not found");
    await assertMember(onb.workspace_id, context.userId);

    if (!data.force && data.stage === "active") {
      const { data: packets } = await supabaseAdmin
        .from("handover_packets")
        .select("status")
        .eq("onboarding_id", data.id);
      const accepted = (packets ?? []).some((p) => p.status === "accepted");
      if (!accepted) {
        throw new Error("Cannot move to Active: no accepted handover packet. Use force to override.");
      }
    }

    const updates: Record<string, unknown> = { stage: data.stage };
    if (data.stage === "active") updates.completed_at = new Date().toISOString();
    const { error } = await supabaseAdmin.from("onboardings").update(updates as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ APPLY TEMPLATE — provisions project artifacts ============
export const applyTemplateToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        template_id: z.string().uuid(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, workspace_id, name, start_date")
      .eq("id", data.project_id)
      .single();
    if (!project) throw new Error("Project not found");
    await assertMember(project.workspace_id, context.userId);

    const { data: tpl } = await supabaseAdmin
      .from("project_templates")
      .select("id, items:project_template_items(*)")
      .eq("id", data.template_id)
      .single();
    if (!tpl) throw new Error("Template not found");

    const { data: tplPhases } = await supabaseAdmin
      .from("template_phases")
      .select("*")
      .eq("template_id", data.template_id)
      .order("order_index", { ascending: true });

    const items = (tpl.items ?? []) as Array<{
      kind: string;
      title: string;
      payload: Record<string, unknown>;
      order_index: number;
    }>;

    const start = project.start_date ? new Date(project.start_date) : new Date();
    const created = { milestones: 0, tasks: 0, raid: 0, phases: 0 };

    // Instantiate phases first so we can set current_phase_id.
    let firstPhaseId: string | null = null;
    if (tplPhases && tplPhases.length) {
      const phaseRows = tplPhases.map((p, idx) => ({
        workspace_id: project.workspace_id,
        project_id: data.project_id,
        template_phase_id: p.id,
        key: p.key,
        name: p.name,
        order_index: idx,
        color: p.color,
        icon: p.icon,
        owner_role: p.owner_role,
        target_days: p.target_days,
        is_terminal: p.is_terminal,
        exit_criteria: p.exit_criteria as unknown as never,
        status: idx === 0 ? "active" : "planned",
        started_at: idx === 0 ? new Date().toISOString() : null,
      }));
      const { data: insertedPhases } = await supabaseAdmin
        .from("engagement_phases")
        .insert(phaseRows)
        .select("id, order_index");
      created.phases = insertedPhases?.length ?? 0;
      firstPhaseId = insertedPhases?.find((r) => r.order_index === 0)?.id ?? null;
    }

    for (const it of items.sort((a, b) => a.order_index - b.order_index)) {
      if (it.kind === "milestone") {
        const offset = Number(it.payload?.offset_days ?? 0);
        const due = new Date(start);
        due.setDate(due.getDate() + offset);
        await supabaseAdmin.from("milestones").insert({
          project_id: data.project_id,
          name: it.title,
          due_date: due.toISOString().slice(0, 10),
        } as never);
        created.milestones++;
      } else if (it.kind === "task") {
        await supabaseAdmin.from("tasks").insert({
          project_id: data.project_id,
          title: it.title,
          status: "todo",
          created_by: context.userId,
        } as never);
        created.tasks++;
      } else if (it.kind === "raid") {
        await supabaseAdmin.from("project_raid_items").insert({
          project_id: data.project_id,
          title: it.title,
          kind: (it.payload?.type as string) ?? "risk",
        } as never);
        created.raid++;
      }
    }

    await supabaseAdmin
      .from("projects")
      .update({
        template_id: data.template_id,
        ...(firstPhaseId ? { current_phase_id: firstPhaseId } : {}),
      })
      .eq("id", data.project_id);

    return { ok: true, created };
  });


// ============ HANDOVER PACKETS ============
export const createHandoverPacket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        onboarding_id: z.string().uuid().optional().nullable(),
        project_id: z.string().uuid().optional().nullable(),
        from_team: z.enum(["sales", "delivery", "ops", "support", "finance"]),
        to_team: z.enum(["sales", "delivery", "ops", "support", "finance"]),
        summary: z.string().max(5000).optional(),
        scope: z.string().max(5000).optional(),
        risks: z.string().max(5000).optional(),
        checklist: z.array(z.string().min(1).max(200)).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    const { data: packet, error } = await supabaseAdmin
      .from("handover_packets")
      .insert({
        workspace_id: data.workspace_id,
        onboarding_id: data.onboarding_id ?? null,
        project_id: data.project_id ?? null,
        from_team: data.from_team,
        to_team: data.to_team,
        summary: data.summary ?? null,
        scope: data.scope ?? null,
        risks: data.risks ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const defaultChecklist =
      data.checklist ??
      (data.from_team === "sales"
        ? [
            "Signed SOW attached",
            "Scope summary documented",
            "Commercial terms communicated",
            "Success criteria defined",
            "Known risks listed",
            "Client stakeholders identified",
            "Kickoff date confirmed",
          ]
        : [
            "Production URLs documented",
            "Credentials vault references shared",
            "Runbook published",
            "Support SLA confirmed",
            "Open RAID items handed over",
            "Recurring deliverables listed",
          ]);

    await supabaseAdmin.from("handover_checklist_items").insert(
      defaultChecklist.map((label, idx) => ({
        packet_id: packet.id,
        label,
        is_required: true,
        order_index: idx,
      }))
    );
    return packet;
  });

export const submitHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await supabaseAdmin
      .from("handover_packets")
      .select("workspace_id")
      .eq("id", data.id)
      .single();
    if (!p) throw new Error("Not found");
    await assertMember(p.workspace_id, context.userId);
    const { error } = await supabaseAdmin
      .from("handover_packets")
      .update({ status: "sent", submitted_by: context.userId, submitted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acceptHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await supabaseAdmin
      .from("handover_packets")
      .select("workspace_id")
      .eq("id", data.id)
      .single();
    if (!p) throw new Error("Not found");
    await assertMember(p.workspace_id, context.userId);
    const { error } = await supabaseAdmin
      .from("handover_packets")
      .update({
        status: "accepted",
        accepted_by: context.userId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().min(1).max(500) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await supabaseAdmin
      .from("handover_packets")
      .select("workspace_id")
      .eq("id", data.id)
      .single();
    if (!p) throw new Error("Not found");
    await assertMember(p.workspace_id, context.userId);
    const { error } = await supabaseAdmin
      .from("handover_packets")
      .update({
        status: "rejected",
        rejected_by: context.userId,
        rejected_at: new Date().toISOString(),
        rejection_reason: data.reason,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), is_complete: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: item } = await supabaseAdmin
      .from("handover_checklist_items")
      .select("id, packet_id, handover_packets!inner(workspace_id)")
      .eq("id", data.id)
      .single();
    if (!item) throw new Error("Not found");
    const ws = (item as unknown as { handover_packets: { workspace_id: string } }).handover_packets
      .workspace_id;
    await assertMember(ws, context.userId);
    const { error } = await supabaseAdmin
      .from("handover_checklist_items")
      .update({
        is_complete: data.is_complete,
        completed_by: data.is_complete ? context.userId : null,
        completed_at: data.is_complete ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
