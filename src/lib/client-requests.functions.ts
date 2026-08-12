import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  OPENROUTER_KEY_MISSING_ERROR,
  resolveOpenRouterKey,
} from "@/server/openrouter-key.server";

async function assertAccountWorkspace(accountId: string, userId: string) {
  const { data: acc } = await supabaseAdmin
    .from("client_accounts")
    .select("id, workspace_id, name")
    .eq("id", accountId)
    .maybeSingle();
  if (!acc) throw new Error("Client not found");
  const { data: mem } = await supabaseAdmin
    .from("user_roles")
    .select("workspace_id")
    .eq("workspace_id", acc.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!mem) throw new Error("Not a workspace member");
  return acc;
}

async function assertBundleAccess(bundleId: string, userId: string) {
  const { data: b } = await supabaseAdmin
    .from("client_request_bundles")
    .select("id, workspace_id, client_account_id, share_token, title")
    .eq("id", bundleId)
    .maybeSingle();
  if (!b) throw new Error("Bundle not found");
  const { data: mem } = await supabaseAdmin
    .from("user_roles")
    .select("workspace_id")
    .eq("workspace_id", b.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!mem) throw new Error("Not a workspace member");
  return b;
}

/* ---------------- List bundles for a client ---------------- */
export const listClientRequestBundles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ client_account_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAccountWorkspace(data.client_account_id, context.userId);
    const { data: bundles } = await supabaseAdmin
      .from("client_request_bundles")
      .select("*, items:client_request_items(id, status, is_required, item_type)")
      .eq("client_account_id", data.client_account_id)
      .order("created_at", { ascending: false });
    return { bundles: bundles ?? [] };
  });

/* ---------------- Get one bundle with items + activity ---------------- */
export const getClientRequestBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bundle_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertBundleAccess(data.bundle_id, context.userId);
    const [{ data: bundle }, { data: items }, { data: activity }] = await Promise.all([
      supabaseAdmin.from("client_request_bundles").select("*").eq("id", data.bundle_id).single(),
      supabaseAdmin
        .from("client_request_items")
        .select("*")
        .eq("bundle_id", data.bundle_id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("client_request_activity")
        .select("*")
        .eq("bundle_id", data.bundle_id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return { bundle, items: items ?? [], activity: activity ?? [] };
  });

/* ---------------- Create bundle (manual) ---------------- */
const ItemInput = z.object({
  label: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  item_type: z.enum(["file", "text", "decision", "link"]).default("file"),
  is_required: z.boolean().default(true),
});

export const createClientRequestBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        client_account_id: z.string().uuid(),
        project_id: z.string().uuid().nullable().optional(),
        title: z.string().min(1).max(200),
        instructions: z.string().max(4000).nullable().optional(),
        due_date: z.string().nullable().optional(),
        recipient_name: z.string().max(200).nullable().optional(),
        recipient_email: z.string().email().nullable().optional(),
        items: z.array(ItemInput).min(1).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const acc = await assertAccountWorkspace(data.client_account_id, context.userId);
    const { data: bundle, error } = await supabaseAdmin
      .from("client_request_bundles")
      .insert({
        workspace_id: acc.workspace_id,
        client_account_id: data.client_account_id,
        project_id: data.project_id ?? null,
        title: data.title,
        instructions: data.instructions ?? null,
        due_date: data.due_date ?? null,
        recipient_name: data.recipient_name ?? null,
        recipient_email: data.recipient_email ?? null,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error || !bundle) throw new Error(error?.message ?? "Could not create bundle");

    const itemRows = data.items.map((it, idx) => ({
      bundle_id: bundle.id,
      workspace_id: acc.workspace_id,
      label: it.label,
      description: it.description ?? null,
      item_type: it.item_type,
      is_required: it.is_required,
      sort_order: idx,
    }));
    await supabaseAdmin.from("client_request_items").insert(itemRows);

    await supabaseAdmin.from("client_request_activity").insert({
      bundle_id: bundle.id,
      workspace_id: acc.workspace_id,
      actor_type: "agency",
      event: "bundle_created",
      detail: { item_count: data.items.length },
    });

    return { bundle };
  });

/* ---------------- Update bundle (status, instructions, due_date) ---------------- */
export const updateClientRequestBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        bundle_id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        instructions: z.string().max(4000).nullable().optional(),
        due_date: z.string().nullable().optional(),
        status: z.enum(["draft", "sent", "partial", "completed", "archived"]).optional(),
        recipient_name: z.string().max(200).nullable().optional(),
        recipient_email: z.string().email().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const b = await assertBundleAccess(data.bundle_id, context.userId);
    const patch: {
      title?: string;
      instructions?: string | null;
      due_date?: string | null;
      status?: "draft" | "sent" | "partial" | "completed" | "archived";
      sent_at?: string;
      recipient_name?: string | null;
      recipient_email?: string | null;
    } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.instructions !== undefined) patch.instructions = data.instructions;
    if (data.due_date !== undefined) patch.due_date = data.due_date;
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "sent") patch.sent_at = new Date().toISOString();
    }
    if (data.recipient_name !== undefined) patch.recipient_name = data.recipient_name;
    if (data.recipient_email !== undefined) patch.recipient_email = data.recipient_email;
    const { error } = await supabaseAdmin
      .from("client_request_bundles")
      .update(patch)
      .eq("id", data.bundle_id);
    if (error) throw new Error(error.message);
    if (data.status) {
      await supabaseAdmin.from("client_request_activity").insert({
        bundle_id: data.bundle_id,
        workspace_id: b.workspace_id,
        actor_type: "agency",
        event: `status_${data.status}`,
        detail: {},
      });
    }
    return { ok: true };
  });

export const deleteClientRequestBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bundle_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertBundleAccess(data.bundle_id, context.userId);
    const { error } = await supabaseAdmin
      .from("client_request_bundles")
      .delete()
      .eq("id", data.bundle_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Item CRUD ---------------- */
export const upsertClientRequestItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        bundle_id: z.string().uuid(),
        item_id: z.string().uuid().nullable().optional(),
        label: z.string().min(1).max(200),
        description: z.string().max(2000).nullable().optional(),
        item_type: z.enum(["file", "text", "decision", "link"]),
        is_required: z.boolean(),
        sort_order: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const b = await assertBundleAccess(data.bundle_id, context.userId);
    if (data.item_id) {
      const { error } = await supabaseAdmin
        .from("client_request_items")
        .update({
          label: data.label,
          description: data.description ?? null,
          item_type: data.item_type,
          is_required: data.is_required,
          ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
        })
        .eq("id", data.item_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabaseAdmin.from("client_request_items").insert({
      bundle_id: data.bundle_id,
      workspace_id: b.workspace_id,
      label: data.label,
      description: data.description ?? null,
      item_type: data.item_type,
      is_required: data.is_required,
      sort_order: data.sort_order ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClientRequestItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ bundle_id: z.string().uuid(), item_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertBundleAccess(data.bundle_id, context.userId);
    const { error } = await supabaseAdmin
      .from("client_request_items")
      .delete()
      .eq("id", data.item_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- AI: generate request items from a prompt ---------------- */
export const generateClientRequestItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        client_account_id: z.string().uuid(),
        prompt: z.string().min(3).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const acc = await assertAccountWorkspace(data.client_account_id, context.userId);
    const apiKey = await resolveOpenRouterKey(acc.workspace_id);
    if (!apiKey) return { ok: false as const, error: OPENROUTER_KEY_MISSING_ERROR };

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              'You are an agency project manager. Given a request from the team for what they need from a CLIENT to kick off or move work forward, output JSON: { "title": "short bundle title", "instructions": "1-2 sentence intro the client will read", "items": [ { "label": "short ask label", "description": "1 sentence guidance", "item_type": "file" | "text" | "decision" | "link", "is_required": true|false } ] }. Items should be specific, actionable, and complete. 4-10 items. No preamble.',
          },
          { role: "user", content: `Client: ${acc.name}\n\nRequest: ${data.prompt}` },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) return { ok: false as const, error: "AI rate limit — try again shortly." };
    if (res.status === 402) return { ok: false as const, error: "AI credits exhausted." };
    if (!res.ok) {
      const t = await res.text();
      return { ok: false as const, error: `AI gateway ${res.status}: ${t.slice(0, 200)}` };
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content ?? "{}";
    try {
      const json = JSON.parse(content) as {
        title?: string;
        instructions?: string;
        items?: Array<{
          label: string;
          description?: string;
          item_type?: "file" | "text" | "decision" | "link";
          is_required?: boolean;
        }>;
      };
      return { ok: true as const, draft: json };
    } catch {
      return { ok: false as const, error: "AI returned invalid JSON" };
    }
  });

/* ---------------- AI: summarize completed submission ---------------- */
export const summarizeClientRequestSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bundle_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const b = await assertBundleAccess(data.bundle_id, context.userId);
    const { data: items } = await supabaseAdmin
      .from("client_request_items")
      .select("label, description, item_type, is_required, status, response_text, response_decision, response_link, response_files")
      .eq("bundle_id", data.bundle_id)
      .order("sort_order");

    const apiKey = await resolveOpenRouterKey(b.workspace_id);
    if (!apiKey) return { ok: false as const, error: OPENROUTER_KEY_MISSING_ERROR };

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              'You are an agency project manager. The CLIENT just responded to a checklist of requested items. Output JSON: { "summary": "2-3 sentence summary of what was provided and quality/completeness", "gaps": ["short bullet of anything missing or unclear"], "plan_updates": ["short bullet of suggested updates to the project plan based on what was submitted"], "next_actions": ["short bullet, owner=agency"] }. Be specific. No preamble.',
          },
          {
            role: "user",
            content: JSON.stringify({ bundle_title: b.title, items }),
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return { ok: false as const, error: `AI gateway ${res.status}` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content ?? "{}";
    try {
      const json = JSON.parse(content);
      await supabaseAdmin
        .from("client_request_bundles")
        .update({ ai_summary: JSON.stringify(json) })
        .eq("id", data.bundle_id);
      await supabaseAdmin.from("client_request_activity").insert({
        bundle_id: data.bundle_id,
        workspace_id: b.workspace_id,
        actor_type: "ai",
        event: "submission_summarized",
        detail: json,
      });
      return { ok: true as const, summary: json };
    } catch {
      return { ok: false as const, error: "AI returned invalid JSON" };
    }
  });

/* ---------------- Get signed URL for an agency-uploaded file in the request bucket ---------------- */
export const getRequestUploadSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ bundle_id: z.string().uuid(), path: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertBundleAccess(data.bundle_id, context.userId);
    const { data: signed, error } = await supabaseAdmin.storage
      .from("client-request-uploads")
      .createSignedUrl(data.path, 600);
    if (error || !signed) throw new Error(error?.message ?? "Could not sign URL");
    return { url: signed.signedUrl };
  });
