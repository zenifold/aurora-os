import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPortalAccess, logPortalActivity } from "@/server/portal-access.server";

export const Route = createFileRoute("/api/public/portal/$token/submit")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const access = await loadPortalAccess(params.token);
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
          .select("id, project_id, workspace_id, review_status, revision_count, max_revisions, submitted_content")
          .eq("id", body.deliverable_id)
          .eq("project_id", access.project_id)
          .maybeSingle();
        if (!existing) return new Response("Not found", { status: 404 });

        const isResubmit = existing.review_status === "needs_revision";
        if (isResubmit && (existing.revision_count ?? 0) >= (existing.max_revisions ?? 3)) {
          return new Response("Revision limit reached", { status: 409 });
        }

        const prev = (existing.submitted_content ?? {}) as Record<string, unknown>;
        const { error } = await supabaseAdmin
          .from("client_deliverables")
          .update({
            submitted_at: new Date().toISOString(),
            submitted_by: access.id,
            submitted_content: {
              ...prev,
              decision: body.decision ?? null,
              comments: body.comments ?? null,
            } as never,
            review_status: "submitted",
            revision_count: isResubmit
              ? (existing.revision_count ?? 0) + 1
              : (existing.revision_count ?? 0),
          })
          .eq("id", body.deliverable_id);
        if (error) return new Response(error.message, { status: 500 });

        await logPortalActivity(access, "completed_deliverable", {
          deliverable_id: body.deliverable_id,
          decision: body.decision ?? null,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
