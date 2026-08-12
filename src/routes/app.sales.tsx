import { createFileRoute, redirect } from "@tanstack/react-router";

// Deprecated: Sales pipeline has been folded into the Clients hub.
// Deals and pipeline now live as the Pre-sales / Won lifecycle tabs on /app/clients,
// and per-account on the client detail page.
export const Route = createFileRoute("/app/sales")({
  beforeLoad: () => {
    throw redirect({ to: "/app/clients", search: { lifecycle: "pre_sales" } });
  },
});
