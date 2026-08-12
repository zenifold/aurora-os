import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash } from "crypto";

// Weekly Monday job: for every active client account, assemble a short
// health brief and insert it as an `insight` ai_artifact (status='draft',
// trigger_source='scheduled'). The team sees it in the Drafts inbox.
// Triggered by pg_cron via apikey header; /api/public/* bypasses auth.

export const Route = createFileRoute("/api/public/hooks/weekly-client-briefs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data: accounts, error: accErr } = await supabaseAdmin
          .from("client_accounts")
          .select("id, workspace_id, name, status")
          .in("status", ["active", "prospect"]);
        if (accErr) {
          return Response.json({ ok: false, error: accErr.message }, { status: 500 });
        }

        let created = 0;
        const errors: string[] = [];
        const weekStart = new Date();
        weekStart.setUTCHours(0, 0, 0, 0);

        for (const a of accounts ?? []) {
          try {
            // Skip if a brief was already created this week
            const sinceIso = new Date(Date.now() - 6 * 86_400_000).toISOString();
            const { data: existing } = await supabaseAdmin
              .from("ai_artifacts")
              .select("id")
              .eq("client_account_id", a.id)
              .eq("kind", "insight")
              .eq("trigger_source", "scheduled")
              .gte("created_at", sinceIso)
              .limit(1);
            if (existing && existing.length > 0) continue;

            // Tiny context snapshot
            const [{ data: projects }, { data: pulse }, { data: recentEvents }] =
              await Promise.all([
                supabaseAdmin
                  .from("projects")
                  .select("id, name, phase, health, lifecycle, target_end_date")
                  .eq("client_account_id", a.id)
                  .eq("is_archived", false),
                supabaseAdmin
                  .from("client_portal_pulse")
                  .select("*")
                  .eq("client_account_id", a.id)
                  .maybeSingle(),
                supabaseAdmin
                  .from("portal_activity_log")
                  .select("activity_type, created_at, requires_response, responded_at")
                  .eq("client_account_id", a.id)
                  .gte("created_at", sinceIso)
                  .order("created_at", { ascending: false })
                  .limit(50),
              ]);

            const atRisk = (projects ?? []).filter(
              (p) => p.health === "red" || p.lifecycle === "at_risk",
            );
            const openResponse = (recentEvents ?? []).filter(
              (e) => e.requires_response && !e.responded_at,
            ).length;
            const totalEvents = (recentEvents ?? []).length;

            const summaryLines = [
              `Weekly brief — ${a.name}`,
              `Projects: ${(projects ?? []).length} (${atRisk.length} at-risk)`,
              `Portal events last 7d: ${totalEvents} (${openResponse} awaiting response)`,
              pulse?.engagement_score != null
                ? `Engagement score: ${Math.round(Number(pulse.engagement_score))}`
                : "Engagement score: n/a",
              atRisk.length
                ? `Watch: ${atRisk.map((p) => p.name).slice(0, 3).join(", ")}`
                : "No projects flagged.",
            ];
            const body = summaryLines.join("\n");

            const pack = {
              account: a,
              projects,
              pulse,
              recentEventsCount: totalEvents,
              awaitingResponse: openResponse,
              weekOf: weekStart.toISOString(),
            };
            const hash = createHash("sha256").update(JSON.stringify(pack)).digest("hex").slice(0, 32);

            const { error: insErr } = await supabaseAdmin.from("ai_artifacts").insert({
              workspace_id: a.workspace_id,
              client_account_id: a.id,
              kind: "insight",
              title: `Weekly brief — week of ${weekStart.toISOString().slice(0, 10)}`,
              status: "draft",
              content: { body } as never,
              content_raw: body,
              prompt: "Auto-generated weekly client health brief",
              prompt_pack: pack as never,
              prompt_pack_hash: hash,
              model_version: "scheduled-summary-v1",
              trigger_source: "scheduled",
              generation_metadata: { weekly: true, weekOf: weekStart.toISOString() } as never,
            });
            if (insErr) {
              errors.push(`${a.id}: ${insErr.message}`);
              continue;
            }
            created += 1;
          } catch (e) {
            errors.push(`${a.id}: ${e instanceof Error ? e.message : "unknown"}`);
          }
        }

        return Response.json({
          ok: true,
          accountsScanned: accounts?.length ?? 0,
          briefsCreated: created,
          errors: errors.slice(0, 20),
        });
      },
    },
  },
});
