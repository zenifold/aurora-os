/**
 * Customer Intake Forms — server functions.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function authedUserId(): Promise<string | null> {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

class AuthError extends Error {}

async function requireProjectMember(projectId: string) {
  const userId = await authedUserId();
  if (!userId) throw new AuthError("Please sign in again.");
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id, workspace_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new AuthError("Project not found.");
  const { data: membership } = await supabaseAdmin
    .from("user_roles")
    .select("workspace_id")
    .eq("workspace_id", project.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) throw new AuthError("Not a workspace member.");
  return { userId, project };
}

async function safeRun<T extends object>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    return { error: (e as Error).message };
  }
}

const fieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "short_text",
    "long_text",
    "email",
    "number",
    "date",
    "select",
    "multiselect",
    "checkbox",
  ]),
  label: z.string().min(1).max(500),
  help: z.string().max(1000).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string().min(1).max(200)).max(50).optional(),
  placeholder: z.string().max(200).optional(),
});

const formInputSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  visibility: z.enum(["client", "internal", "both"]).default("client"),
  allow_anonymous: z.boolean().default(false),
  fields: z.array(fieldSchema).max(100),
});

export type IntakeFormInput = z.infer<typeof formInputSchema>;

// ---------- LIST ----------
export const listIntakeForms = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(({ data }) =>
    safeRun(async () => {
      await requireProjectMember(data.project_id);
      const { data: rows, error } = await supabaseAdmin
        .from("intake_forms")
        .select("*")
        .eq("project_id", data.project_id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return { forms: rows ?? [] };
    }),
  );

// ---------- SAVE ----------
export const saveIntakeForm = createServerFn({ method: "POST" })
  .inputValidator((d) => formInputSchema.parse(d))
  .handler(({ data }) =>
    safeRun(async () => {
      const { userId, project } = await requireProjectMember(data.project_id);
      const payload = {
        workspace_id: project.workspace_id,
        project_id: data.project_id,
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        visibility: data.visibility,
        allow_anonymous: data.allow_anonymous,
        fields: data.fields,
      };
      if (data.id) {
        const { data: row, error } = await supabaseAdmin
          .from("intake_forms")
          .update(payload)
          .eq("id", data.id)
          .select("*")
          .maybeSingle();
        if (error) throw new Error(error.message);
        return { form: row };
      }
      const { data: row, error } = await supabaseAdmin
        .from("intake_forms")
        .insert({ ...payload, created_by: userId })
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { form: row };
    }),
  );

// ---------- DELETE ----------
export const deleteIntakeForm = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), project_id: z.string().uuid() }).parse(d),
  )
  .handler(({ data }) =>
    safeRun(async () => {
      await requireProjectMember(data.project_id);
      const { error } = await supabaseAdmin.from("intake_forms").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }),
  );

// ---------- LIST RESPONSES ----------
export const listIntakeResponses = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ project_id: z.string().uuid(), form_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(({ data }) =>
    safeRun(async () => {
      await requireProjectMember(data.project_id);
      let q = supabaseAdmin
        .from("intake_form_responses")
        .select("*")
        .eq("project_id", data.project_id)
        .order("submitted_at", { ascending: false });
      if (data.form_id) q = q.eq("form_id", data.form_id);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      return { responses: rows ?? [] };
    }),
  );
