import { createFileRoute, Navigate } from "@tanstack/react-router";

// Folders/Spaces have been removed — the client folder is the single source of truth.
// Keep the route registered so old bookmarks redirect cleanly to the client list
// instead of 404'ing.
export const Route = createFileRoute("/app/f/$folderId")({
  component: () => <Navigate to="/app/clients" />,
});
