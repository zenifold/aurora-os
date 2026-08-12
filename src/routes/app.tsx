import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUIStore } from "@/stores/ui-store";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppHeader } from "@/components/app/AppHeader";
import { PreferencesSync } from "@/components/app/PreferencesSync";
import { MobileTopBar } from "@/components/app/MobileTopBar";
import { MobileBottomNav } from "@/components/app/MobileBottomNav";
import { CreateFab } from "@/components/app/CreateFab";
import { Loader2 } from "lucide-react";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";
import { setupOfflineFlush } from "@/lib/offline-queue";

import { RouteErrorBoundary, RouteNotFound } from "@/components/app/RouteErrorBoundary";
import { RouteProgressBar } from "@/components/app/RouteProgressBar";
import { RouteTransition } from "@/components/app/RouteTransition";

// Heavy panels — only loaded when first opened. Trims ~3k LOC from the /app bundle.
const CommandPalette = lazy(() =>
  import("@/components/app/CommandPalette").then((m) => ({ default: m.CommandPalette })),
);
const MobileDrawer = lazy(() =>
  import("@/components/app/MobileDrawer").then((m) => ({ default: m.MobileDrawer })),
);
const QuickCaptureSheet = lazy(() =>
  import("@/components/app/QuickCaptureSheet").then((m) => ({ default: m.QuickCaptureSheet })),
);
const QuickCreate = lazy(() =>
  import("@/components/app/QuickCreate").then((m) => ({ default: m.QuickCreate })),
);
const AuraAssistantPanel = lazy(() =>
  import("@/components/app/AuraAssistantPanel").then((m) => ({ default: m.AuraAssistantPanel })),
);
const HelpPanel = lazy(() =>
  import("@/components/app/HelpPanel").then((m) => ({ default: m.HelpPanel })),
);
const ShortcutsDialog = lazy(() =>
  import("@/components/app/ShortcutsDialog").then((m) => ({ default: m.ShortcutsDialog })),
);
const WelcomeTour = lazy(() =>
  import("@/components/app/WelcomeTour").then((m) => ({ default: m.WelcomeTour })),
);

export const Route = createFileRoute("/app")({
  component: AppLayout,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound />,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchWs = useWorkspaceStore((s) => s.fetch);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const wsLoading = useWorkspaceStore((s) => s.loading);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const setQuickCreateOpen = useUIStore((s) => s.setQuickCreateOpen);
  const setHelpOpen = useUIStore((s) => s.setHelpOpen);
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);
  useWorkspaceRealtime();
  const currentWs = useWorkspaceStore((s) => s.current);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Keep last_active_at fresh (every 5 min while in the workspace)
  useEffect(() => {
    if (!currentWs?.id) return;
    const ping = () => {
      void import("@/integrations/supabase/client").then(({ supabase }) =>
        supabase.rpc("touch_last_active" as never, { _workspace_id: currentWs.id } as never),
      );
    };
    ping();
    const id = window.setInterval(ping, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [currentWs?.id]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    fetchWs().finally(() => setBootstrapped(true));
  }, [user, loading, fetchWs, navigate]);

  // Redirect to onboarding if no workspaces
  useEffect(() => {
    if (bootstrapped && !wsLoading && user && workspaces.length === 0) {
      navigate({ to: "/onboarding" });
    }
  }, [bootstrapped, wsLoading, workspaces.length, user, navigate]);

  // Offline queue flush
  useEffect(() => {
    setupOfflineFlush();
  }, []);

  // Cmd+K / Cmd+N / ? + g-prefix navigation (Linear/GitHub style)
  const setAuraOpen = useUIStore((s) => s.setAuraOpen);
  const auraOpen = useUIStore((s) => s.auraOpen);
  useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;
    const GO: Record<string, string> = {
      h: "/app",
      t: "/app/my-tasks",
      c: "/app/clients",
      l: "/app/clients",
      i: "/app/inbox",
      n: "/app/notes",
      m: "/app/meetings",
      a: "/app/agent-runs",
      b: "/app/notifications",
      s: "/app/settings",
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement | null)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n" && !inEditable) {
        e.preventDefault();
        setQuickCreateOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAuraOpen(!auraOpen);
      } else if (e.key === "?" && !inEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setHelpOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (!inEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key.toLowerCase() === "g" && !gPressed) {
          gPressed = true;
          if (gTimer) clearTimeout(gTimer);
          gTimer = setTimeout(() => {
            gPressed = false;
          }, 1200);
          return;
        }
        if (gPressed) {
          const target = GO[e.key.toLowerCase()];
          gPressed = false;
          if (gTimer) clearTimeout(gTimer);
          if (target) {
            e.preventDefault();
            navigate({ to: target as never });
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [setCommandOpen, setQuickCreateOpen, setHelpOpen, setShortcutsOpen, setAuraOpen, auraOpen, navigate]);


  if (loading || !user || !bootstrapped || workspaces.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <RouteProgressBar />
      <PreferencesSync />
      {/* Desktop sidebar — hidden under lg */}
      <div className="hidden lg:flex">
        <AppSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop header */}
        <div className="hidden lg:block">
          <AppHeader />
        </div>
        {/* Mobile top bar (sticky, auto-hide) */}
        <MobileTopBar />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
          <RouteTransition>
            <Outlet />
          </RouteTransition>
        </main>
        {/* Mobile bottom nav */}
        <MobileBottomNav />
      </div>
      <LazyPanels />
      <CreateFab />
    </div>
  );
}

/**
 * Renders heavy overlay panels only when their `open` flag is true.
 * Each panel is code-split via React.lazy + Suspense, so the JS does not
 * even download until first use — keeping route transitions snappy.
 *
 * WelcomeTour has internal "should I show?" logic — we mount it on idle
 * so it never blocks the first paint of a route.
 */
function LazyPanels() {
  const commandOpen = useUIStore((s) => s.commandOpen);
  const mobileDrawerOpen = useUIStore((s) => s.mobileDrawerOpen);
  const quickCaptureOpen = useUIStore((s) => s.quickCaptureOpen);
  const quickCreateOpen = useUIStore((s) => s.quickCreateOpen);
  const auraOpen = useUIStore((s) => s.auraOpen);
  const helpOpen = useUIStore((s) => s.helpOpen);
  const shortcutsOpen = useUIStore((s) => s.shortcutsOpen);

  const [welcomeReady, setWelcomeReady] = useState(false);
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
    };
    const idle = w.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    const id = idle(() => setWelcomeReady(true));
    return () => {
      const cancel =
        (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback ??
        window.clearTimeout;
      cancel(id as number);
    };
  }, []);

  return (
    <Suspense fallback={null}>
      {commandOpen && <CommandPalette />}
      {mobileDrawerOpen && <MobileDrawer />}
      {quickCaptureOpen && <QuickCaptureSheet />}
      {quickCreateOpen && <QuickCreate />}
      {auraOpen && <AuraAssistantPanel />}
      {helpOpen && <HelpPanel />}
      {shortcutsOpen && <ShortcutsDialog />}
      {welcomeReady && <WelcomeTour />}
    </Suspense>
  );
}
