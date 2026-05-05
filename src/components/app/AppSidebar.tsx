import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUIStore } from "@/stores/ui-store";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/use-profile";
import { useProjects, useCreateProject, useUpdateProject } from "@/hooks/use-projects";
import { useDivisions, useFolders, useCreateFolder, useUpdateFolder } from "@/hooks/use-folders";
import { useSidebarFavorites, useToggleFavorite } from "@/hooks/use-sidebar-favorites";
import { useTreeState } from "@/hooks/use-tree-state";
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
  Sparkles, Plus, Folder, Settings, Inbox, ChevronsUpDown, Check, ChevronRight, ChevronDown,
  StickyNote, Mic, Briefcase, Users, UsersRound, CalendarRange, FolderOpen,
  TrendingUp, Settings2, LineChart, AlertTriangle, Search, Star, X, GripVertical,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Division, Folder as FolderRow } from "@/lib/folder-types";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const divisionIcon = (slug: string) => {
  if (slug === "delivery") return Briefcase;
  if (slug === "ops") return Settings2;
  if (slug === "sales") return TrendingUp;
  return Folder;
};

type DragId = `folder:${string}` | `project:${string}`;
type DropId = `division:${string}` | `folder:${string}` | "root:none";

export function AppSidebar() {
  const ws = useWorkspaceStore((s) => s.current);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: divisions = [] } = useDivisions();
  const { data: folders = [] } = useFolders();
  const { data: projects = [] } = useProjects();
  const { data: favorites = [] } = useSidebarFavorites();
  const updateFolder = useUpdateFolder();
  const updateProject = useUpdateProject();
  const tree = useTreeState();
  const [query, setQuery] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const initials = (ws?.name ?? "A").slice(0, 2).toUpperCase();
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "You";
  const userInitials = (profile?.display_name || user?.email || "?").slice(0, 2).toUpperCase();

  const q = query.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);

  // build set of folder ids that should be visible due to search (self or descendants/projects match)
  const visibleFolderIds = useMemo(() => {
    if (!q) return null;
    const set = new Set<string>();
    const folderById = new Map(folders.map((f) => [f.id, f]));
    const markAncestors = (fid: string | null) => {
      let cur = fid;
      while (cur) {
        if (set.has(cur)) break;
        set.add(cur);
        cur = folderById.get(cur)?.parent_id ?? null;
      }
    };
    folders.forEach((f) => { if (matches(f.name)) markAncestors(f.id); });
    projects.forEach((p) => {
      if (matches(p.name)) {
        if (p.folder_id) markAncestors(p.folder_id);
      }
    });
    return set;
  }, [q, folders, projects]);

  const visibleProject = (p: Project) => {
    if (!q) return true;
    if (matches(p.name)) return true;
    return false;
  };
  const visibleFolder = (f: FolderRow) => visibleFolderIds === null || visibleFolderIds.has(f.id);

  const handleDragEnd = async (e: DragEndEvent) => {
    const active = e.active.id as DragId;
    const over = e.over?.id as DropId | undefined;
    if (!over) return;
    if (active === over) return;

    const [aType, aId] = active.split(":") as ["folder" | "project", string];
    const [oType, oId] = over.split(":") as ["division" | "folder" | "root", string];

    if (aType === "folder") {
      const f = folders.find((x) => x.id === aId);
      if (!f) return;
      if (oType === "division") {
        if (f.division_id === oId && f.parent_id === null) return;
        await updateFolder.mutateAsync({ id: f.id, division_id: oId, parent_id: null });
      } else if (oType === "folder") {
        if (oId === f.id) return;
        // prevent moving into own descendant
        const isDescendant = (parent: string, target: string): boolean => {
          let cur: string | null = parent;
          const map = new Map(folders.map((x) => [x.id, x.parent_id] as const));
          while (cur) {
            if (cur === target) return true;
            cur = map.get(cur) ?? null;
          }
          return false;
        };
        if (isDescendant(oId, f.id)) return;
        const target = folders.find((x) => x.id === oId);
        if (!target) return;
        await updateFolder.mutateAsync({ id: f.id, parent_id: oId, division_id: target.division_id });
      }
    } else if (aType === "project") {
      const p = projects.find((x) => x.id === aId);
      if (!p) return;
      if (oType === "division") {
        await updateProject.mutateAsync({ id: p.id, division_id: oId, folder_id: null });
      } else if (oType === "folder") {
        const target = folders.find((x) => x.id === oId);
        if (!target) return;
        await updateProject.mutateAsync({ id: p.id, folder_id: oId, division_id: target.division_id });
      }
    }
  };

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={100}>
        <aside className="flex h-full w-14 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-2">
          <button
            onClick={() => navigate({ to: "/app" })}
            className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-aura-gradient text-xs font-semibold text-primary-foreground"
            title={ws?.name}
          >
            {initials}
          </button>
          <nav className="flex flex-col items-center gap-1">
            <IconNav to="/app" icon={Folder} active={path === "/app"} label="Dashboard" />
            <IconNav to="/app/my-tasks" icon={Inbox} active={path === "/app/my-tasks"} label="My tasks" />
            {divisions.map((d) => {
              const Icon = divisionIcon(d.slug);
              return (
                <Tooltip key={d.id}>
                  <TooltipTrigger asChild>
                    <Link
                      to="/app/d/$divisionSlug"
                      params={{ divisionSlug: d.slug }}
                      className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                        path.startsWith(`/app/d/${d.slug}`) ? "bg-aura-gradient-subtle" : "hover:bg-sidebar-accent/50"
                      }`}
                      style={{ color: d.color }}
                    >
                      <Icon className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{d.name}</TooltipContent>
                </Tooltip>
              );
            })}
            <IconNav to="/app/notes" icon={StickyNote} active={path.startsWith("/app/notes")} label="Notes" />
            <IconNav to="/app/meetings" icon={Mic} active={path.startsWith("/app/meetings")} label="Meetings" />
            <IconNav to="/app/settings" icon={Settings} active={path.startsWith("/app/settings")} label="Settings" />
          </nav>
          <button
            onClick={() => navigate({ to: "/app/profile" })}
            className="mt-auto flex h-9 w-9 items-center justify-center rounded-md hover:bg-sidebar-accent/50"
          >
            <Avatar className="h-7 w-7">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
              <AvatarFallback className="bg-aura-gradient text-[10px] text-primary-foreground">{userInitials}</AvatarFallback>
            </Avatar>
          </button>
        </aside>
      </TooltipProvider>
    );
  }

  const favProjects = favorites
    .filter((f) => f.item_type === "project")
    .map((f) => projects.find((p) => p.id === f.item_id))
    .filter(Boolean) as Project[];
  const favFolders = favorites
    .filter((f) => f.item_type === "folder")
    .map((f) => folders.find((x) => x.id === f.item_id))
    .filter(Boolean) as FolderRow[];

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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

        {/* Search */}
        <div className="px-2 pt-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search folders & projects"
              className="h-8 pl-7 pr-7 text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Top nav */}
        <nav className="space-y-0.5 px-2 py-2">
          <NavItem to="/app" icon={Folder} active={path === "/app"}>Dashboard</NavItem>
          <NavItem to="/app/my-tasks" icon={Inbox} active={path === "/app/my-tasks"}>My tasks</NavItem>
          <NavItem to="/app/executive" icon={LineChart} active={path.startsWith("/app/executive")}>Executive</NavItem>
          <NavItem to="/app/escalations" icon={AlertTriangle} active={path.startsWith("/app/escalations")}>Escalations</NavItem>
        </nav>

        {/* Favorites */}
        {(favProjects.length > 0 || favFolders.length > 0) && !q && (
          <div className="px-2 pb-1">
            <div className="px-1 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Favorites
            </div>
            {favFolders.map((f) => (
              <Link
                key={f.id}
                to="/app/f/$folderId"
                params={{ folderId: f.id }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm",
                  path.includes(`/app/f/${f.id}`)
                    ? "bg-aura-gradient-subtle font-medium"
                    : "text-foreground/80 hover:bg-sidebar-accent/40 hover:text-foreground"
                )}
              >
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{f.name}</span>
              </Link>
            ))}
            {favProjects.map((p) => (
              <Link
                key={p.id}
                to="/app/p/$projectId"
                params={{ projectId: p.id }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm",
                  path.startsWith(`/app/p/${p.id}`)
                    ? "bg-aura-gradient-subtle font-medium"
                    : "text-foreground/80 hover:bg-sidebar-accent/40 hover:text-foreground"
                )}
              >
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
                <span className="truncate">{p.name}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Divisions tree */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {divisions.map((d) => (
            <DivisionSection
              key={d.id}
              division={d}
              folders={folders.filter((f) => f.division_id === d.id && visibleFolder(f))}
              projects={projects.filter((p) => p.division_id === d.id && visibleProject(p))}
              currentPath={path}
              tree={tree}
              forceOpen={!!q}
              favoriteSet={new Set(favorites.map((x) => `${x.item_type}:${x.item_id}`))}
            />
          ))}
        </div>

        {/* Bottom utility nav */}
        <nav className="space-y-0.5 border-t border-sidebar-border px-2 py-2">
          <NavItem to="/app/notes" icon={StickyNote} active={path.startsWith("/app/notes")}>Notes</NavItem>
          <NavItem to="/app/meetings" icon={Mic} active={path.startsWith("/app/meetings")}>Meetings</NavItem>
          {(ws?.kind === "sales" || ws?.kind === "hybrid") && (
            <>
              <NavItem to="/app/crm" icon={Briefcase} active={path.startsWith("/app/crm")}>CRM</NavItem>
              <NavItem to="/app/contacts" icon={Users} active={path.startsWith("/app/contacts")}>Contacts</NavItem>
            </>
          )}
          <NavItem to="/app/resources" icon={UsersRound} active={path === "/app/resources"}>Resources</NavItem>
          <NavItem to="/app/resources/capacity" icon={CalendarRange} active={path.startsWith("/app/resources/capacity")}>Capacity</NavItem>
          <NavItem to="/app/settings" icon={Settings} active={path.startsWith("/app/settings")}>Settings</NavItem>
        </nav>

        {/* User chip */}
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
    </DndContext>
  );
}

type Tree = ReturnType<typeof useTreeState>;

function DivisionSection({
  division, folders, projects, currentPath, tree, forceOpen, favoriteSet,
}: {
  division: Division;
  folders: FolderRow[];
  projects: Project[];
  currentPath: string;
  tree: Tree;
  forceOpen: boolean;
  favoriteSet: Set<string>;
}) {
  const isActive = currentPath.startsWith(`/app/d/${division.slug}`)
    || folders.some((f) => currentPath.includes(`/app/f/${f.id}`))
    || projects.some((p) => currentPath.includes(`/app/p/${p.id}`));
  const treeKey = `division:${division.id}`;
  const open = forceOpen || tree.isOpen(treeKey, division.is_default || isActive);
  const Icon = divisionIcon(division.slug);
  const createFolder = useCreateFolder();
  const createProject = useCreateProject();
  const [adding, setAdding] = useState<null | "folder" | "project">(null);
  const [name, setName] = useState("");

  const { setNodeRef, isOver } = useDroppable({ id: `division:${division.id}` as DropId });

  const byParent = useMemo(() => {
    const m = new Map<string | null, FolderRow[]>();
    for (const f of folders) {
      const k = f.parent_id ?? null;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    return m;
  }, [folders]);

  const submit = async () => {
    if (!name.trim()) { setAdding(null); setName(""); return; }
    if (adding === "folder") {
      await createFolder.mutateAsync({ division_id: division.id, name: name.trim() });
    } else if (adding === "project") {
      await createProject.mutateAsync({ name: name.trim(), division_id: division.id });
    }
    setAdding(null);
    setName("");
  };

  return (
    <div className="mt-1" ref={setNodeRef}>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-sidebar-accent/40",
          isOver && "ring-1 ring-primary/50 bg-primary/5"
        )}
      >
        <button
          onClick={() => tree.toggle(treeKey, division.is_default || isActive)}
          className="flex flex-1 items-center gap-1.5 text-left"
        >
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <Icon className="h-3.5 w-3.5" style={{ color: division.color }} />
          <Link
            to="/app/d/$divisionSlug"
            params={{ divisionSlug: division.slug }}
            className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {division.name}
          </Link>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100">
              <Plus className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setAdding("folder")}>New folder</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAdding("project")}>New project</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && (
        <div className="ml-3 border-l border-sidebar-border pl-1">
          {(byParent.get(null) ?? []).map((f) => (
            <FolderNode
              key={f.id}
              folder={f}
              byParent={byParent}
              projects={projects.filter((p) => p.folder_id === f.id)}
              currentPath={currentPath}
              depth={0}
              tree={tree}
              forceOpen={forceOpen}
              favoriteSet={favoriteSet}
            />
          ))}
          {projects.filter((p) => !p.folder_id && !p.parent_id).map((p) => (
            <ProjectLeaf key={p.id} project={p} currentPath={currentPath} favoriteSet={favoriteSet} />
          ))}
          {adding && (
            <div className="px-1 py-1">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={submit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") { setAdding(null); setName(""); }
                }}
                placeholder={adding === "folder" ? "Folder name" : "Project name"}
                className="h-7 text-sm"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FolderNode({
  folder, byParent, projects, currentPath, depth, tree, forceOpen, favoriteSet,
}: {
  folder: FolderRow;
  byParent: Map<string | null, FolderRow[]>;
  projects: Project[];
  currentPath: string;
  depth: number;
  tree: Tree;
  forceOpen: boolean;
  favoriteSet: Set<string>;
}) {
  const children = byParent.get(folder.id) ?? [];
  const hasChildren = children.length > 0 || projects.length > 0;
  const isActive = currentPath.includes(`/app/f/${folder.id}`);
  const treeKey = `folder:${folder.id}`;
  const open = forceOpen || tree.isOpen(treeKey, isActive);
  const toggleFav = useToggleFavorite();
  const pinned = favoriteSet.has(`folder:${folder.id}`);

  const drag = useDraggable({ id: `folder:${folder.id}` as DragId });
  const drop = useDroppable({ id: `folder:${folder.id}` as DropId });

  return (
    <div
      ref={drop.setNodeRef}
      style={drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)`, opacity: 0.6 } : undefined}
    >
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-sidebar-accent/40",
          drop.isOver && "ring-1 ring-primary/50 bg-primary/5"
        )}
      >
        <button
          ref={drag.setNodeRef}
          {...drag.listeners}
          {...drag.attributes}
          className="flex h-4 w-3 cursor-grab items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100"
          aria-label="Drag"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        {hasChildren ? (
          <button onClick={() => tree.toggle(treeKey, isActive)} className="text-muted-foreground">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        {open ? <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" /> : <Folder className="h-3.5 w-3.5 text-muted-foreground" />}
        <Link
          to="/app/f/$folderId"
          params={{ folderId: folder.id }}
          className={cn(
            "flex-1 truncate text-sm",
            isActive ? "font-medium text-foreground" : "text-foreground/80 hover:text-foreground"
          )}
        >
          {folder.name}
        </Link>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFav.mutate({ item_type: "folder", item_id: folder.id, pinned });
          }}
          className={cn(
            "rounded p-0.5 opacity-0 group-hover:opacity-100",
            pinned && "opacity-100"
          )}
          aria-label={pinned ? "Unpin" : "Pin"}
        >
          <Star className={cn("h-3 w-3", pinned ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
        </button>
      </div>
      {open && (
        <div className="ml-3 border-l border-sidebar-border pl-1">
          {children.map((c) => (
            <FolderNode
              key={c.id}
              folder={c}
              byParent={byParent}
              projects={[]}
              currentPath={currentPath}
              depth={depth + 1}
              tree={tree}
              forceOpen={forceOpen}
              favoriteSet={favoriteSet}
            />
          ))}
          {projects.map((p) => (
            <ProjectLeaf key={p.id} project={p} currentPath={currentPath} favoriteSet={favoriteSet} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectLeaf({ project, currentPath, favoriteSet }: { project: Project; currentPath: string; favoriteSet: Set<string> }) {
  const isActive = currentPath === `/app/p/${project.id}` || currentPath.startsWith(`/app/p/${project.id}/`);
  const toggleFav = useToggleFavorite();
  const pinned = favoriteSet.has(`project:${project.id}`);
  const drag = useDraggable({ id: `project:${project.id}` as DragId });

  return (
    <div
      style={drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)`, opacity: 0.6 } : undefined}
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-1 py-1 pl-1 text-sm",
        isActive ? "bg-aura-gradient-subtle font-medium text-foreground" : "text-foreground/80 hover:bg-sidebar-accent/40 hover:text-foreground"
      )}
    >
      <button
        ref={drag.setNodeRef}
        {...drag.listeners}
        {...drag.attributes}
        className="flex h-4 w-3 cursor-grab items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100"
        aria-label="Drag"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <Link
        to="/app/p/$projectId"
        params={{ projectId: project.id }}
        className="flex flex-1 items-center gap-1.5 truncate"
      >
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: project.color }} />
        <span className="truncate">{project.name}</span>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFav.mutate({ item_type: "project", item_id: project.id, pinned });
        }}
        className={cn(
          "rounded p-0.5 opacity-0 group-hover:opacity-100",
          pinned && "opacity-100"
        )}
        aria-label={pinned ? "Unpin" : "Pin"}
      >
        <Star className={cn("h-3 w-3", pinned ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
      </button>
    </div>
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
