import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KIND = z.enum(["fact", "preference", "style", "other"]);

async function ensureManager(supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>, workspaceId: string, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .in("role", ["owner", "admin", "manager"])
    .maybeSingle();
  return !!data;
}

export const listAuraMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspace_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("workspace_ai_memory")
      .select("*")
      .eq("workspace_id", data.workspace_id)
      .order("pinned", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, memory: rows ?? [] };
  });

export const upsertAuraMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      workspace_id: z.string().uuid(),
      content: z.string().min(1).max(2000),
      kind: KIND.default("fact"),
      pinned: z.boolean().default(true),
      sort_order: z.number().int().min(0).max(9999).default(0),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("workspace_ai_memory")
        .update({
          content: data.content,
          kind: data.kind,
          pinned: data.pinned,
          sort_order: data.sort_order,
        })
        .eq("id", data.id);
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, id: data.id };
    }
    const { data: row, error } = await supabase
      .from("workspace_ai_memory")
      .insert({
        workspace_id: data.workspace_id,
        content: data.content,
        kind: data.kind,
        pinned: data.pinned,
        sort_order: data.sort_order,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: row!.id as string };
  });

export const deleteAuraMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("workspace_ai_memory").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// re-export so we don't get unused warning
void ensureManager;
