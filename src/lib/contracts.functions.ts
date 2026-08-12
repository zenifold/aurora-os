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

const ContractInput = z.object({
  id: z.string().uuid().optional(),
  workspace_id: z.string().uuid(),
  client_account_id: z.string().uuid(),
  deal_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  contract_type: z.enum(["sow", "msa", "order_form", "retainer", "amendment", "other"]).optional(),
  status: z.enum(["draft", "sent", "signed", "active", "expired", "terminated"]).optional(),
  value: z.number().min(0).max(1_000_000_000).optional().nullable(),
  currency: z.string().min(3).max(3).optional(),
  signed_date: z.string().optional().nullable(),
  effective_start: z.string().optional().nullable(),
  effective_end: z.string().optional().nullable(),
  file_url: z.string().url().optional().nullable().or(z.literal("")),
  notes: z.string().max(5000).optional().nullable(),
});

export const listContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        client_account_id: z.string().uuid().optional(),
        project_id: z.string().uuid().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    let q = supabaseAdmin
      .from("contracts")
      .select("*")
      .eq("workspace_id", data.workspace_id)
      .order("created_at", { ascending: false });
    if (data.client_account_id) q = q.eq("client_account_id", data.client_account_id);
    if (data.project_id) q = q.eq("project_id", data.project_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ContractInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    const payload = {
      ...data,
      file_url: data.file_url || null,
      created_by: data.id ? undefined : context.userId,
    };
    const { data: row, error } = await supabaseAdmin
      .from("contracts")
      .upsert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("contracts")
      .select("workspace_id")
      .eq("id", data.id)
      .single();
    if (!row) throw new Error("Not found");
    await assertMember(row.workspace_id, context.userId);
    const { error } = await supabaseAdmin.from("contracts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
