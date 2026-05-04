import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Inbox, Plus, Folder, MoreHorizontal } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { haptic } from "@/lib/haptics";

const TABS = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/my-tasks", label: "Tasks", icon: Inbox, exact: true },
  { to: null, label: "Create", icon: Plus, exact: false }, // FAB-style center
  { to: "/app/projects", label: "Projects", icon: Folder, exact: false },
  { to: "/app/settings", label: "More", icon: MoreHorizontal, exact: false },
] as const;

export function MobileBottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const setQuickCaptureOpen = useUIStore((s) => s.setQuickCaptureOpen);

  const isActive = (to: string | null, exact: boolean) => {
    if (!to) return false;
    return exact ? path === to : path.startsWith(to);
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-safe backdrop-blur lg:hidden"
    >
      <ul className="flex h-16 items-stretch justify-around px-2">
        {TABS.map((tab, i) => {
          const Icon = tab.icon;
          const active = isActive(tab.to, tab.exact);

          if (tab.label === "Create") {
            return (
              <li key={i} className="flex items-center">
                <button
                  type="button"
                  aria-label="Quick capture"
                  onClick={() => {
                    haptic("tap");
                    setQuickCaptureOpen(true);
                  }}
                  className="flex h-12 w-12 -translate-y-2 items-center justify-center rounded-full bg-aura-gradient text-primary-foreground shadow-lg active:scale-95"
                >
                  <Icon className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </li>
            );
          }

          if (!tab.to) return null;

          return (
            <li key={i} className="flex flex-1 items-stretch">
              <Link
                to={tab.to}
                onClick={() => haptic("tap")}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "text-aura-gradient" : ""}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className={active ? "font-medium" : ""}>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
