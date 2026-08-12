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

/**
 * Convert a won deal into an engagement (project).
 * - Creates a project linked to the deal + customer.
 * - Optionally applies the customer's default template (or one passed in).
 * - Stubs a Signed contract row pre-populated with the deal value, ready
 *   for the user to attach the document.
 *
 * Idempotent: if the deal already has handed_off_project_id, returns it.
 */
export const convertWonDealToEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        deal_id: z.string().uuid(),
        template_id: z.string().uuid().optional().nullable(),
        create_contract: z.boolean().optional(),
        project_name: z.string().min(1).max(200).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: deal } = await supabaseAdmin
      .from("deals")
      .select(
        "id, workspace_id, client_account_id, title, value, currency, handed_off_project_id, owner_id"
      )
      .eq("id", data.deal_id)
      .single();
    if (!deal) throw new Error("Deal not found");
    await assertMember(deal.workspace_id, context.userId);

    if (deal.handed_off_project_id) {
      return {
        project_id: deal.handed_off_project_id,
        template_id: data.template_id ?? null,
        existed: true,
      };
    }

    // Resolve template: explicit > customer default
    let templateId = data.template_id ?? null;
    if (!templateId && deal.client_account_id) {
      const { data: acc } = await supabaseAdmin
        .from("client_accounts")
        .select("default_template_id")
        .eq("id", deal.client_account_id)
        .single();
      templateId = acc?.default_template_id ?? null;
    }

    // Create the project
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .insert({
        workspace_id: deal.workspace_id,
        client_account_id: deal.client_account_id,
        name: (data.project_name && data.project_name.trim()) || deal.title,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (projErr || !project) throw new Error(projErr?.message ?? "Failed to create project");

    // Link deal → project
    await supabaseAdmin
      .from("deals")
      .update({
        handed_off_project_id: project.id,
        handed_off_at: new Date().toISOString(),
      })
      .eq("id", data.deal_id);

    // Optionally stub a signed contract for the value
    if (data.create_contract !== false && deal.client_account_id) {
      await supabaseAdmin.from("contracts").insert({
        workspace_id: deal.workspace_id,
        client_account_id: deal.client_account_id,
        deal_id: deal.id,
        project_id: project.id,
        title: `${deal.title} — SOW`,
        contract_type: "sow",
        status: "signed",
        value: deal.value,
        currency: deal.currency ?? "USD",
        signed_date: new Date().toISOString().slice(0, 10),
        created_by: context.userId,
      });
    }

    return { project_id: project.id, template_id: templateId, existed: false };
  });
