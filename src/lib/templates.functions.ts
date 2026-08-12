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

const TemplateCategorySchema = z.enum([
  "web_build",
  "retainer",
  "consulting",
  "implementation",
  "custom",
]);

const TemplateItemKindSchema = z.enum([
  "milestone",
  "task",
  "raid",
  "doc_folder",
  "channel",
  "meeting",
  "automation",
  "intake_form",
  "role_slot",
]);

export const listProjectTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("project_templates")
      .select("*, items:project_template_items(id, kind, title, payload, order_index)")
      .eq("workspace_id", data.workspace_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getProjectTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: t, error } = await supabaseAdmin
      .from("project_templates")
      .select("*, items:project_template_items(*)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    await assertMember(t.workspace_id, context.userId);
    return t;
  });

export const upsertProjectTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        workspace_id: z.string().uuid(),
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional().nullable(),
        category: TemplateCategorySchema.optional(),
        default_duration_days: z.number().int().min(1).max(3650).optional(),
        is_active: z.boolean().optional(),
        items: z
          .array(
            z.object({
              id: z.string().uuid().optional(),
              kind: TemplateItemKindSchema,
              title: z.string().min(1).max(200),
              payload: z.record(z.string(), z.any()).optional(),
              order_index: z.number().int().optional(),
            })
          )
          .optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    const { items, ...tpl } = data;
    const { data: row, error } = await supabaseAdmin
      .from("project_templates")
      .upsert({ ...tpl, created_by: tpl.id ? undefined : context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (items) {
      await supabaseAdmin.from("project_template_items").delete().eq("template_id", row.id);
      if (items.length) {
        const payload = items.map((it, idx) => ({
          template_id: row.id,
          kind: it.kind,
          title: it.title,
          payload: (it.payload ?? {}) as unknown as never,
          order_index: it.order_index ?? idx,
        }));
        const { error: e2 } = await supabaseAdmin.from("project_template_items").insert(payload);
        if (e2) throw new Error(e2.message);
      }
    }
    return row;
  });

export const deleteProjectTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: t } = await supabaseAdmin
      .from("project_templates")
      .select("workspace_id")
      .eq("id", data.id)
      .single();
    if (!t) throw new Error("Not found");
    await assertMember(t.workspace_id, context.userId);
    const { error } = await supabaseAdmin.from("project_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const seedStarterTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    const starters: Array<{
      name: string;
      description: string;
      category: "web_build" | "retainer" | "implementation";
      duration: number;
      items: Array<{ kind: string; title: string; payload: Record<string, unknown> }>;
    }> = [
      {
        name: "Web Build",
        description: "Standard website / web app delivery engagement.",
        category: "web_build",
        duration: 60,
        items: [
          { kind: "milestone", title: "Discovery & Kickoff", payload: { offset_days: 0 } },
          { kind: "milestone", title: "Design Approval", payload: { offset_days: 14 } },
          { kind: "milestone", title: "Build & QA", payload: { offset_days: 45 } },
          { kind: "milestone", title: "Launch", payload: { offset_days: 60 } },
          { kind: "task", title: "Schedule kickoff call", payload: { role: "delivery" } },
          { kind: "task", title: "Send onboarding questionnaire", payload: { role: "delivery" } },
          { kind: "task", title: "Provision staging environment", payload: { role: "engineering" } },
          { kind: "raid", title: "Risk: Client content delivery delays", payload: { type: "risk" } },
          { kind: "doc_folder", title: "Contracts", payload: {} },
          { kind: "doc_folder", title: "Deliverables", payload: {} },
          { kind: "channel", title: "client-{slug}", payload: { audience: "client" } },
          { kind: "meeting", title: "Weekly status", payload: { cadence: "weekly" } },
          { kind: "intake_form", title: "Web build intake", payload: {} },
          { kind: "role_slot", title: "Project Manager", payload: { allocation: 25 } },
          { kind: "role_slot", title: "Designer", payload: { allocation: 50 } },
          { kind: "role_slot", title: "Engineer", payload: { allocation: 75 } },
        ],
      },
      {
        name: "Retainer",
        description: "Ongoing monthly retainer engagement.",
        category: "retainer",
        duration: 90,
        items: [
          { kind: "milestone", title: "Onboarding", payload: { offset_days: 0 } },
          { kind: "milestone", title: "First sprint complete", payload: { offset_days: 14 } },
          { kind: "task", title: "Set up monthly cadence", payload: { role: "delivery" } },
          { kind: "task", title: "Confirm hours bucket", payload: { role: "delivery" } },
          { kind: "meeting", title: "Monthly review", payload: { cadence: "monthly" } },
          { kind: "doc_folder", title: "Monthly Reports", payload: {} },
          { kind: "role_slot", title: "Account Manager", payload: { allocation: 20 } },
        ],
      },
      {
        name: "Implementation",
        description: "Software implementation / rollout project.",
        category: "implementation",
        duration: 90,
        items: [
          { kind: "milestone", title: "Requirements signed off", payload: { offset_days: 7 } },
          { kind: "milestone", title: "Configuration", payload: { offset_days: 30 } },
          { kind: "milestone", title: "UAT", payload: { offset_days: 75 } },
          { kind: "milestone", title: "Go-Live", payload: { offset_days: 90 } },
          { kind: "task", title: "Stakeholder mapping", payload: { role: "delivery" } },
          { kind: "task", title: "Data migration plan", payload: { role: "engineering" } },
          { kind: "raid", title: "Risk: Legacy data quality", payload: { type: "risk" } },
          { kind: "doc_folder", title: "Specs", payload: {} },
          { kind: "intake_form", title: "Implementation intake", payload: {} },
        ],
      },
    ];

    const created: string[] = [];
    for (const s of starters) {
      const { data: tpl } = await supabaseAdmin
        .from("project_templates")
        .insert({
          workspace_id: data.workspace_id,
          name: s.name,
          description: s.description,
          category: s.category,
          default_duration_days: s.duration,
          created_by: context.userId,
        })
        .select()
        .single();
      if (tpl) {
        created.push(tpl.id);
        const rows = s.items.map((it, idx) => ({
          template_id: tpl.id,
          kind: it.kind as
            | "milestone"
            | "task"
            | "raid"
            | "doc_folder"
            | "channel"
            | "meeting"
            | "automation"
            | "intake_form"
            | "role_slot",
          title: it.title,
          payload: it.payload as unknown as never,
          order_index: idx,
        }));
        await supabaseAdmin.from("project_template_items").insert(rows);
      }
    }
    return { created };
  });
