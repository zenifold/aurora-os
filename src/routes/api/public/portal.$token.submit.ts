import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/portal/$token/submit")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { data: access } = await supabaseAdmin
          .from("client_portal_access")
          .select("*")
          .eq("access_token", params.token)
          .eq("is_active", true)
          .maybeSingle();
        if (!access) return new Response("Not found", { status: 404 });
        if (access.role === "viewer") {
          return new Response("Read-only access", { status: 403 });
        }

        const body = (await request.json()) as {
          deliverable_id: string;
          decision?: string;
          comments?: string;
        };

        const { data: existing } = await supabaseAdmin
          .from("client_deliverables")
          .select("id, project_id, workspace_id, review_status, revision_count")
          .eq("id", body.deliverable_id)
          .eq("project_id", access.project_id)
          .maybeSingle();
        if (!existing) return new Response("Not found", { status: 404 });

        const isResubmit = existing.review_status === "needs_revision";

        const { error } = await supabaseAdmin
          .from("client_deliverables")
          .update({
            submitted_at: new Date().toISOString(),
            submitted_by: access.id,
            submitted_content: {
              decision: body.decision ?? null,
              comments: body.comments ?? null,
            },
            review_status: "submitted",
            revision_count: isResubmit
              ? (existing.revision_count ?? 0) + 1
              : existing.revision_count ?? 0,
          })
          .eq("id", body.deliverable_id);
        if (error) return new Response(error.message, { status: 500 });

        await supabaseAdmin.from("portal_activity_log").insert({
          workspace_id: existing.workspace_id,
          project_id: existing.project_id,
          client_portal_access_id: access.id,
          activity_type: "completed_deliverable",
          metadata: { deliverable_id: body.deliverable_id },
        });

        return Response.json({ ok: true });
      },
    },
  },
});
