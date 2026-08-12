import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runScopeChecklistGeneration } from "@/lib/scope-checklist.server";

async function assertMember(workspaceId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Not a workspace member");
}

export const listScopeChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select("workspace_id")
      .eq("id", data.deal_id)
      .single();
    if (!deal) return [];
    await assertMember(deal.workspace_id, context.userId);
    const { data: items } = await supabaseAdmin
      .from("scope_checklist_items" as never)
      .select("*")
      .eq("deal_id", data.deal_id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    return items ?? [];
  });

/** Use AI to convert the latest brief into a structured scope checklist. */
export const generateScopeChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ deal_id: z.string().uuid(), replace: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select("id, workspace_id, title")
      .eq("id", data.deal_id)
      .single();
    if (!deal) throw new Error("Deal not found");
    await assertMember(deal.workspace_id, context.userId);

    return runScopeChecklistGeneration({
      workspaceId: deal.workspace_id,
      dealId: deal.id,
      dealTitle: deal.title,
      userId: context.userId,
      replace: !!data.replace,
    });
  });

export const upsertScopeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        deal_id: z.string().uuid(),
        patch: z
          .object({
            area: z.string().max(80).optional(),
            requirement: z.string().min(1).max(500).optional(),
            details: z.string().max(2000).nullable().optional(),
            priority: z.enum(["must_have", "should_have", "nice_to_have"]).optional(),
            status: z
              .enum(["in_scope", "out_of_scope", "needs_clarification", "deferred", "done"])
              .optional(),
            position: z.number().int().optional(),
          })
          .strict(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select("workspace_id")
      .eq("id", data.deal_id)
      .single();
    if (!deal) throw new Error("Deal not found");
    await assertMember(deal.workspace_id, context.userId);

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("scope_checklist_items" as never)
        .update(data.patch as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    if (!data.patch.requirement) throw new Error("Requirement required");
    const { error } = await supabaseAdmin.from("scope_checklist_items" as never).insert({
      workspace_id: deal.workspace_id,
      deal_id: data.deal_id,
      area: data.patch.area ?? "other",
      requirement: data.patch.requirement,
      details: data.patch.details ?? null,
      priority: data.patch.priority ?? "must_have",
      status: data.patch.status ?? "in_scope",
      ai_generated: false,
      created_by: context.userId,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteScopeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: item } = await supabaseAdmin
      .from("scope_checklist_items" as never)
      .select("workspace_id")
      .eq("id", data.id)
      .single();
    if (!item) return { ok: true };
    await assertMember((item as { workspace_id: string }).workspace_id, context.userId);
    await supabaseAdmin.from("scope_checklist_items" as never).delete().eq("id", data.id);
    return { ok: true };
  });

/** Push in_scope checklist items into the latest SOW draft as deliverables + scope text. */
export const applyChecklistToSow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select("workspace_id")
      .eq("id", data.deal_id)
      .single();
    if (!deal) throw new Error("Deal not found");
    await assertMember(deal.workspace_id, context.userId);

    const { data: sow } = await supabaseAdmin
      .from("sow_drafts" as never)
      .select("id, status, deliverables, scope, out_of_scope")
      .eq("deal_id", data.deal_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sow) return { ok: false as const, error: "Draft a SOW first" };
    const s = sow as {
      id: string;
      status: string;
      deliverables: Array<{ name: string; description?: string; acceptance_criteria?: string }>;
      scope: string;
      out_of_scope: string;
    };
    if (s.status === "approved" || s.status === "signed")
      return { ok: false as const, error: "SOW is locked" };

    const { data: items } = await supabaseAdmin
      .from("scope_checklist_items" as never)
      .select("*")
      .eq("deal_id", data.deal_id)
      .order("position", { ascending: true });
    const list = (items ?? []) as Array<{
      id: string;
      area: string;
      requirement: string;
      details: string | null;
      priority: string;
      status: string;
    }>;

    const inScope = list.filter((i) => i.status === "in_scope");
    const outScope = list.filter((i) => i.status === "out_of_scope");
    const needsClar = list.filter((i) => i.status === "needs_clarification");

    const byArea = inScope.reduce<Record<string, typeof inScope>>((acc, it) => {
      (acc[it.area] ??= []).push(it);
      return acc;
    }, {});

    const scopeMd = Object.entries(byArea)
      .map(([area, items]) => {
        const lines = items
          .map((i) => `- **[${i.priority.replace("_", " ")}]** ${i.requirement}${i.details ? ` — ${i.details}` : ""}`)
          .join("\n");
        return `## ${area.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}\n${lines}`;
      })
      .join("\n\n");

    const outScopeMd = outScope.length
      ? outScope.map((i) => `- ${i.requirement}${i.details ? ` — ${i.details}` : ""}`).join("\n")
      : s.out_of_scope;

    const needsMd = needsClar.length
      ? `\n\n## Open questions\n${needsClar.map((i) => `- ${i.requirement}`).join("\n")}`
      : "";

    // Convert in-scope items into deliverables (deduped by requirement)
    const existing = new Set(s.deliverables.map((d) => d.name.toLowerCase().trim()));
    const newDeliverables = inScope
      .filter((i) => !existing.has(i.requirement.toLowerCase().trim()))
      .map((i) => ({
        name: i.requirement,
        description: i.details ?? "",
        acceptance_criteria: `Satisfies ${i.area} requirement (${i.priority})`,
      }));
    const deliverables = [...s.deliverables, ...newDeliverables];

    const now = new Date().toISOString();
    const { error: upErr } = await supabaseAdmin
      .from("sow_drafts" as never)
      .update({
        scope: scopeMd + needsMd,
        out_of_scope: outScopeMd,
        deliverables,
      } as never)
      .eq("id", s.id);
    if (upErr) return { ok: false as const, error: upErr.message };

    await supabaseAdmin
      .from("scope_checklist_items" as never)
      .update({ sow_id: s.id, applied_to_sow_at: now } as never)
      .eq("deal_id", data.deal_id)
      .in(
        "id",
        list.map((i) => i.id),
      );

    return { ok: true as const, applied: inScope.length, added_deliverables: newDeliverables.length };
  });
