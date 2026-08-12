import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const dealIdInput = z.object({ deal_id: z.string().uuid() });

async function getDealWorkspaceId(supabase: any, deal_id: string): Promise<string> {
  const { data, error } = await supabase.from("deals").select("workspace_id").eq("id", deal_id).single();
  if (error || !data) throw error ?? new Error("Deal not found");
  return (data as { workspace_id: string }).workspace_id;
}

// ---------------- Activities ----------------
export type DealActivity = {
  id: string; deal_id: string; author_id: string | null;
  activity_type: string; content: string; metadata: any; created_at: string;
};

export const listDealActivities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => dealIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("deal_activities").select("*")
      .eq("deal_id", data.deal_id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return (rows ?? []) as DealActivity[];
  });

export const createDealActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    deal_id: z.string().uuid(),
    activity_type: z.enum(["note","call","email","meeting","stage_change","system"]).default("note"),
    content: z.string().min(1).max(5000),
    metadata: z.record(z.string(), z.any()).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ws = await getDealWorkspaceId(context.supabase, data.deal_id);
    const { data: row, error } = await (context.supabase as any)
      .from("deal_activities").insert({
        workspace_id: ws, deal_id: data.deal_id,
        author_id: context.userId, activity_type: data.activity_type,
        content: data.content, metadata: data.metadata ?? {},
      }).select("*").single();
    if (error) throw error;
    return row as DealActivity;
  });

// ---------------- Documents (sales_documents) ----------------
export type SalesDocument = {
  id: string; deal_id: string; name: string; description: string | null;
  document_type: string; source: string;
  storage_path: string | null; external_url: string | null;
  file_size_bytes: number | null; mime_type: string | null;
  ai_summary: string | null; created_at: string; updated_at: string;
};

export const listDealDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => dealIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("sales_documents").select("*")
      .eq("deal_id", data.deal_id).order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as SalesDocument[];
  });

export const createDealDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    deal_id: z.string().uuid(),
    name: z.string().min(1).max(500),
    description: z.string().max(2000).optional().nullable(),
    document_type: z.enum(["rfp","spec","transcript","deck","email","contract","wireframe","reference","screenshot","requirements","other"]).default("other"),
    source: z.enum(["upload","email","link","meeting","manual_note"]).default("upload"),
    storage_path: z.string().optional().nullable(),
    external_url: z.string().url().optional().nullable(),
    file_size_bytes: z.number().optional().nullable(),
    mime_type: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ws = await getDealWorkspaceId(context.supabase, data.deal_id);
    const { data: row, error } = await (context.supabase as any)
      .from("sales_documents").insert({
        workspace_id: ws, deal_id: data.deal_id,
        name: data.name, description: data.description ?? null,
        document_type: data.document_type, source: data.source,
        storage_path: data.storage_path ?? null, external_url: data.external_url ?? null,
        file_size_bytes: data.file_size_bytes ?? null, mime_type: data.mime_type ?? null,
        uploaded_by: context.userId,
      }).select("*").single();
    if (error) throw error;
    await (context.supabase as any).from("deal_activities").insert({
      workspace_id: ws, deal_id: data.deal_id, author_id: context.userId,
      activity_type: "system", content: `Added document: ${data.name}`,
    });
    return row as SalesDocument;
  });

export const updateDealDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(500).optional(),
    description: z.string().max(2000).optional().nullable(),
    document_type: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await (context.supabase as any).from("sales_documents").update(patch).eq("id", id);
    if (error) throw error; return { ok: true };
  });

export const deleteDealDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc } = await (context.supabase as any)
      .from("sales_documents").select("storage_path").eq("id", data.id).single();
    if (doc?.storage_path) {
      await (context.supabase as any).storage.from("deal-documents").remove([doc.storage_path]);
    }
    const { error } = await (context.supabase as any).from("sales_documents").delete().eq("id", data.id);
    if (error) throw error; return { ok: true };
  });

// ---------------- Phases ----------------
export type DealPhase = {
  id: string; deal_id: string; name: string; description: string | null;
  duration_weeks: number | null; position: number; created_at: string;
};

export const listDealPhases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => dealIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("deal_phases").select("*").eq("deal_id", data.deal_id).order("position", { ascending: true });
    if (error) throw error;
    return (rows ?? []) as DealPhase[];
  });

export const createDealPhase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    deal_id: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    duration_weeks: z.number().min(0).max(520).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ws = await getDealWorkspaceId(context.supabase, data.deal_id);
    const { data: max } = await (context.supabase as any)
      .from("deal_phases").select("position").eq("deal_id", data.deal_id)
      .order("position", { ascending: false }).limit(1).maybeSingle();
    const pos = ((max?.position as number) ?? -1) + 1;
    const { data: row, error } = await (context.supabase as any)
      .from("deal_phases").insert({
        workspace_id: ws, deal_id: data.deal_id, name: data.name,
        description: data.description ?? null, duration_weeks: data.duration_weeks ?? null,
        position: pos, created_by: context.userId,
      }).select("*").single();
    if (error) throw error;
    return row as DealPhase;
  });

export const updateDealPhase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    duration_weeks: z.number().optional().nullable(),
    position: z.number().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await (context.supabase as any).from("deal_phases").update(patch).eq("id", id);
    if (error) throw error; return { ok: true };
  });

export const deleteDealPhase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("deal_phases").delete().eq("id", data.id);
    if (error) throw error; return { ok: true };
  });

// ---------------- Milestones ----------------
export type DealMilestone = {
  id: string; deal_id: string; title: string; description: string | null;
  target_date: string | null; status: string; position: number; created_at: string;
};

export const listDealMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => dealIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("deal_milestones").select("*").eq("deal_id", data.deal_id)
      .order("target_date", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (rows ?? []) as DealMilestone[];
  });

export const createDealMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    deal_id: z.string().uuid(), title: z.string().min(1).max(300),
    description: z.string().max(2000).optional().nullable(),
    target_date: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ws = await getDealWorkspaceId(context.supabase, data.deal_id);
    const { data: row, error } = await (context.supabase as any)
      .from("deal_milestones").insert({
        workspace_id: ws, deal_id: data.deal_id, title: data.title,
        description: data.description ?? null, target_date: data.target_date || null,
        created_by: context.userId,
      }).select("*").single();
    if (error) throw error;
    return row as DealMilestone;
  });

export const updateDealMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(2000).optional().nullable(),
    target_date: z.string().optional().nullable(),
    status: z.enum(["planned","at_risk","done","missed"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await (context.supabase as any).from("deal_milestones").update(patch).eq("id", id);
    if (error) throw error; return { ok: true };
  });

export const deleteDealMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("deal_milestones").delete().eq("id", data.id);
    if (error) throw error; return { ok: true };
  });

// ---------------- Assumptions ----------------
export type DealAssumption = { id: string; deal_id: string; text: string; created_at: string };

export const listDealAssumptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => dealIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("deal_assumptions").select("*").eq("deal_id", data.deal_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as DealAssumption[];
  });

export const createDealAssumption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deal_id: z.string().uuid(), text: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const ws = await getDealWorkspaceId(context.supabase, data.deal_id);
    const { data: row, error } = await (context.supabase as any)
      .from("deal_assumptions").insert({
        workspace_id: ws, deal_id: data.deal_id, text: data.text, created_by: context.userId,
      }).select("*").single();
    if (error) throw error;
    return row as DealAssumption;
  });

export const deleteDealAssumption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("deal_assumptions").delete().eq("id", data.id);
    if (error) throw error; return { ok: true };
  });

// ---------------- Resources ----------------
export type DealResource = {
  id: string; deal_id: string; role: string; assignee_user_id: string | null;
  is_external: boolean; vendor_name: string | null;
  hours: number | null; hourly_rate: number | null; notes: string | null; created_at: string;
};

export const listDealResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => dealIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("deal_resources").select("*").eq("deal_id", data.deal_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (rows ?? []) as DealResource[];
  });

export const createDealResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    deal_id: z.string().uuid(), role: z.string().min(1).max(200),
    is_external: z.boolean().default(false), vendor_name: z.string().max(200).optional().nullable(),
    hours: z.number().min(0).optional().nullable(), hourly_rate: z.number().min(0).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ws = await getDealWorkspaceId(context.supabase, data.deal_id);
    const { data: row, error } = await (context.supabase as any)
      .from("deal_resources").insert({
        workspace_id: ws, deal_id: data.deal_id, role: data.role,
        is_external: data.is_external, vendor_name: data.vendor_name ?? null,
        hours: data.hours ?? null, hourly_rate: data.hourly_rate ?? null,
        notes: data.notes ?? null, created_by: context.userId,
      }).select("*").single();
    if (error) throw error;
    return row as DealResource;
  });

export const updateDealResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(), role: z.string().min(1).max(200).optional(),
    is_external: z.boolean().optional(), vendor_name: z.string().optional().nullable(),
    hours: z.number().optional().nullable(), hourly_rate: z.number().optional().nullable(),
    notes: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await (context.supabase as any).from("deal_resources").update(patch).eq("id", id);
    if (error) throw error; return { ok: true };
  });

export const deleteDealResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("deal_resources").delete().eq("id", data.id);
    if (error) throw error; return { ok: true };
  });

// ---------------- Quote options ----------------
export type DealQuoteOption = {
  id: string; deal_id: string; label: string; pricing_model: string;
  total_value: number | null; currency: string; terms: string | null;
  win_probability: number | null; is_selected: boolean; notes: string | null; created_at: string;
};

export const listDealQuoteOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => dealIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("deal_quote_options").select("*").eq("deal_id", data.deal_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (rows ?? []) as DealQuoteOption[];
  });

export const createDealQuoteOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    deal_id: z.string().uuid(), label: z.string().min(1).max(200),
    pricing_model: z.enum(["fixed","tm","retainer","hybrid"]).default("fixed"),
    total_value: z.number().min(0).optional().nullable(),
    currency: z.string().length(3).default("USD"),
    terms: z.string().max(2000).optional().nullable(),
    win_probability: z.number().min(0).max(100).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ws = await getDealWorkspaceId(context.supabase, data.deal_id);
    const { data: row, error } = await (context.supabase as any)
      .from("deal_quote_options").insert({
        workspace_id: ws, deal_id: data.deal_id, label: data.label,
        pricing_model: data.pricing_model, total_value: data.total_value ?? null,
        currency: data.currency, terms: data.terms ?? null,
        win_probability: data.win_probability ?? null, notes: data.notes ?? null,
        created_by: context.userId,
      }).select("*").single();
    if (error) throw error;
    return row as DealQuoteOption;
  });

export const updateDealQuoteOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(), label: z.string().min(1).max(200).optional(),
    pricing_model: z.enum(["fixed","tm","retainer","hybrid"]).optional(),
    total_value: z.number().optional().nullable(),
    terms: z.string().optional().nullable(),
    win_probability: z.number().min(0).max(100).optional().nullable(),
    notes: z.string().optional().nullable(),
    is_selected: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    // If marking as selected, unselect others for this deal
    if (patch.is_selected === true) {
      const { data: q } = await (context.supabase as any)
        .from("deal_quote_options").select("deal_id").eq("id", id).single();
      if (q?.deal_id) {
        await (context.supabase as any).from("deal_quote_options")
          .update({ is_selected: false }).eq("deal_id", q.deal_id);
      }
    }
    const { error } = await (context.supabase as any).from("deal_quote_options").update(patch).eq("id", id);
    if (error) throw error; return { ok: true };
  });

export const deleteDealQuoteOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("deal_quote_options").delete().eq("id", data.id);
    if (error) throw error; return { ok: true };
  });

// ---------------- Deal status / value update ----------------
export const updateDealCore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(300).optional(),
    status: z.enum(["open","won","lost"]).optional(),
    value: z.number().min(0).optional().nullable(),
    currency: z.string().min(1).max(10).optional(),
    expected_close_date: z.string().optional().nullable(),
    probability: z.number().min(0).max(100).optional(),
    description: z.string().max(5000).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const update: any = { ...patch };
    if (patch.status === "won") update.won_at = new Date().toISOString();
    if (patch.status === "lost") update.lost_at = new Date().toISOString();
    const { error } = await (context.supabase as any).from("deals").update(update).eq("id", id);
    if (error) throw error; return { ok: true };
  });

// ---------------- Sprints ----------------
export type DealSprint = {
  id: string; deal_id: string; name: string; goal: string | null;
  start_date: string | null; end_date: string | null;
  status: "planned" | "active" | "completed"; position: number;
  created_at: string; updated_at: string;
};

export const listDealSprints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => dealIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("deal_sprints").select("*").eq("deal_id", data.deal_id)
      .order("position", { ascending: true }).order("created_at", { ascending: true });
    if (error) throw error; return (rows ?? []) as DealSprint[];
  });

export const createDealSprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    deal_id: z.string().uuid(), name: z.string().min(1).max(200),
    goal: z.string().max(2000).optional().nullable(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("deal_sprints").insert({
        deal_id: data.deal_id, name: data.name, goal: data.goal ?? null,
        start_date: data.start_date ?? null, end_date: data.end_date ?? null,
        created_by: context.userId,
      }).select("*").single();
    if (error) throw error; return row as DealSprint;
  });

export const updateDealSprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200).optional(),
    goal: z.string().max(2000).optional().nullable(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    status: z.enum(["planned","active","completed"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await (context.supabase as any).from("deal_sprints").update(patch).eq("id", id);
    if (error) throw error; return { ok: true };
  });

export const deleteDealSprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("deal_sprints").delete().eq("id", data.id);
    if (error) throw error; return { ok: true };
  });

// ---------------- Tasks ----------------
export type DealTask = {
  id: string; deal_id: string;
  phase_id: string | null; milestone_id: string | null; sprint_id: string | null;
  title: string; description: string | null;
  status: "todo" | "in_progress" | "review" | "done" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  estimate_hours: number | null; assignee_user_id: string | null;
  due_date: string | null; position: number;
  created_at: string; updated_at: string;
};

export const listDealTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => dealIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("deal_tasks").select("*").eq("deal_id", data.deal_id)
      .order("position", { ascending: true }).order("created_at", { ascending: true });
    if (error) throw error; return (rows ?? []) as DealTask[];
  });

export const createDealTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    deal_id: z.string().uuid(),
    title: z.string().min(1).max(300),
    description: z.string().max(10000).optional().nullable(),
    phase_id: z.string().uuid().optional().nullable(),
    milestone_id: z.string().uuid().optional().nullable(),
    sprint_id: z.string().uuid().optional().nullable(),
    status: z.enum(["todo","in_progress","review","done","blocked"]).optional(),
    priority: z.enum(["low","medium","high","urgent"]).optional(),
    estimate_hours: z.number().min(0).optional().nullable(),
    due_date: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("deal_tasks").insert({
        deal_id: data.deal_id, title: data.title, description: data.description ?? null,
        phase_id: data.phase_id ?? null, milestone_id: data.milestone_id ?? null,
        sprint_id: data.sprint_id ?? null,
        status: data.status ?? "todo", priority: data.priority ?? "medium",
        estimate_hours: data.estimate_hours ?? null, due_date: data.due_date ?? null,
        created_by: context.userId,
      }).select("*").single();
    if (error) throw error; return row as DealTask;
  });

export const updateDealTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(10000).optional().nullable(),
    phase_id: z.string().uuid().optional().nullable(),
    milestone_id: z.string().uuid().optional().nullable(),
    sprint_id: z.string().uuid().optional().nullable(),
    status: z.enum(["todo","in_progress","review","done","blocked"]).optional(),
    priority: z.enum(["low","medium","high","urgent"]).optional(),
    estimate_hours: z.number().min(0).optional().nullable(),
    due_date: z.string().optional().nullable(),
    position: z.number().int().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await (context.supabase as any).from("deal_tasks").update(patch).eq("id", id);
    if (error) throw error; return { ok: true };
  });

export const deleteDealTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("deal_tasks").delete().eq("id", data.id);
    if (error) throw error; return { ok: true };
  });
