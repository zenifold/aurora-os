import { createFileRoute } from "@tanstack/react-router";
import { processDueScheduledTriggers } from "@/server/agents.functions";

export const Route = createFileRoute("/api/public/hooks/agent-triggers/run")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await processDueScheduledTriggers({ data: {} });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Failed" },
            { status: 500 },
          );
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to run" }),
    },
  },
});
