import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Sparkles,
  Plus,
  Folder,
  Settings,
  Inbox,
  ChevronsUpDown,
  Check,
  MoreHorizontal,
  ChevronRight,
  Trash2,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Project } from "@/lib/types";

export function AppSidebar() {
  const ws = useWorkspaceStore((s) => s.current);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  const { user } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: projects = [] } = useProjects();
  const createProject = useCreateProject();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const submitNew = async () => {
    if (!newName.trim()) {
      setCreating(false);
      return;
    }
    const p = await createProject.mutateAsync({ name: newName.trim() });
    setCreating(false);
    setNewName("");
    navigate({ to: "/app/p/$projectId", params: { projectId: p.id } });
  };

  const initials = (ws?.name ?? "A").slice(0, 2).toUpperCase();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Workspace switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 border-b border-sidebar-border px-3 py-3 text-left transition-colors hover:bg-sidebar-accent/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aura-gradient text-xs font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{ws?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => setCurrent(w)}>
              <div className="flex h-6 w-6 items-center justify-center rounded bg-aura-gradient text-[10px] text-primary-foreground">
                {w.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="ml-2 flex-1 truncate">{w.name}</span>
              {w.id === ws?.id && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/app/profile" })}>
            <Settings className="mr-2 h-4 w-4" /> Profile & preferences
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/onboarding" })}>
            <Plus className="mr-2 h-4 w-4" /> New workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Nav */}
      <nav className="space-y-0.5 px-2 py-3">
        <NavItem to="/app" icon={Folder} active={path === "/app"}>Dashboard</NavItem>
        <NavItem to="/app/my-tasks" icon={Inbox} active={path === "/app/my-tasks"}>My tasks</NavItem>
        <NavItem to="/app/settings" icon={Settings} active={path.startsWith("/app/settings")}>Settings</NavItem>
      </nav>

      {/* Projects */}
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Projects
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <ProjectTree projects={projects} parentId={null} currentPath={path} depth={0} />
        {creating && (
          <div className="px-2 py-1">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={submitNew}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNew();
                if (e.key === "Escape") {
                  setCreating(false);
                  setNewName("");
                }
              }}
              placeholder="Project name"
              className="h-7 text-sm"
            />
          </div>
        )}
        {projects.length === 0 && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent/50"
          >
            <Plus className="h-3.5 w-3.5" /> New project
          </button>
        )}
      </div>

      {/* Brand footer */}
      <div className="flex items-center gap-2 border-t border-sidebar-border px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-aura-gradient">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">Aura</span>
      </div>
    </aside>
  );
}

function NavItem({ to, icon: Icon, active, children }: { to: string; icon: typeof Folder; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
        active ? "bg-aura-gradient-subtle font-medium text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}

function ProjectTree({ projects, parentId, currentPath, depth }: { projects: Project[]; parentId: string | null; currentPath: string; depth: number }) {
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const items = projects.filter((p) => (p.parent_id ?? null) === parentId);

  if (items.length === 0) return null;

  return (
    <ul className="space-y-0.5">
      {items.map((p) => {
        const children = projects.filter((c) => c.parent_id === p.id);
        const hasChildren = children.length > 0;
        const isExpanded = expanded.has(p.id);
        const active = currentPath === `/app/p/${p.id}`;

        return (
          <li key={p.id}>
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  className={`group flex items-center gap-1 rounded-md px-1 py-1 transition-colors ${
                    active ? "bg-aura-gradient-subtle font-medium" : "hover:bg-sidebar-accent/50"
                  }`}
                  style={{ paddingLeft: `${depth * 12 + 4}px` }}
                >
                  <button
                    className="flex h-4 w-4 shrink-0 items-center justify-center"
                    onClick={() => {
                      const next = new Set(expanded);
                      if (isExpanded) next.delete(p.id);
                      else next.add(p.id);
                      setExpanded(next);
                    }}
                  >
                    {hasChildren ? (
                      <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    ) : null}
                  </button>
                  <span
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: p.color }}
                  />
                  {renaming === p.id ? (
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        if (renameValue.trim()) updateProject.mutate({ id: p.id, name: renameValue.trim() });
                        setRenaming(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (renameValue.trim()) updateProject.mutate({ id: p.id, name: renameValue.trim() });
                          setRenaming(null);
                        }
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      className="h-6 flex-1 text-sm"
                    />
                  ) : (
                    <Link
                      to="/app/p/$projectId"
                      params={{ projectId: p.id }}
                      className="flex-1 truncate text-sm"
                    >
                      {p.name}
                    </Link>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="opacity-0 transition-opacity group-hover:opacity-100">
                        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setRenaming(p.id); setRenameValue(p.name); }}>
                        <Pencil className="mr-2 h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Delete "${p.name}"? This will delete all tasks in it.`)) {
                            deleteProject.mutate(p.id);
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => { setRenaming(p.id); setRenameValue(p.name); }}>
                  <Pencil className="mr-2 h-4 w-4" /> Rename
                </ContextMenuItem>
                <ContextMenuItem
                  className="text-destructive"
                  onClick={() => {
                    if (confirm(`Delete "${p.name}"?`)) deleteProject.mutate(p.id);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            {hasChildren && isExpanded && (
              <ProjectTree projects={projects} parentId={p.id} currentPath={currentPath} depth={depth + 1} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
