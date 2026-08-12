import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPortalAccess, logPortalActivity } from "@/server/portal-access.server";

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/", "text/"];
const ALLOWED_MIME_EXACT = new Set([
  "application/pdf",
  "application/zip",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/octet-stream",
]);

function isAllowed(type: string) {
  if (!type) return true;
  if (ALLOWED_MIME_EXACT.has(type)) return true;
  return ALLOWED_MIME_PREFIXES.some((p) => type.startsWith(p));
}

export const Route = createFileRoute("/api/public/portal/$token/upload")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const access = await loadPortalAccess(params.token);
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
        if (!isAllowed(file.type)) {
          return new Response("File type not allowed", { status: 415 });
        }

        const { data: deliverable } = await supabaseAdmin
          .from("client_deliverables")
          .select("id, project_id, workspace_id, submitted_content")
          .eq("id", deliverableId)
          .eq("project_id", access.project_id)
          .maybeSingle();
        if (!deliverable) return new Response("Not found", { status: 404 });

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
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
          .update({ submitted_content: { ...existingContent, files } as never })
          .eq("id", deliverableId);
        if (updErr) return new Response(updErr.message, { status: 500 });

        await logPortalActivity(access, "completed_deliverable", {
          deliverable_id: deliverableId,
          uploaded: file.name,
        });

        return Response.json({ ok: true, path, name: file.name });
      },
    },
  },
});
