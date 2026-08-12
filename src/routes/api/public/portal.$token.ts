import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPortalAccess, logPortalActivity } from "@/server/portal-access.server";

export const Route = createFileRoute("/api/public/portal/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });

        const { data: project, error: pErr } = await supabaseAdmin
          .from("projects")
          .select("id,name,color,description")
          .eq("id", access.project_id)
          .maybeSingle();
        if (pErr || !project) return new Response("Not found", { status: 404 });

        await logPortalActivity(access, "login");
        await supabaseAdmin
          .from("client_portal_access")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", access.id);

        return Response.json({ access, project });
      },
    },
  },
});
