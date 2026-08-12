// Containers are renameable spaces (client / personal / internal) that own
// projects. This file handles the user-facing CRUD that's not part of the
// CRM-specific intake flow (which lives in clients.functions.ts).
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
 * Rename a container. Personal containers can only be renamed by their
 * owner; internal/client containers can be renamed by any workspace member
 * (RLS already enforces workspace membership for writes).
 */
export const renameContainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: acc } = await supabaseAdmin
      .from("client_accounts")
      .select("workspace_id, kind, owner_user_id")
      .eq("id", data.id)
      .single();
    if (!acc) throw new Error("Container not found");
    await assertMember(acc.workspace_id, context.userId);

    const a = acc as { kind: string; owner_user_id: string | null };
    if (a.kind === "personal" && a.owner_user_id !== context.userId) {
      throw new Error("You can only rename your own personal space");
    }

    const { error } = await supabaseAdmin
      .from("client_accounts")
      .update({ name: data.name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Create a new internal container in the workspace. Workspaces can have any
 * number of internal containers (e.g. "Internal", "R&D", "Team ops").
 */
export const createInternalContainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMember(data.workspace_id, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("client_accounts")
      .insert({
        workspace_id: data.workspace_id,
        name: data.name,
        kind: "internal",
        status: "active",
        created_by: context.userId,
      })
      .select("id, name, kind")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Archive (soft-delete) a container. Cannot archive personal/internal. */
export const archiveContainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: acc } = await supabaseAdmin
      .from("client_accounts")
      .select("workspace_id, kind")
      .eq("id", data.id)
      .single();
    if (!acc) throw new Error("Container not found");
    await assertMember(acc.workspace_id, context.userId);
    if ((acc as { kind: string }).kind === "personal") {
      throw new Error("Personal spaces can't be archived");
    }
    const { error } = await supabaseAdmin
      .from("client_accounts")
      .update({ status: "churned" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
