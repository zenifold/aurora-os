import { createFileRoute } from "@tanstack/react-router";
import { runScheduledOverviewRefreshes } from "@/server/overview-refresh.server";

export const Route = createFileRoute("/api/public/hooks/refresh-overviews")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await runScheduledOverviewRefreshes(10);
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: (e as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
