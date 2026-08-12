/**
 * Public portal endpoint for clients to submit a CSAT response.
 * No auth — gated by the portal access token.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPortalAccess, logPortalActivity } from "@/server/portal-access.server";

const Body = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
  milestone_id: z.string().uuid().optional().nullable(),
  status_update_id: z.string().uuid().optional().nullable(),
});

export const Route = createFileRoute("/api/public/portal/$token/csat")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });

        let parsed: z.infer<typeof Body>;
        try {
          parsed = Body.parse(await request.json());
        } catch (e) {
          return new Response(
            JSON.stringify({ error: (e as Error).message }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Validate that referenced milestone/status update belongs to this project
        if (parsed.milestone_id) {
          const { data: m } = await supabaseAdmin
            .from("milestones")
            .select("id")
            .eq("id", parsed.milestone_id)
            .eq("project_id", access.project_id)
            .maybeSingle();
          if (!m) return new Response("Invalid milestone", { status: 400 });
        }
        if (parsed.status_update_id) {
          const { data: s } = await supabaseAdmin
            .from("project_status_updates" as never)
            .select("id")
            .eq("id", parsed.status_update_id)
            .eq("project_id", access.project_id)
            .maybeSingle();
          if (!s) return new Response("Invalid status update", { status: 400 });
        }

        const { error } = await supabaseAdmin.from("csat_responses" as never).insert({
          workspace_id: access.workspace_id,
          project_id: access.project_id,
          milestone_id: parsed.milestone_id ?? null,
          status_update_id: parsed.status_update_id ?? null,
          client_portal_access_id: access.id,
          respondent_name: access.name,
          respondent_email: access.email,
          score: parsed.score,
          comment: parsed.comment ?? null,
          source: "portal",
        } as never);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        await logPortalActivity(access, "commented", {
          kind: "csat",
          score: parsed.score,
          milestone_id: parsed.milestone_id ?? null,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
