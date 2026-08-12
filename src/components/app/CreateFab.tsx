import { useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";

/**
 * Mobile-only floating action button. Opens the unified QuickCreate sheet.
 * Desktop users access create via the header "+ Create" button or ⌘N.
 */
export function CreateFab() {
  const setQuickCreateOpen = useUIStore((s) => s.setQuickCreateOpen);
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Hide on Aura chat (would cover the send button).
  if (path.startsWith("/app/aura")) return null;

  return (
    <button
      onClick={() => setQuickCreateOpen(true)}
      aria-label="Create"
      className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-aura-gradient text-primary-foreground shadow-lg transition hover:scale-105 lg:hidden"
    >
      <Plus className="h-5 w-5" />
    </button>
  );
}
