import { createFileRoute, redirect } from "@tanstack/react-router";

// Deprecated: Contacts are managed per-account inside the Clients hub.
// Open a client to see and edit its contacts.
export const Route = createFileRoute("/app/contacts")({
  beforeLoad: () => {
    throw redirect({ to: "/app/clients" });
  },
});
