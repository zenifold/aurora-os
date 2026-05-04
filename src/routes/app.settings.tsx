import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Settings, Users, Sliders, User, Database, AlertTriangle, Sparkles, Zap } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsLayout,
});

const items = [
  { to: "/app/settings", label: "Workspace", icon: Settings, exact: true },
  { to: "/app/settings/members", label: "Members", icon: Users, exact: false },
  { to: "/app/settings/fields", label: "Custom fields", icon: Sliders, exact: false },
  { to: "/app/settings/ai", label: "AI agents", icon: Sparkles, exact: false },
  { to: "/app/settings/automations", label: "Automations", icon: Zap, exact: false },
  { to: "/app/settings/data", label: "Data & privacy", icon: Database, exact: false },
  { to: "/app/settings/profile", label: "Account", icon: User, exact: false },
  { to: "/app/settings/danger", label: "Danger zone", icon: AlertTriangle, exact: false },
] as const;

function SettingsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your workspace and account.</p>
      </div>
      <div className="flex gap-8">
        <aside className="w-56 shrink-0">
          <nav className="space-y-0.5">
            {items.map((it) => {
              const active = it.exact ? path === it.to : path.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`flex items-center gap-2 rounded-lg border-l-2 px-2.5 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-l-transparent bg-aura-gradient-subtle font-medium [border-image:var(--gradient-aura)_1]"
                      : "border-l-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
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
    </div>
  );
}
