import { useAuth } from "@/lib/auth-context";
import { useUIStore } from "@/stores/ui-store";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, LogOut, Settings, User as UserIcon, PanelLeft, Plus, ChevronRight, HelpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { ChatHeaderButton } from "@/components/app/ChatHeaderButton";
import { StatusMenu } from "@/components/app/StatusMenu";
import { AgentBar } from "@/components/app/AgentBar";
import { AppLauncher } from "@/components/app/AppLauncher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useProjects } from "@/hooks/use-projects";

import { useWorkspaceStore } from "@/stores/workspace-store";

type Crumb = { label: string; to?: string };

function useBreadcrumb(): Crumb[] {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const ws = useWorkspaceStore((s) => s.current);
  const { data: projects = [] } = useProjects();

  return useMemo<Crumb[]>(() => {
    const crumbs: Crumb[] = [{ label: ws?.name ?? "Workspace", to: "/app" }];

    // /app/p/:id/...
    const proj = path.match(/^\/app\/p\/([^/]+)(?:\/([^/]+))?/);
    if (proj) {
      const p = projects.find((x) => x.id === proj[1]);
      if (p) {
        crumbs.push({ label: p.name, to: `/app/p/${p.id}` });
        if (proj[2]) crumbs.push({ label: humanize(proj[2]) });
      }
      return crumbs;
    }

    const sub = path.match(/^\/app\/([^/]+)(?:\/([^/]+))?/);
    if (sub) {
      crumbs.push({ label: humanize(sub[1]) });
      if (sub[2]) crumbs.push({ label: humanize(sub[2]) });
    }
    return crumbs;
  }, [path, ws?.name, projects]);
}


function humanize(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AppHeader() {
  const { user, signOut } = useAuth();
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const setQuickCreateOpen = useUIStore((s) => s.setQuickCreateOpen);
  const setHelpOpen = useUIStore((s) => s.setHelpOpen);
  const setAuraOpen = useUIStore((s) => s.setAuraOpen);

  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const navigate = useNavigate();
  const crumbs = useBreadcrumb();

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();


  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <PanelLeft className="h-4 w-4" />
      </Button>

      {/* Breadcrumb */}
      <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label="Breadcrumb">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
              {c.to && !last ? (
                <Link
                  to={c.to}
                  className="truncate text-muted-foreground hover:text-foreground"
                >
                  {c.label}
                </Link>
              ) : (
                <span className={last ? "truncate font-medium text-foreground" : "truncate text-muted-foreground"}>
                  {c.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      <div className="flex flex-1 items-center justify-center px-3">
        <AgentBar />
      </div>

      {/* Search trigger (icon only) */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setCommandOpen(true)}
        aria-label="Search"
        title="Search"
      >
        <Search className="h-4 w-4" />
      </Button>

      {/* Quick Create */}
      <Button
        data-tour="create"
        onClick={() => setQuickCreateOpen(true)}
        size="sm"
        className="h-8 gap-1.5 bg-aura-gradient px-2.5 text-xs text-primary-foreground hover:opacity-90"
        title="Quick create"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Create</span>
      </Button>

      {/* Aura AI panel chip — opens right-side panel, page-aware */}
      <button
        data-tour="aura-ai"
        type="button"
        onClick={() => setAuraOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2 text-xs font-medium text-foreground/80 transition hover:bg-sidebar-accent/60 hover:text-foreground"
        title="Aura AI"
      >
        <Sparkles className="h-3.5 w-3.5 text-aura-purple" />
        <span className="hidden md:inline">Aura AI</span>
      </button>



      <StatusMenu />
      <ChatHeaderButton />
      <NotificationsBell />
      <AppLauncher />
      <ThemeToggle />

      {/* Page-aware help */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setHelpOpen(true)}
        aria-label="Help for this page"
        title="Help (?)"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center" aria-label="Account">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-aura-gradient text-xs text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/app/settings/profile" })}>
            <UserIcon className="mr-2 h-4 w-4" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/app/settings" })}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
