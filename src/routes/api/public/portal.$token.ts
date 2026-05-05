import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/portal/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        const { data: access, error } = await supabaseAdmin
          .from("client_portal_access")
          .select("*")
          .eq("access_token", token)
          .eq("is_active", true)
          .maybeSingle();
        if (error || !access) {
          return new Response("Not found", { status: 404 });
        }
        const { data: project, error: pErr } = await supabaseAdmin
          .from("projects")
          .select("id,name,color,description")
          .eq("id", access.project_id)
          .maybeSingle();
        if (pErr || !project) return new Response("Not found", { status: 404 });

        // Best-effort log
        await supabaseAdmin.from("portal_activity_log").insert({
          workspace_id: access.workspace_id,
          project_id: access.project_id,
          client_portal_access_id: access.id,
          activity_type: "login",
          metadata: {},
        });
        await supabaseAdmin
          .from("client_portal_access")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", access.id);

        return Response.json({ access, project });
      },
    },
  },
});
