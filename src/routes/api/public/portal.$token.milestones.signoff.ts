import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPortalAccess, logPortalActivity } from "@/server/portal-access.server";

const BodySchema = z.object({
  milestone_id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  signed_name: z.string().min(1).max(200),
  signature_text: z.string().min(1).max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const Route = createFileRoute("/api/public/portal/$token/milestones/signoff")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch (e) {
          return new Response((e as Error).message, { status: 400 });
        }

        // Verify milestone belongs to this client's project + is awaiting signoff
        const { data: milestone, error: mErr } = await supabaseAdmin
          .from("milestones")
          .select("id, project_id, signoff_status, requires_signoff")
          .eq("id", body.milestone_id)
          .eq("project_id", access.project_id)
          .maybeSingle();
        if (mErr || !milestone) return new Response("Milestone not found", { status: 404 });
        if (milestone.signoff_status !== "requested") {
          return new Response("Milestone is not awaiting sign-off", { status: 409 });
        }

        const now = new Date().toISOString();
        const isApprove = body.action === "approve";

        const patch = isApprove
          ? {
              signoff_status: "approved" as const,
              signoff_signed_at: now,
              signoff_signed_by_portal_access_id: access.id,
              signoff_signed_name: body.signed_name,
              signoff_signature_text: body.signature_text ?? body.signed_name,
              signoff_notes: body.notes ?? null,
              signoff_rejection_reason: null,
            }
          : {
              signoff_status: "rejected" as const,
              signoff_signed_at: now,
              signoff_signed_by_portal_access_id: access.id,
              signoff_signed_name: body.signed_name,
              signoff_rejection_reason: body.notes ?? "Changes requested",
            };

        const { error: upErr } = await supabaseAdmin
          .from("milestones")
          .update(patch)
          .eq("id", milestone.id);
        if (upErr) return new Response(upErr.message, { status: 500 });

        await supabaseAdmin.from("milestone_signoffs").insert({
          workspace_id: access.workspace_id,
          project_id: access.project_id,
          milestone_id: milestone.id,
          action: isApprove ? "approved" : "rejected",
          client_portal_access_id: access.id,
          signed_name: body.signed_name,
          signature_text: body.signature_text ?? body.signed_name,
          notes: body.notes ?? null,
        });

        await logPortalActivity(access, "acknowledged_impact", {
          kind: "milestone_signoff",
          milestone_id: milestone.id,
          action: isApprove ? "approved" : "rejected",
        });

        return Response.json({ ok: true, status: patch.signoff_status });
      },
    },
  },
});
