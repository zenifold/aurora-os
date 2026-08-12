import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { processEventDispatch } from "@/server/agents.functions";

const Schema = z.object({
  log_id: z.string().uuid().optional(),
  workspace_id: z.string().uuid(),
  event_name: z.string().min(1).max(80),
  payload: z.record(z.string(), z.any()).default({}),
});

export const Route = createFileRoute("/api/public/hooks/agent-events/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const parsed = Schema.parse(body);
          const result = await processEventDispatch({ data: parsed });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Failed" },
            { status: 400 },
          );
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST {workspace_id, event_name, payload}" }),
    },
  },
});
