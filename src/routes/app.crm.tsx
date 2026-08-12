import { createFileRoute, redirect } from "@tanstack/react-router";

// Deprecated: CRM has been folded into the unified Clients hub.
// Account list, contacts, deals, and pipeline analytics all live under /app/clients.
export const Route = createFileRoute("/app/crm")({
  beforeLoad: () => {
    throw redirect({ to: "/app/clients" });
  },
});
