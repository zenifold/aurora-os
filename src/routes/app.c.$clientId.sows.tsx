import { createFileRoute, redirect } from "@tanstack/react-router";

// Deprecated: SOWs are listed on the unified client detail page.
export const Route = createFileRoute("/app/c/$clientId/sows")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/app/clients/$accountId",
      params: { accountId: params.clientId },
    });
  },
});
