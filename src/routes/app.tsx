import { createFileRoute, Outlet, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUIStore } from "@/stores/ui-store";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppHeader } from "@/components/app/AppHeader";
import { CommandPalette } from "@/components/app/CommandPalette";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchWs = useWorkspaceStore((s) => s.fetch);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const wsLoading = useWorkspaceStore((s) => s.loading);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const [bootstrapped, setBootstrapped] = useState(false);

  const setTheme = useUIStore((s) => s.setTheme);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    fetchWs().finally(() => setBootstrapped(true));
    // Sync theme preference from profile
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          const pref = (data as { theme_preference?: "light" | "dark" | "system" } | null)?.theme_preference;
          if (pref) setTheme(pref);
        });
    });
  }, [user, loading, fetchWs, navigate, setTheme]);

  // Redirect to onboarding if no workspaces
  useEffect(() => {
    if (bootstrapped && !wsLoading && user && workspaces.length === 0) {
      navigate({ to: "/onboarding" });
    }
  }, [bootstrapped, wsLoading, workspaces.length, user, navigate]);

  // Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  if (loading || !user || !bootstrapped || workspaces.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
