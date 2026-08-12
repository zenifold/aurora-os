import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPortalAccess, logPortalActivity } from "@/server/portal-access.server";

const submitSchema = z.object({
  form_id: z.string().uuid(),
  respondent_name: z.string().min(1).max(200).optional(),
  respondent_email: z.string().email().max(320).optional(),
  answers: z.record(z.string(), z.unknown()),
});

export const Route = createFileRoute("/api/public/portal/$token/forms")({
  server: {
    handlers: {
      // GET: list published, client-visible forms for this portal
      GET: async ({ params }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });

        const { data: forms, error } = await supabaseAdmin
          .from("intake_forms")
          .select("id, title, description, fields, status, visibility, updated_at")
          .eq("project_id", access.project_id)
          .eq("status", "published")
          .in("visibility", ["client", "both"])
          .order("updated_at", { ascending: false });

        if (error) return new Response(error.message, { status: 500 });

        const { data: submitted } = await supabaseAdmin
          .from("intake_form_responses")
          .select("form_id")
          .eq("project_id", access.project_id)
          .eq("client_portal_access_id", access.id);

        const submittedIds = new Set((submitted ?? []).map((r) => r.form_id));
        return Response.json({
          forms: (forms ?? []).map((f) => ({ ...f, submitted: submittedIds.has(f.id) })),
        });
      },

      // POST: submit a response
      POST: async ({ request, params }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid body", { status: 400 });
        }
        const parsed = submitSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.message }), { status: 400 });
        }

        // Confirm the form exists, is published, client visible, and belongs to this project
        const { data: form } = await supabaseAdmin
          .from("intake_forms")
          .select("id, project_id, workspace_id, status, visibility")
          .eq("id", parsed.data.form_id)
          .eq("project_id", access.project_id)
          .maybeSingle();
        if (!form || form.status !== "published" || form.visibility === "internal") {
          return new Response("Form not available", { status: 404 });
        }

        const { error } = await supabaseAdmin.from("intake_form_responses").insert({
          workspace_id: form.workspace_id,
          project_id: form.project_id,
          form_id: form.id,
          client_portal_access_id: access.id,
          respondent_name: parsed.data.respondent_name ?? null,
          respondent_email: parsed.data.respondent_email ?? null,
          answers: parsed.data.answers as never,
        });
        if (error) return new Response(error.message, { status: 500 });

        await logPortalActivity(access, "completed_deliverable", {
          kind: "intake_form",
          form_id: form.id,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
