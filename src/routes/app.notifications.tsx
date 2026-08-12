import { createFileRoute, Navigate } from "@tanstack/react-router";

// Notifications have been unified into the Inbox.
// Keep this route as a permanent redirect for old links / bookmarks.
export const Route = createFileRoute("/app/notifications")({
  component: () => <Navigate to="/app/inbox" replace />,
});
