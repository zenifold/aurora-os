import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPortalAccess } from "@/server/portal-access.server";

export const Route = createFileRoute("/api/public/portal/$token/overview")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });

        const [{ data: workspace }, { data: milestones }, { data: tasks }] = await Promise.all([
          supabaseAdmin
            .from("workspaces")
            .select("id, name, branding")
            .eq("id", access.workspace_id)
            .maybeSingle(),
          supabaseAdmin
            .from("milestones")
            .select(
              "id, name, status, target_date, actual_date, order_index, requires_signoff, signoff_status, signoff_requested_at, signoff_signed_at, signoff_signed_name, signoff_rejection_reason",
            )
            .eq("project_id", access.project_id)
            .order("order_index", { ascending: true }),
          supabaseAdmin
            .from("tasks")
            .select("id, status")
            .eq("project_id", access.project_id),
        ]);

        const total = tasks?.length ?? 0;
        const done = (tasks ?? []).filter((t) => t.status === "done").length;
        const inProgress = (tasks ?? []).filter((t) => t.status === "in_progress").length;

        return Response.json({
          workspace: workspace
            ? { id: workspace.id, name: workspace.name, branding: workspace.branding ?? {} }
            : null,
          milestones: access.can_see_timeline ? (milestones ?? []) : [],
          progress: {
            total,
            done,
            in_progress: inProgress,
            percent: total > 0 ? Math.round((done / total) * 100) : 0,
          },
        });
      },
    },
  },
});
