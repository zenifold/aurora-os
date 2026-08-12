import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPortalAccess, logPortalActivity } from "@/server/portal-access.server";

const ChangeRequestSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(4000),
  urgency: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  impact_areas: z.array(z.enum(["scope", "timeline", "cost", "quality"])).max(4).default([]),
});

export const Route = createFileRoute("/api/public/portal/$token/change-requests")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });

        const { data, error } = await supabaseAdmin
          .from("change_requests")
          .select(
            "id,title,description,urgency,impact_areas,status,estimated_cost,estimated_days,review_notes,reviewed_at,created_at",
          )
          .eq("project_id", access.project_id)
          .eq("client_portal_access_id", access.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) return new Response(error.message, { status: 500 });
        return Response.json(data ?? []);
      },
      POST: async ({ params, request }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = ChangeRequestSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
          .from("change_requests")
          .insert({
            workspace_id: access.workspace_id,
            project_id: access.project_id,
            client_portal_access_id: access.id,
            title: parsed.data.title,
            description: parsed.data.description,
            urgency: parsed.data.urgency,
            impact_areas: parsed.data.impact_areas,
            submitted_by_name: access.name,
            submitted_by_email: access.email,
            status: "submitted",
          })
          .select(
            "id,title,description,urgency,impact_areas,status,estimated_cost,estimated_days,review_notes,reviewed_at,created_at",
          )
          .single();

        if (error || !data) {
          return new Response(error?.message ?? "Failed", { status: 500 });
        }

        await logPortalActivity(access, "commented", {
          kind: "change_request",
          change_request_id: data.id,
        });
        return Response.json(data);
      },
    },
  },
});
