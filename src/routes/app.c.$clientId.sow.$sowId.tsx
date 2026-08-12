import { createFileRoute, redirect } from "@tanstack/react-router";

// Deprecated: SOW detail will move under /app/clients/$accountId. For now,
// redirect to the unified client page where the SOWs section lives.
export const Route = createFileRoute("/app/c/$clientId/sow/$sowId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/app/clients/$accountId",
      params: { accountId: params.clientId },
    });
  },
});
