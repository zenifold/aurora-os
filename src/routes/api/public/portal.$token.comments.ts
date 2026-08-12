import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPortalAccess, logPortalActivity } from "@/server/portal-access.server";

export const Route = createFileRoute("/api/public/portal/$token/comments")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });
        const url = new URL(request.url);
        const deliverableId = url.searchParams.get("deliverable_id");
        if (!deliverableId) return new Response("Missing deliverable_id", { status: 400 });

        const { data: d } = await supabaseAdmin
          .from("client_deliverables")
          .select("id, project_id")
          .eq("id", deliverableId)
          .eq("project_id", access.project_id)
          .maybeSingle();
        if (!d) return new Response("Not found", { status: 404 });

        const { data: comments, error } = await supabaseAdmin
          .from("portal_deliverable_comments")
          .select("id, author_kind, author_name, body, created_at")
          .eq("deliverable_id", deliverableId)
          .order("created_at", { ascending: true });
        if (error) return new Response(error.message, { status: 500 });
        return Response.json(comments ?? []);
      },
      POST: async ({ params, request }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });
        if (access.role === "viewer") {
          return new Response("Read-only access", { status: 403 });
        }
        const body = (await request.json()) as { deliverable_id: string; body: string };
        if (!body.deliverable_id || !body.body?.trim()) {
          return new Response("Invalid", { status: 400 });
        }
        if (body.body.length > 4000) {
          return new Response("Comment too long", { status: 413 });
        }

        const { data: d } = await supabaseAdmin
          .from("client_deliverables")
          .select("id, project_id, workspace_id")
          .eq("id", body.deliverable_id)
          .eq("project_id", access.project_id)
          .maybeSingle();
        if (!d) return new Response("Not found", { status: 404 });

        const { error } = await supabaseAdmin
          .from("portal_deliverable_comments")
          .insert({
            workspace_id: d.workspace_id,
            project_id: d.project_id,
            deliverable_id: body.deliverable_id,
            author_kind: "client",
            author_portal_access_id: access.id,
            author_name: access.name,
            body: body.body.trim(),
          });
        if (error) return new Response(error.message, { status: 500 });

        await logPortalActivity(access, "commented", { deliverable_id: body.deliverable_id });
        return Response.json({ ok: true });
      },
    },
  },
});
