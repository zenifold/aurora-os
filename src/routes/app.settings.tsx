import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Settings, Users, Sliders, User, Database, AlertTriangle, Sparkles, Zap, UserCog, FolderTree, LayoutDashboard, ScrollText, AlertCircle, DollarSign, Rocket, Boxes, Eye, Keyboard, LayoutTemplate, Type, Workflow, Shield, Share2, Plug } from "lucide-react";
import { useHasRole, type WorkspaceRole } from "@/components/app/RoleGuard";

export const Route = createFileRoute("/app/settings")({
  component: SettingsLayout,
});

const items: ReadonlyArray<{
  to: string;
  label: string;
  icon: typeof Settings;
  exact: boolean;
  minRole: WorkspaceRole;
}> = [
  { to: "/app/settings", label: "Workspace", icon: Settings, exact: true, minRole: "manager" },
  { to: "/app/settings/vocabulary", label: "Vocabulary", icon: Type, exact: false, minRole: "manager" },
  { to: "/app/settings/sections", label: "Sections", icon: FolderTree, exact: false, minRole: "manager" },
  { to: "/app/settings/members", label: "Members", icon: Users, exact: false, minRole: "manager" },
  { to: "/app/settings/roles", label: "Roles & permissions", icon: Shield, exact: false, minRole: "manager" },
  { to: "/app/settings/resources", label: "Resources", icon: UserCog, exact: false, minRole: "manager" },
  { to: "/app/settings/rate-cards", label: "Rate cards", icon: DollarSign, exact: false, minRole: "manager" },
  { to: "/app/settings/sales-stages", label: "Sales stages", icon: Workflow, exact: false, minRole: "manager" },
  { to: "/app/settings/object-types", label: "Object types", icon: Boxes, exact: false, minRole: "manager" },
  { to: "/app/settings/fields", label: "Custom fields", icon: Sliders, exact: false, minRole: "manager" },
  { to: "/app/settings/views", label: "Saved views", icon: Eye, exact: false, minRole: "member" },
  { to: "/app/settings/overview", label: "Overview templates", icon: LayoutDashboard, exact: false, minRole: "manager" },
  { to: "/app/settings/playbooks", label: "Playbooks", icon: Rocket, exact: false, minRole: "manager" },
  { to: "/app/settings/templates", label: "Project templates", icon: LayoutTemplate, exact: false, minRole: "manager" },
  { to: "/app/settings/ai", label: "AI agents", icon: Sparkles, exact: false, minRole: "manager" },
  { to: "/app/settings/automations", label: "Automations", icon: Zap, exact: false, minRole: "manager" },
  { to: "/app/settings/integrations", label: "Integrations", icon: Plug, exact: false, minRole: "member" },
  { to: "/app/settings/sharing", label: "External sharing", icon: Share2, exact: false, minRole: "manager" },
  { to: "/app/settings/audit", label: "Audit log", icon: ScrollText, exact: false, minRole: "manager" },
  { to: "/app/settings/errors", label: "Error reports", icon: AlertCircle, exact: false, minRole: "owner" },
  { to: "/app/settings/data", label: "Data & privacy", icon: Database, exact: false, minRole: "owner" },
  { to: "/app/settings/profile", label: "Account", icon: User, exact: false, minRole: "member" },
  { to: "/app/settings/shortcuts", label: "Keyboard shortcuts", icon: Keyboard, exact: false, minRole: "member" },

  { to: "/app/settings/danger", label: "Danger zone", icon: AlertTriangle, exact: false, minRole: "owner" },
];

const RANK: Record<WorkspaceRole, number> = { member: 0, manager: 1, owner: 2 };

function SettingsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { role } = useHasRole("member");
  const visibleItems = items.filter((it) => RANK[role] >= RANK[it.minRole]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your workspace and account.</p>
      </div>
      {/* Mobile horizontal tab rail */}
      <div className="-mx-4 mb-4 flex items-center gap-1 overflow-x-auto whitespace-nowrap px-4 no-scrollbar lg:hidden">
        {visibleItems.map((it) => {
          const active = it.exact ? path === it.to : path.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "border-transparent bg-aura-gradient text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <it.icon className="h-3.5 w-3.5" /> {it.label}
            </Link>
          );
        })}
      </div>
      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-6 space-y-0.5 max-h-[calc(100vh-3rem)] overflow-y-auto pr-2">

            {visibleItems.map((it) => {
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
