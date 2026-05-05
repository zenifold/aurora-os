import { Link, useNavigate } from "@tanstack/react-router";
import { useUIStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/use-profile";
import { useProjects } from "@/hooks/use-projects";
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
  Star,
  Sparkles,
  StickyNote,
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
  const navigate = useNavigate();

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

        {/* Smart lists */}
        <nav className="space-y-0.5 px-2 py-3">
          <DrawerNav onNavigate={close} to="/app" icon={CalendarDays} label="Today" />
          <DrawerNav onNavigate={close} to="/app/my-tasks" icon={Inbox} label="My tasks" />
          <DrawerNav onNavigate={close} to="/app/notes" icon={StickyNote} label="Notes" />
          <DrawerNav onNavigate={close} to="/app/notifications" icon={Star} label="Notifications" />
        </nav>

        {/* Projects */}
        <div className="flex items-center justify-between px-3 pb-1 pt-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Projects
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
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
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent/50"
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
  to: "/app" | "/app/my-tasks" | "/app/notifications" | "/app/notes";
  icon: typeof Folder;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
