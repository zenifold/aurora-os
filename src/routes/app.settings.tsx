import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Settings, Users, Sliders, User } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsLayout,
});

const items = [
  { to: "/app/settings", label: "Workspace", icon: Settings, exact: true },
  { to: "/app/settings/members", label: "Members", icon: Users, exact: false },
  { to: "/app/settings/fields", label: "Custom fields", icon: Sliders, exact: false },
  { to: "/app/settings/profile", label: "Profile", icon: User, exact: false },
] as const;

function SettingsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto flex w-full max-w-5xl gap-8 px-8 py-10">
      <aside className="w-56 shrink-0">
        <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Settings
        </h2>
        <nav className="space-y-1">
          {items.map((it) => {
            const active = it.exact ? path === it.to : path.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  active ? "bg-aura-gradient-subtle font-medium" : "hover:bg-accent"
                }`}
              >
                <it.icon className="h-4 w-4" /> {it.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
