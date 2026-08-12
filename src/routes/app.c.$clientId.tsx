import { createFileRoute, redirect } from "@tanstack/react-router";

// Canonical short URL for a client. Redirects to the unified client page.
// Long-term, the underlying route will move here; for now this keeps a
// stable shareable URL while implementation lives at /app/clients/$accountId.
export const Route = createFileRoute("/app/c/$clientId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/app/clients/$accountId",
      params: { accountId: params.clientId },
    });
  },
});
