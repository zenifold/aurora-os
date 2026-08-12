/**
 * Project Overview server functions (RPC layer).
 * Heavy logic lives in overview-refresh.server.ts so the supabaseAdmin
 * import is fully stripped from the client bundle.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nextRefreshAt } from "@/lib/overview-types";
import {
  ensureProjectOverview,
  ensureWorkspaceTemplate,
  runRefresh,
} from "./overview-refresh.server";



async function getUserIdFromRequest(): Promise<string | null> {
  const authHeader = getRequest()?.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

export const getProjectOverview = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromRequest();
    if (!userId) return { error: "Please sign in again." };

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, workspace_id, name")
      .eq("id", data.project_id)
      .maybeSingle();
    if (!project) return { error: "Project not found." };

    const { data: membership } = await supabaseAdmin
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return { error: "Not a workspace member." };

    const template = await ensureWorkspaceTemplate(project.workspace_id);
    const overview = await ensureProjectOverview(project.workspace_id, project.id);

    const { data: snaps } = await supabaseAdmin
      .from("project_overview_snapshots" as never)
      .select("id, summary, health, ai_model, generated_by, generated_at, sections")
      .eq("project_id", project.id)
      .order("generated_at", { ascending: false })
      .limit(20);

    return {
      ok: true as const,
      template,
      overview,
      snapshots: snaps ?? [],
    };
  });

export const updateProjectOverviewSettings = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        project_id: z.string().uuid(),
        refresh_cadence: z.enum(["off", "daily", "every_6h", "weekly"]).optional(),
        sections_override: z
          .array(
            z.object({
              key: z.string().min(1).max(40),
              label: z.string().min(1).max(80),
              icon: z.string().max(8).default("📌"),
              prompt: z.string().min(1).max(2000),
              sort_order: z.number().int(),
            }),
          )
          .nullable()
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await getUserIdFromRequest();
    if (!userId) return { error: "Please sign in again." };

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, workspace_id")
      .eq("id", data.project_id)
      .maybeSingle();
    if (!project) return { error: "Project not found." };

    const { data: membership } = await supabaseAdmin
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return { error: "Not a workspace member." };

    await ensureProjectOverview(project.workspace_id, project.id);

    const patch: Record<string, unknown> = {};
    if (data.refresh_cadence) {
      patch.refresh_cadence = data.refresh_cadence;
      patch.next_refresh_at =
        nextRefreshAt(data.refresh_cadence)?.toISOString() ?? null;
    }
    if (data.sections_override !== undefined) {
      patch.sections_override = data.sections_override;
    }

    const { error } = await supabaseAdmin
      .from("project_overviews" as never)
      .update(patch as never)
      .eq("project_id", project.id);
    if (error) return { error: error.message };
    return { ok: true as const };
  });

export const updateWorkspaceOverviewTemplate = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        sections: z.array(
          z.object({
            key: z.string().min(1).max(40),
            label: z.string().min(1).max(80),
            icon: z.string().max(8).default("📌"),
            prompt: z.string().min(1).max(2000),
            sort_order: z.number().int(),
          }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await getUserIdFromRequest();
    if (!userId) return { error: "Please sign in again." };

    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();
    if (!role) return { error: "Workspace owner only." };

    const { error } = await supabaseAdmin
      .from("workspace_overview_templates" as never)
      .upsert(
        {
          workspace_id: data.workspace_id,
          sections: data.sections,
        } as never,
        { onConflict: "workspace_id" },
      );
    if (error) return { error: error.message };
    return { ok: true as const };
  });

export const refreshProjectOverview = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromRequest();
    if (!userId) return { error: "Please sign in again." };

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, workspace_id")
      .eq("id", data.project_id)
      .maybeSingle();
    if (!project) return { error: "Project not found." };

    const { data: membership } = await supabaseAdmin
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return { error: "Not a workspace member." };

    return runRefresh(project.workspace_id, project.id, userId);
  });
