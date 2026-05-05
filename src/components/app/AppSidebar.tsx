import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUIStore } from "@/stores/ui-store";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/use-profile";
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from "@/hooks/use-projects";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  StickyNote,
  Mic,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Project } from "@/lib/types";

export function AppSidebar() {
  const ws = useWorkspaceStore((s) => s.current);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const { user } = useAuth();
  const { data: profile } = useProfile();
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
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "You";
  const userInitials = (profile?.display_name || user?.email || "?").slice(0, 2).toUpperCase();

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={100}>
        <aside className="flex h-full w-14 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-aura-gradient text-xs font-semibold text-primary-foreground hover:opacity-90" title={ws?.name}>
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              {workspaces.map((w) => (
                <DropdownMenuItem key={w.id} onClick={() => setCurrent(w)}>
                  <span className="ml-1 flex-1 truncate">{w.name}</span>
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

          <nav className="flex flex-col items-center gap-1">
            <IconNav to="/app" icon={Folder} active={path === "/app"} label="Dashboard" />
            <IconNav to="/app/my-tasks" icon={Inbox} active={path === "/app/my-tasks"} label="My tasks" />
            <IconNav to="/app/notes" icon={StickyNote} active={path.startsWith("/app/notes")} label="Notes" />
            <IconNav to="/app/meetings" icon={Mic} active={path.startsWith("/app/meetings")} label="Meetings" />
            <IconNav to="/app/settings" icon={Settings} active={path.startsWith("/app/settings")} label="Settings" />
          </nav>

          <div className="mt-2 h-px w-8 bg-sidebar-border" />

          <div className="mt-2 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
            {projects.filter((p) => !p.parent_id).map((p) => (
              <Tooltip key={p.id}>
                <TooltipTrigger asChild>
                  <Link
                    to="/app/p/$projectId"
                    params={{ projectId: p.id }}
                    className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                      path === `/app/p/${p.id}` ? "bg-aura-gradient-subtle" : "hover:bg-sidebar-accent/50"
                    }`}
                  >
                    <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: p.color }} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{p.name}</TooltipContent>
              </Tooltip>
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">New project</TooltipContent>
            </Tooltip>
            {creating && (
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={submitNew}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNew();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                placeholder="Name"
                className="h-7 w-12 px-1 text-xs"
              />
            )}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate({ to: "/app/profile" })}
                className="mt-auto flex h-9 w-9 items-center justify-center rounded-md hover:bg-sidebar-accent/50"
                aria-label="Profile"
              >
                <Avatar className="h-7 w-7">
                  {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
                  <AvatarFallback className="bg-aura-gradient text-[10px] text-primary-foreground">{userInitials}</AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{displayName}</TooltipContent>
          </Tooltip>
        </aside>
      </TooltipProvider>
    );
  }

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
              <p className="truncate text-xs text-muted-foreground">{displayName}</p>
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
        <NavItem to="/app/notes" icon={StickyNote} active={path.startsWith("/app/notes")}>Notes</NavItem>
        <NavItem to="/app/meetings" icon={Mic} active={path.startsWith("/app/meetings")}>Meetings</NavItem>
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
        <ProjectTreeDnd projects={projects} currentPath={path} />
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

      {/* User chip footer */}
      <button
        onClick={() => navigate({ to: "/app/profile" })}
        className="flex items-center gap-2 border-t border-sidebar-border px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/50"
      >
        <Avatar className="h-7 w-7">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
          <AvatarFallback className="bg-aura-gradient text-[10px] text-primary-foreground">{userInitials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{displayName}</p>
          <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
        </div>
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
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

function IconNav({ to, icon: Icon, active, label }: { to: string; icon: typeof Folder; active: boolean; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={to}
          className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
            active ? "bg-aura-gradient-subtle text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function ProjectTreeDnd({ projects, currentPath }: { projects: Project[]; currentPath: string }) {
  const updateProject = useUpdateProject();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const byParent = useMemo(() => {
    const map = new Map<string | null, Project[]>();
    for (const p of projects) {
      const k = p.parent_id ?? null;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [projects]);

  const isDescendant = (ancestorId: string, candidateId: string): boolean => {
    let cur = projects.find((p) => p.id === candidateId);
    while (cur?.parent_id) {
      if (cur.parent_id === ancestorId) return true;
      cur = projects.find((p) => p.id === cur!.parent_id);
    }
    return false;
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const dragged = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId || dragged === overId) return;

    // Drop targets: "root" | `into:<id>` | `before:<id>` | `after:<id>`
    if (overId === "root") {
      if (isDescendant(dragged, dragged)) return;
      const siblings = byParent.get(null) ?? [];
      const lastPos = siblings.length ? siblings[siblings.length - 1].position : 0;
      updateProject.mutate({ id: dragged, parent_id: null, position: lastPos + 1 });
      return;
    }
    if (overId.startsWith("into:")) {
      const targetId = overId.slice(5);
      if (targetId === dragged || isDescendant(dragged, targetId)) return;
      const siblings = byParent.get(targetId) ?? [];
      const lastPos = siblings.length ? siblings[siblings.length - 1].position : 0;
      updateProject.mutate({ id: dragged, parent_id: targetId, position: lastPos + 1 });
      setExpanded((prev) => new Set(prev).add(targetId));
      return;
    }
    if (overId.startsWith("before:") || overId.startsWith("after:")) {
      const isBefore = overId.startsWith("before:");
      const targetId = overId.slice(isBefore ? 7 : 6);
      if (targetId === dragged) return;
      const target = projects.find((p) => p.id === targetId);
      if (!target) return;
      if (isDescendant(dragged, targetId)) return;
      const newParent = target.parent_id ?? null;
      const siblings = (byParent.get(newParent) ?? []).filter((s) => s.id !== dragged);
      const idx = siblings.findIndex((s) => s.id === targetId);
      const insertIdx = isBefore ? idx : idx + 1;
      const prev = siblings[insertIdx - 1]?.position;
      const next = siblings[insertIdx]?.position;
      let newPos: number;
      if (prev == null && next == null) newPos = 0;
      else if (prev == null) newPos = next! - 1;
      else if (next == null) newPos = prev + 1;
      else newPos = (prev + next) / 2;
      updateProject.mutate({ id: dragged, parent_id: newParent, position: newPos });
    }
  };

  const draggedProject = activeId ? projects.find((p) => p.id === activeId) : null;

  const renderRow = (p: Project, depth: number) => {
    const children = byParent.get(p.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(p.id);
    const active = currentPath === `/app/p/${p.id}`;

    return (
      <li key={p.id}>
        <DropZone id={`before:${p.id}`} />
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <DraggableRow id={p.id} folderId={p.id}>
              <div
                className={`group flex items-center gap-1 rounded-md px-1 py-1 transition-colors ${
                  active ? "bg-aura-gradient-subtle font-medium" : "hover:bg-sidebar-accent/50"
                }`}
                style={{ paddingLeft: `${depth * 12 + 4}px` }}
              >
                <button
                  className="flex h-4 w-4 shrink-0 items-center justify-center"
                  onPointerDown={(e) => e.stopPropagation()}
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
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: p.color }} />
                {renaming === p.id ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
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
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {p.name}
                  </Link>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setRenaming(p.id); setRenameValue(p.name); }}>
                      <Pencil className="mr-2 h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        const name = window.prompt("Subfolder name");
                        if (name?.trim()) {
                          await createProject.mutateAsync({ name: name.trim(), parent_id: p.id });
                          setExpanded((prev) => new Set(prev).add(p.id));
                        }
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" /> New subfolder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
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
            </DraggableRow>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => { setRenaming(p.id); setRenameValue(p.name); }}>
              <Pencil className="mr-2 h-4 w-4" /> Rename
            </ContextMenuItem>
            <ContextMenuItem
              onClick={async () => {
                const name = window.prompt("Subfolder name");
                if (name?.trim()) {
                  await createProject.mutateAsync({ name: name.trim(), parent_id: p.id });
                  setExpanded((prev) => new Set(prev).add(p.id));
                }
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> New subfolder
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
          <ul className="space-y-0.5">{children.map((c) => renderRow(c, depth + 1))}</ul>
        )}
        {hasChildren && isExpanded && <DropZone id={`after:${p.id}`} />}
      </li>
    );
  };

  const roots = byParent.get(null) ?? [];

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <RootDropZone />
      <ul className="space-y-0.5">{roots.map((p) => renderRow(p, 0))}</ul>
      {roots.length > 0 && <DropZone id={`after:${roots[roots.length - 1].id}`} />}
      <DragOverlay>
        {draggedProject ? (
          <div className="flex items-center gap-1 rounded-md bg-sidebar-accent px-2 py-1 text-sm shadow-lg">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: draggedProject.color }} />
            <span className="truncate">{draggedProject.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DraggableRow({ id, folderId, children }: { id: string; folderId: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `into:${folderId}` });
  return (
    <div
      ref={(el) => {
        setDragRef(el);
        setDropRef(el);
      }}
      {...attributes}
      {...listeners}
      className={`${isDragging ? "opacity-40" : ""} ${isOver ? "ring-1 ring-primary/60 rounded-md" : ""}`}
    >
      {children}
    </div>
  );
}

function DropZone({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`h-1 -my-0.5 rounded transition-colors ${isOver ? "bg-primary" : ""}`}
    />
  );
}

function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: "root" });
  return (
    <div
      ref={setNodeRef}
      className={`mb-1 h-2 rounded text-[10px] text-center transition-colors ${
        isOver ? "bg-primary/20 text-primary" : "text-transparent"
      }`}
    >
      Move to root
    </div>
  );
}
