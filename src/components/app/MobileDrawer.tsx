import { Link, useNavigate } from "@tanstack/react-router";
import { useUIStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/use-profile";
import { useProjects } from "@/hooks/use-projects";

import { getSectionIcon } from "@/lib/section-icons";
import { isNavHiddenByMode } from "@/lib/workspace-mode-nav";
import { useClientContainers } from "@/hooks/use-containers";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ChevronsUpDown,
  Check,
  Folder,
  Inbox,
  Plus,
  Settings,
  CalendarDays,
  Bell,
  Sparkles,
  StickyNote,
  Mic,
  Search,
  FileText,
  Briefcase,
  Users,
  UsersRound,
  CalendarRange,
  LineChart,
  AlertTriangle,
} from "lucide-react";

export function MobileDrawer() {
  const open = useUIStore((s) => s.mobileDrawerOpen);
  const setOpen = useUIStore((s) => s.setMobileDrawerOpen);
  const ws = useWorkspaceStore((s) => s.current);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: projects = [] } = useProjects();
  const divisions: Array<{ id: string; name: string; slug: string; icon?: string | null; color?: string }> = [];
  const navigate = useNavigate();
  const clientContainers = useClientContainers();
  const hasAnyClient = clientContainers.length > 0;
  const mode = ws?.workspace_mode;
  const showCrm = (ws?.kind === "sales" || ws?.kind === "hybrid") && !isNavHiddenByMode("crm", mode, hasAnyClient);
  const showResources = !isNavHiddenByMode("resources", mode, hasAnyClient);
  const showCapacity = !isNavHiddenByMode("capacity", mode, hasAnyClient);
  const showExecutive = !isNavHiddenByMode("executive", mode, hasAnyClient);
  const showEscalations = !isNavHiddenByMode("escalations", mode, hasAnyClient);

  const close = () => setOpen(false);
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "You";
  const userInitials = (profile?.display_name || user?.email || "?").slice(0, 2).toUpperCase();
  const wsInitials = (ws?.name ?? "A").slice(0, 2).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="flex w-[85vw] max-w-[320px] flex-col gap-0 p-0 pt-safe"
      >
        {/* User mini-card with workspace switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 border-b border-border px-3 py-3 text-left transition-colors hover:bg-accent/50">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-aura-gradient text-xs font-semibold text-primary-foreground">
                {wsInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{ws?.name ?? "Workspace"}</p>
                <p className="truncate text-xs text-muted-foreground">{displayName}</p>
              </div>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => {
                  setCurrent(w);
                  close();
                }}
              >
                <span className="flex-1 truncate">{w.name}</span>
                {w.id === ws?.id && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                close();
                navigate({ to: "/onboarding" });
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2 border-b border-border px-3 py-3">
          <button
            onClick={() => {
              close();
              useUIStore.getState().setQuickCaptureOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-aura-gradient px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-pop active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4" /> Capture
          </button>
          <button
            onClick={() => {
              close();
              useUIStore.getState().setCommandOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium active:scale-[0.98]"
          >
            <Search className="h-4 w-4" /> Search
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Smart lists */}
          {/* Zone 1: Personal */}
          <nav className="space-y-0.5 px-2 py-3">
            <DrawerNav onNavigate={close} to="/app" icon={CalendarDays} label="Home" />
            <DrawerNav onNavigate={close} to="/app/my-tasks" icon={Inbox} label="My Work" />
            <DrawerNav onNavigate={close} to="/app/inbox" icon={Bell} label="Notifications" />
          </nav>

          {/* Divisions removed */}
          {false && divisions.length > 0 && null}

          {/* Zone 2: Work */}
          <div className="px-3 pb-1 pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Work
            </span>
          </div>
          <nav className="space-y-0.5 px-2">
            {showCrm && (
              <DrawerNavGeneric onNavigate={close} to="/app/clients" icon={Briefcase} label="Clients" />
            )}
            {showResources && <DrawerNavGeneric onNavigate={close} to="/app/resources" icon={UsersRound} label="Resources" />}
            {showCapacity && <DrawerNavGeneric onNavigate={close} to="/app/resources/capacity" icon={CalendarRange} label="Capacity" />}
            {showExecutive && <DrawerNavGeneric onNavigate={close} to="/app/executive" icon={LineChart} label="Executive" />}
            {showEscalations && <DrawerNavGeneric onNavigate={close} to="/app/escalations" icon={AlertTriangle} label="Escalations" />}
            <DrawerNavGeneric onNavigate={close} to="/app/settings" icon={Settings} label="Settings" />
          </nav>

          {/* Projects */}
          <div className="flex items-center justify-between px-3 pb-1 pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Projects
            </span>
          </div>
          <div className="px-2 pb-3">
            {projects.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">No projects yet</p>
            )}
            <ul className="space-y-0.5">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/app/p/$projectId"
                    params={{ projectId: p.id }}
                    onClick={close}
                    className="flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent/50 active:bg-accent"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="truncate">{p.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border px-3 py-3 pb-safe">
          <button
            onClick={() => {
              close();
              navigate({ to: "/app/profile" });
            }}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <Avatar className="h-8 w-8">
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={displayName} />
              )}
              <AvatarFallback className="bg-aura-gradient text-[10px] text-primary-foreground">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{displayName}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
            </div>
          </button>
          <ThemeToggle />
          <button
            onClick={() => {
              close();
              navigate({ to: "/app/settings" });
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerNav({
  to,
  icon: Icon,
  label,
  onNavigate,
}: {
  to: string;
  icon: typeof Folder;
  label: string;
  onNavigate: () => void;
}) {
  const isNotes = to === "/app/notes";
  return (
    <Link
      to={to as never}
      search={isNotes ? ({ archived: false, project: undefined } as never) : undefined}
      onClick={onNavigate}
      className="flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground active:bg-accent"
    >
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </Link>
  );
}

const DrawerNavGeneric = DrawerNav;

