import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Project requirements ------------------------------------------------------

export type ProjectRequirement = {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  owner_id: string | null;
  source: string;
  source_deal_id: string | null;
  created_at: string;
  updated_at: string;
};

export const listProjectRequirements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await (supabase as any)
      .from("project_requirements")
      .select("*")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as unknown as ProjectRequirement[];
  });

export const createProjectRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      project_id: z.string().uuid(),
      title: z.string().min(1).max(500),
      description: z.string().max(5000).optional().nullable(),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      source: z.enum(["delivery", "presales"]).default("delivery"),
      source_deal_id: z.string().uuid().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: proj, error: pe } = await supabase
      .from("projects").select("workspace_id").eq("id", data.project_id).single();
    if (pe || !proj) throw pe ?? new Error("Project not found");
    const { data: row, error } = await (supabase as any)
      .from("project_requirements")
      .insert({
        workspace_id: (proj as { workspace_id: string }).workspace_id,
        project_id: data.project_id,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        source: data.source,
        source_deal_id: data.source_deal_id ?? null,
        created_by: userId,
      })
      .select("*").single();
    if (error) throw error;
    return row as unknown as ProjectRequirement;
  });

export const updateProjectRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(5000).optional().nullable(),
      status: z.string().max(50).optional(),
      priority: z.string().max(50).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...patch } = data;
    const { error } = await (supabase as any).from("project_requirements").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteProjectRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("project_requirements").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Project dependencies -----------------------------------------------------

export type ProjectDependency = {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  depends_on_project_id: string | null;
  depends_on_deal_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export const listProjectDependencies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("project_dependencies")
      .select("*")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as unknown as ProjectDependency[];
  });

export const createProjectDependency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      project_id: z.string().uuid(),
      title: z.string().min(1).max(500),
      description: z.string().max(5000).optional().nullable(),
      type: z.enum(["internal", "external", "vendor", "approval"]).default("external"),
      due_date: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: proj, error: pe } = await supabase
      .from("projects").select("workspace_id").eq("id", data.project_id).single();
    if (pe || !proj) throw pe ?? new Error("Project not found");
    const { data: row, error } = await (supabase as any)
      .from("project_dependencies")
      .insert({
        workspace_id: (proj as { workspace_id: string }).workspace_id,
        project_id: data.project_id,
        title: data.title,
        description: data.description ?? null,
        type: data.type,
        due_date: data.due_date ?? null,
        created_by: userId,
      })
      .select("*").single();
    if (error) throw error;
    return row as unknown as ProjectDependency;
  });

export const updateProjectDependency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(5000).optional().nullable(),
      status: z.string().max(50).optional(),
      type: z.string().max(50).optional(),
      due_date: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await (context.supabase as any).from("project_dependencies").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteProjectDependency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("project_dependencies").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Deal requirements --------------------------------------------------------

export type DealRequirement = {
  id: string;
  workspace_id: string;
  deal_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
};

export const listDealRequirements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("deal_requirements")
      .select("*")
      .eq("deal_id", data.deal_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as unknown as DealRequirement[];
  });

export const createDealRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      deal_id: z.string().uuid(),
      title: z.string().min(1).max(500),
      description: z.string().max(5000).optional().nullable(),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: deal, error: de } = await supabase
      .from("deals").select("workspace_id").eq("id", data.deal_id).single();
    if (de || !deal) throw de ?? new Error("Deal not found");
    const { data: row, error } = await (supabase as any)
      .from("deal_requirements")
      .insert({
        workspace_id: (deal as { workspace_id: string }).workspace_id,
        deal_id: data.deal_id,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        created_by: userId,
      })
      .select("*").single();
    if (error) throw error;
    return row as unknown as DealRequirement;
  });

export const updateDealRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(5000).optional().nullable(),
      status: z.string().max(50).optional(),
      priority: z.string().max(50).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await (context.supabase as any).from("deal_requirements").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteDealRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("deal_requirements").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Deal dependencies --------------------------------------------------------

export type DealDependency = {
  id: string;
  workspace_id: string;
  deal_id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export const listDealDependencies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("deal_dependencies")
      .select("*")
      .eq("deal_id", data.deal_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as unknown as DealDependency[];
  });

export const createDealDependency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      deal_id: z.string().uuid(),
      title: z.string().min(1).max(500),
      description: z.string().max(5000).optional().nullable(),
      type: z.enum(["internal", "external", "vendor", "approval"]).default("external"),
      due_date: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: deal, error: de } = await supabase
      .from("deals").select("workspace_id").eq("id", data.deal_id).single();
    if (de || !deal) throw de ?? new Error("Deal not found");
    const { data: row, error } = await (supabase as any)
      .from("deal_dependencies")
      .insert({
        workspace_id: (deal as { workspace_id: string }).workspace_id,
        deal_id: data.deal_id,
        title: data.title,
        description: data.description ?? null,
        type: data.type,
        due_date: data.due_date ?? null,
        created_by: userId,
      })
      .select("*").single();
    if (error) throw error;
    return row as unknown as DealDependency;
  });

export const updateDealDependency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(5000).optional().nullable(),
      status: z.string().max(50).optional(),
      type: z.string().max(50).optional(),
      due_date: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await (context.supabase as any).from("deal_dependencies").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteDealDependency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("deal_dependencies").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
