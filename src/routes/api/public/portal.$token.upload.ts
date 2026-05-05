import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/portal/$token/upload")({
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

        const form = await request.formData();
        const file = form.get("file");
        const deliverableId = form.get("deliverable_id");
        if (!(file instanceof File) || typeof deliverableId !== "string") {
          return new Response("Invalid form", { status: 400 });
        }
        if (file.size > 25 * 1024 * 1024) {
          return new Response("File too large (max 25MB)", { status: 413 });
        }

        // Verify deliverable belongs to this project
        const { data: deliverable } = await supabaseAdmin
          .from("client_deliverables")
          .select("id, project_id, workspace_id, submitted_content")
          .eq("id", deliverableId)
          .eq("project_id", access.project_id)
          .maybeSingle();
        if (!deliverable) return new Response("Not found", { status: 404 });

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${access.workspace_id}/${access.project_id}/${deliverableId}/${Date.now()}-${safeName}`;
        const buffer = new Uint8Array(await file.arrayBuffer());

        const { error: upErr } = await supabaseAdmin.storage
          .from("client-deliverables")
          .upload(path, buffer, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (upErr) return new Response(upErr.message, { status: 500 });

        const existingContent = (deliverable.submitted_content ?? {}) as {
          files?: Array<{ path: string; name: string; size: number; type: string }>;
        };
        const files = existingContent.files ?? [];
        files.push({ path, name: file.name, size: file.size, type: file.type });

        const { error: updErr } = await supabaseAdmin
          .from("client_deliverables")
          .update({
            submitted_content: { ...existingContent, files },
          })
          .eq("id", deliverableId);
        if (updErr) return new Response(updErr.message, { status: 500 });

        await supabaseAdmin.from("portal_activity_log").insert({
          workspace_id: deliverable.workspace_id,
          project_id: deliverable.project_id,
          client_portal_access_id: access.id,
          activity_type: "uploaded_file",
          metadata: { deliverable_id: deliverableId, path, name: file.name },
        });

        return Response.json({ ok: true, path, name: file.name });
      },
    },
  },
});
