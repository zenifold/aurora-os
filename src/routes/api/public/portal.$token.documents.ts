import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPortalAccess, logPortalActivity } from "@/server/portal-access.server";

export const Route = createFileRoute("/api/public/portal/$token/documents")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });
        if (!access.can_see_documents) {
          return new Response("Forbidden", { status: 403 });
        }

        const { data, error } = await supabaseAdmin
          .from("project_documents")
          .select(
            "id,name,description,document_type,file_size_bytes,mime_type,version,signature_status,signed_at,effective_date,expiration_date,contract_value,currency,created_at",
          )
          .eq("project_id", access.project_id)
          .in("visibility", ["client", "shared"])
          .order("created_at", { ascending: false });

        if (error) return new Response(error.message, { status: 500 });
        return Response.json(data ?? []);
      },
      POST: async ({ params, request }) => {
        // Signed download URL for a specific document
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });
        if (!access.can_see_documents) {
          return new Response("Forbidden", { status: 403 });
        }

        const body = (await request.json()) as { document_id?: string };
        if (!body.document_id) return new Response("Missing document_id", { status: 400 });

        const { data: doc } = await supabaseAdmin
          .from("project_documents")
          .select("id,file_path,visibility,project_id,name")
          .eq("id", body.document_id)
          .maybeSingle();

        if (
          !doc ||
          doc.project_id !== access.project_id ||
          !["client", "shared"].includes(doc.visibility)
        ) {
          return new Response("Not found", { status: 404 });
        }

        const { data: signed, error } = await supabaseAdmin.storage
          .from("project-documents")
          .createSignedUrl(doc.file_path, 60 * 5);

        if (error || !signed) {
          return new Response(error?.message ?? "Failed", { status: 500 });
        }

        await logPortalActivity(access, "downloaded_file", {
          document_id: doc.id,
          name: doc.name,
        });
        return Response.json({ url: signed.signedUrl });
      },
    },
  },
});
