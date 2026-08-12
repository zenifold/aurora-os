import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPortalAccess, logPortalActivity } from "@/server/portal-access.server";

export const Route = createFileRoute("/api/public/portal/$token/download")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });

        const url = new URL(request.url);
        const path = url.searchParams.get("path");
        if (!path) return new Response("Missing path", { status: 400 });

        // Path must start with this client's workspace+project namespace
        const expectedPrefix = `${access.workspace_id}/${access.project_id}/`;
        if (!path.startsWith(expectedPrefix)) {
          return new Response("Forbidden", { status: 403 });
        }

        const { data, error } = await supabaseAdmin.storage
          .from("client-deliverables")
          .createSignedUrl(path, 60 * 5);
        if (error || !data) return new Response(error?.message ?? "Failed", { status: 500 });

        await logPortalActivity(access, "downloaded_file", { path });
        return Response.json({ url: data.signedUrl });
      },
    },
  },
});
