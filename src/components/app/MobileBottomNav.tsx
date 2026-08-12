import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Inbox, Plus, Folder, MoreHorizontal } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { haptic } from "@/lib/haptics";

type LinkTab = {
  kind: "link";
  to: "/app" | "/app/my-tasks" | "/app/settings";
  label: string;
  icon: typeof Home;
  exact: boolean;
};
type ActionTab = { kind: "fab" | "drawer"; label: string; icon: typeof Plus };
type Tab = LinkTab | ActionTab;

const TABS: Tab[] = [
  { kind: "link", to: "/app", label: "Home", icon: Home, exact: true },
  { kind: "link", to: "/app/my-tasks", label: "Work", icon: Inbox, exact: true },
  { kind: "fab", label: "Create", icon: Plus },
  { kind: "drawer", label: "Projects", icon: Folder },
  { kind: "link", to: "/app/settings", label: "More", icon: MoreHorizontal, exact: false },
];

export function MobileBottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const setQuickCaptureOpen = useUIStore((s) => s.setQuickCaptureOpen);
  const setMobileDrawerOpen = useUIStore((s) => s.setMobileDrawerOpen);

  const isActive = (to: string, exact: boolean) =>
    exact ? path === to : path.startsWith(to);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-safe backdrop-blur lg:hidden"
    >
      <ul className="flex h-16 items-stretch justify-around px-2">
        {TABS.map((tab, i) => {
          const Icon = tab.icon;

          if (tab.kind === "fab") {
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

          if (tab.kind === "drawer") {
            return (
              <li key={i} className="flex flex-1 items-stretch">
                <button
                  type="button"
                  onClick={() => {
                    haptic("tap");
                    setMobileDrawerOpen(true);
                  }}
                  className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              </li>
            );
          }

          const linkTab = tab as LinkTab;
          const active = isActive(linkTab.to, linkTab.exact);
          return (
            <li key={i} className="flex flex-1 items-stretch">
              <Link
                to={linkTab.to}
                onClick={() => haptic("tap")}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-aura-gradient" />
                )}
                <Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className={active ? "font-medium" : ""}>{linkTab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
