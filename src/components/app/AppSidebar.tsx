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
import { useFolders, useUpdateFolder } from "@/hooks/use-folders";
import { useSidebarFavorites, useToggleFavorite } from "@/hooks/use-sidebar-favorites";
import { useObjectTypes } from "@/hooks/use-object-types";
import { useTreeState } from "@/hooks/use-tree-state";

import { useInboxCounts } from "@/hooks/use-inbox";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getUnseenActivityCounts } from "@/lib/portal-activity.functions";
import { useVocabulary } from "@/hooks/use-vocabulary";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sparkles, Plus, Folder, Settings, Inbox, ChevronsUpDown, Check, ChevronRight, ChevronDown,
  StickyNote, Mic, Briefcase, Users, UsersRound, CalendarRange, FolderOpen,
  TrendingUp, Settings2, LineChart, AlertTriangle, Search, Star, X, GripVertical,
  Bot, Box, ShieldCheck, Zap, Pencil, ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw, Building2, Rocket,
  Home, Layers, BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Folder as FolderRow } from "@/lib/folder-types";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

import { getSectionIcon } from "@/lib/section-icons";
import { UniversalCreateMenu } from "@/components/app/UniversalCreateMenu";
import { ContainerTree } from "@/components/app/ContainerTree";
import { useNavVisibility } from "@/hooks/use-nav-visibility";
import { isNavHiddenByMode } from "@/lib/workspace-mode-nav";
import { isRoleHidden } from "@/lib/role-nav";
import { useClientContainers } from "@/hooks/use-containers";


const divisionIcon = (d: { icon?: string | null; slug: string }) => {
  if (d.icon) return getSectionIcon(d.icon);
  // Legacy fallbacks for workspaces created before sections were neutralized.
  if (d.slug === "delivery") return Briefcase;
  if (d.slug === "ops") return Settings2;
  if (d.slug === "sales") return TrendingUp;
  return Folder;
};


type DragId = `folder:${string}` | `project:${string}`;
type DropId = `division:${string}` | `folder:${string}` | "root:none";

type NavSection = "me" | "work" | "intelligence";

type NavDef = {
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;
  section: NavSection;
  visibilityKey?: string;
  isActive: (path: string) => boolean;
  badgeKey?: "inbox" | "clients-unseen";
};

// Sidebar grouping (per spec): Pinned · Me · Work · Intelligence.
// Pinned is rendered from favorites. Settings + workspace switcher live in
// the footer. Me is always visible; other sections can be hidden per user.
const NAV_DEFS: NavDef[] = [
  // Me
  { id: "home", label: "Home", icon: Home, to: "/app", section: "me", visibilityKey: "dashboard", isActive: (p) => p === "/app" },
  { id: "inbox", label: "Inbox", icon: Inbox, to: "/app/inbox", section: "me", visibilityKey: "inbox", isActive: (p) => p.startsWith("/app/inbox"), badgeKey: "inbox" },
  { id: "my-tasks", label: "My Work", icon: Check, to: "/app/my-tasks", section: "me", visibilityKey: "my-tasks", isActive: (p) => p === "/app/my-tasks" },
  { id: "approvals", label: "Approvals", icon: ShieldCheck, to: "/app/approvals", section: "me", isActive: (p) => p.startsWith("/app/approvals") },
  // Work
  { id: "clients", label: "Clients", icon: Building2, to: "/app/clients", section: "work", isActive: (p) => p.startsWith("/app/clients") || p.startsWith("/app/onboarding"), badgeKey: "clients-unseen" },
  // Intelligence
  { id: "ai-artifacts", label: "AI & Artifacts", icon: Sparkles, to: "/app/ai-artifacts", section: "intelligence", isActive: (p) => p.startsWith("/app/ai-artifacts") },
  { id: "automations", label: "Automations", icon: Zap, to: "/app/settings/automations", section: "intelligence", isActive: (p) => p.startsWith("/app/settings/automations") || p.startsWith("/app/triggers") },
  { id: "reports", label: "Reports", icon: BarChart3, to: "/app/reports", section: "intelligence", isActive: (p) => p.startsWith("/app/reports") || p.startsWith("/app/executive") || p.startsWith("/app/forecast") || p.startsWith("/app/pipeline-analytics") || p.startsWith("/app/portfolio-status") },
];

const SECTION_META: Record<NavSection, { label: string; key: string; alwaysOn?: boolean }> = {
  me: { label: "Me", key: "section:me", alwaysOn: true },
  work: { label: "Work", key: "section:work" },
  intelligence: { label: "Intelligence", key: "section:intelligence" },
};

export function AppSidebar() {
  const ws = useWorkspaceStore((s) => s.current);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const editMode = useUIStore((s) => s.sidebarEditMode);
  const setEditMode = useUIStore((s) => s.setSidebarEditMode);
  const navOrder = useUIStore((s) => s.navOrder);
  const setNavOrder = useUIStore((s) => s.setNavOrder);
  const navHidden = useUIStore((s) => s.navHidden);
  const toggleNavHidden = useUIStore((s) => s.toggleNavHidden);
  const resetNavLayout = useUIStore((s) => s.resetNavLayout);
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const divisions: Array<{ id: string; name: string; slug: string; color?: string; icon?: string | null; is_default?: boolean }> = [];
  const { data: folders = [] } = useFolders();
  const { data: projects = [] } = useProjects();
  const { data: favorites = [] } = useSidebarFavorites();
  const { data: objectTypes = [] } = useObjectTypes();
  const updateFolder = useUpdateFolder();
  const updateProject = useUpdateProject();
  const tree = useTreeState();
  const { unread: inboxUnread } = useInboxCounts();
  const unseenClientsFn = useServerFn(getUnseenActivityCounts);
  const { data: unseenClientCounts = {} } = useQuery({
    queryKey: ["sidebar-unseen-clients", ws?.id],
    queryFn: () => unseenClientsFn({ data: { workspaceId: ws!.id } }),
    enabled: !!ws?.id,
    staleTime: 60_000,
  });
  const clientsUnseenTotal = Object.values(unseenClientCounts).reduce(
    (acc: number, c) => acc + ((c as { total?: number }).total ?? 0),
    0,
  );
  const { isHidden } = useNavVisibility();
  const [query, setQuery] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const initials = (ws?.name ?? "A").slice(0, 2).toUpperCase();
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "You";
  const userInitials = (profile?.display_name || user?.email || "?").slice(0, 2).toUpperCase();

  const vocab = useVocabulary();

  const clientContainers = useClientContainers();
  const hasAnyClient = clientContainers.length > 0;

  // Compute ordered nav list, honouring custom order then defaults, then re-label with workspace vocabulary.
  const orderedNav = useMemo(() => {
    const byId = new Map(NAV_DEFS.map((n) => [n.id, n]));
    const seen = new Set<string>();
    const out: NavDef[] = [];
    for (const id of navOrder) {
      const n = byId.get(id);
      if (n && !seen.has(id)) { out.push(n); seen.add(id); }
    }
    for (const n of NAV_DEFS) if (!seen.has(n.id)) out.push(n);
    return out
      .filter((n) => !isNavHiddenByMode(n.id, ws?.workspace_mode, hasAnyClient))
      .filter((n) => !isRoleHidden(profile?.primary_role ?? null, n.id))
      .map((n) => {
        if (n.id === "clients") return { ...n, label: vocab.customer.plural };
        return n;
      });
  }, [navOrder, vocab, ws?.workspace_mode, hasAnyClient, profile?.primary_role]);

  const moveNav = (id: string, dir: -1 | 1) => {
    const ids = orderedNav.map((n) => n.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setNavOrder(ids);
  };

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
      if (oType === "folder") {
        if (oId === f.id) return;
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
        await updateFolder.mutateAsync({ id: f.id, parent_id: oId });
      } else if (oType === "root") {
        await updateFolder.mutateAsync({ id: f.id, parent_id: null });
      }
    } else if (aType === "project") {
      const p = projects.find((x) => x.id === aId);
      if (!p) return;
      if (oType === "folder") {
        await updateProject.mutateAsync({ id: p.id, folder_id: oId });
      } else if (oType === "root") {
        await updateProject.mutateAsync({ id: p.id, folder_id: null });
      }
    }
  };

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={100}>
        <aside className="flex h-full w-14 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-2">
          <button
            onClick={() => navigate({ to: "/app" })}
            className="mb-2 flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-aura-gradient text-xs font-semibold text-primary-foreground"
            title={ws?.name}
          >
            {ws?.logo_url ? (
              <img src={ws.logo_url} alt={ws.name} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </button>
          <nav className="flex flex-col items-center gap-1">
            {orderedNav
              .filter((n) => (n.id === "clients" || !navHidden.includes(n.id)) && !(n.visibilityKey && isHidden(n.visibilityKey)))
              .map((n) => (
                <IconNav
                  key={n.id}
                  to={n.to}
                  icon={n.icon}
                  active={n.isActive(path)}
                  label={n.label}
                  badge={n.badgeKey === "inbox" ? inboxUnread : n.badgeKey === "clients-unseen" ? clientsUnseenTotal : undefined}
                />
              ))}
            {divisions.map((d) => {
              const Icon = divisionIcon(d);
              return (
                <Tooltip key={d.id}>
                  <TooltipTrigger asChild>
                    <a
                      href={`/app/d/${d.slug}`}
                      className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                        path.startsWith(`/app/d/${d.slug}`) ? "bg-aura-gradient-subtle" : "hover:bg-sidebar-accent/50"
                      }`}
                      style={{ color: d.color }}
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="right">{d.name}</TooltipContent>
                </Tooltip>
              );
            })}
            <IconNav to="/app/settings" icon={Settings} active={path.startsWith("/app/settings")} label="Settings" />
          </nav>
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

  // Group nav items by section, honouring custom order and role/mode hiding.
  const sectionedNav = useMemo(() => {
    const bySection: Record<NavSection, NavDef[]> = { me: [], work: [], intelligence: [] };
    for (const n of orderedNav) bySection[n.section].push(n);
    return bySection;
  }, [orderedNav]);

  const sectionHidden = (key: string) => navHidden.includes(key);
  const toggleSection = (key: string) => toggleNavHidden(key);

  const renderNavItem = (n: NavDef, idx: number, total: number) => {
    const hiddenByRole = n.visibilityKey && isHidden(n.visibilityKey);
    const userHidden = n.id !== "clients" && navHidden.includes(n.id);
    if (hiddenByRole) return null;
    if (!editMode && userHidden) return null;
    return (
      <EditableNavRow
        key={n.id}
        def={n}
        editMode={editMode}
        isFirst={idx === 0}
        isLast={idx === total - 1}
        userHidden={userHidden}
        active={n.isActive(path)}
        badge={n.badgeKey === "inbox" ? inboxUnread : n.badgeKey === "clients-unseen" ? clientsUnseenTotal : undefined}
        onMove={moveNav}
        onToggleHidden={toggleNavHidden}
      />
    );
  };

  const renderSection = (sectionKey: NavSection, children?: React.ReactNode) => {
    const meta = SECTION_META[sectionKey];
    const items = sectionedNav[sectionKey];
    const collapsed = !meta.alwaysOn && sectionHidden(meta.key);
    if (!editMode && items.length === 0 && !children) return null;
    return (
      <div key={sectionKey} className="px-2 pt-2">
        <div className="flex items-center justify-between px-1 pb-1">
          <button
            onClick={() => !meta.alwaysOn && toggleSection(meta.key)}
            disabled={meta.alwaysOn}
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground"
          >
            {!meta.alwaysOn && (collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            {meta.label}
          </button>
        </div>
        {!collapsed && (
          <div className="space-y-0.5">
            {items.map((n, i) => renderNavItem(n, i, items.length))}
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <aside className="group/sb flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        {/* Search */}
        <div className="px-2 pt-3">
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

        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {/* Pinned */}
          {(favProjects.length > 0 || favFolders.length > 0) && !q && (
            <div className="px-2 pt-3">
              <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pinned
              </div>
              <div className="space-y-0.5">
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
            </div>
          )}

          {/* Me — always present */}
          {renderSection("me")}

          {/* Work — Clients link + Spaces tree */}
          {renderSection(
            "work",
            !sectionHidden(SECTION_META.work.key) ? (
              <div data-tour="sections" className="pt-1">
                <div className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Spaces
                  </span>
                </div>
                <ContainerTree currentPath={path} />
              </div>
            ) : null,
          )}

          {/* Intelligence */}
          {renderSection("intelligence")}
        </div>

        {/* Footer: workspace switcher + Settings */}
        <div className="border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent/50">
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-aura-gradient text-[10px] font-semibold text-primary-foreground">
                  {ws?.logo_url ? (
                    <img src={ws.logo_url} alt={ws.name} className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{ws?.name}</p>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              {workspaces.map((w) => (
                <DropdownMenuItem key={w.id} onClick={() => setCurrent(w)}>
                  <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded bg-aura-gradient text-[10px] text-primary-foreground">
                    {w.logo_url ? (
                      <img src={w.logo_url} alt={w.name} className="h-full w-full object-cover" />
                    ) : (
                      w.name.slice(0, 2).toUpperCase()
                    )}
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

          <nav className="space-y-0.5 border-t border-sidebar-border px-2 py-2">
            {editMode ? (
              <>
                <button
                  onClick={() => resetNavLayout()}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground"
                >
                  <RotateCcw className="h-4 w-4" /> Reset layout
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="flex w-full items-center gap-2 rounded-md bg-aura-gradient-subtle px-2 py-1.5 text-sm font-medium"
                >
                  <Check className="h-4 w-4" /> Done editing
                </button>
              </>
            ) : (
              <div className="group/row relative flex items-center">
                <div className="min-w-0 flex-1">
                  <NavItem to="/app/settings" icon={Settings} active={path.startsWith("/app/settings")}>Settings</NavItem>
                </div>
                <button
                  onClick={() => setEditMode(true)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:opacity-100 group-hover/sb:opacity-100"
                  title="Customize sidebar"
                  aria-label="Customize sidebar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </nav>
        </div>
      </aside>
    </DndContext>
  );
}

function EditableNavRow({
  def,
  editMode,
  isFirst,
  isLast,
  userHidden,
  active,
  badge,
  onMove,
  onToggleHidden,
}: {
  def: NavDef;
  editMode: boolean;
  isFirst: boolean;
  isLast: boolean;
  userHidden: boolean;
  active: boolean;
  badge?: number;
  onMove: (id: string, dir: -1 | 1) => void;
  onToggleHidden: (id: string) => void;
}) {
  const Icon = def.icon;
  if (!editMode) {
    return (
      <NavItem to={def.to} icon={Icon} active={active} badge={badge}>
        {def.label}
      </NavItem>
    );
  }
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md border border-dashed border-sidebar-border/70 px-1.5 py-1",
        userHidden && "opacity-50",
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="flex-1 truncate text-xs">{def.label}</span>
      <button
        onClick={() => onMove(def.id, -1)}
        disabled={isFirst}
        className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground disabled:opacity-30"
        title="Move up"
      >
        <ArrowUp className="h-3 w-3" />
      </button>
      <button
        onClick={() => onMove(def.id, 1)}
        disabled={isLast}
        className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground disabled:opacity-30"
        title="Move down"
      >
        <ArrowDown className="h-3 w-3" />
      </button>
      <button
        onClick={() => onToggleHidden(def.id)}
        className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
        title={userHidden ? "Show" : "Hide"}
      >
        {userHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
    </div>
  );
}

type Tree = ReturnType<typeof useTreeState>;


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
        {folder.client_account_id && (
          <Link
            to="/app/clients/$accountId"
            params={{ accountId: folder.client_account_id }}
            onClick={(e) => e.stopPropagation()}
            title="Open CRM record"
            className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
          >
            <Building2 className="h-3 w-3" />
          </Link>
        )}
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
        <div className="opacity-0 group-hover:opacity-100">
          <UniversalCreateMenu
            folderId={folder.id}
            divisionId=""
            variant="ghost"
            iconOnly
            className="h-5 w-5"
          />
        </div>
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
      <div className="opacity-0 group-hover:opacity-100">
        <UniversalCreateMenu
          folderId={project.folder_id ?? null}
          divisionId=""
          projectId={project.id}
          variant="ghost"
          iconOnly
          className="h-5 w-5"
        />
      </div>
    </div>
  );
}

function NavItem({ to, icon: Icon, active, badge, children }: { to: string; icon: typeof Folder; active: boolean; badge?: number | null; children: React.ReactNode }) {
  return (
    <a
      href={to}
      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
        active ? "bg-aura-gradient-subtle font-medium text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{children}</span>
      {badge && badge > 0 ? (
        <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary/20 px-1 text-[10px] font-semibold text-primary">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </a>
  );
}

function IconNav({ to, icon: Icon, active, label, badge }: { to: string; icon: typeof Folder; active: boolean; label: string; badge?: number | null }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={to}
          className={`relative flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
            active ? "bg-aura-gradient-subtle text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
          {badge && badge > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
              {badge > 9 ? "9+" : badge}
            </span>
          ) : null}
        </a>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}


function ObjectsPopover({
  objectTypes,
  currentPath,
}: {
  objectTypes: Array<{ id: string; key: string; color: string | null; label: string; plural_label: string }>;
  currentPath: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const active = currentPath.startsWith("/app/objects");
  const filtered = objectTypes.filter(
    (ot) => !q || ot.plural_label.toLowerCase().includes(q.toLowerCase()) || ot.key.includes(q.toLowerCase()),
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            active
              ? "bg-aura-gradient-subtle font-medium"
              : "text-foreground/80 hover:bg-sidebar-accent/40 hover:text-foreground",
          )}
        >
          <Box className="h-4 w-4" />
          <span className="flex-1 text-left">Objects</span>
          {objectTypes.length > 0 && (
            <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
              {objectTypes.length}
            </span>
          )}
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="w-64 p-2">
        <div className="mb-2 flex items-center gap-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find object…"
            className="h-7 text-xs"
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No matching objects
            </p>
          )}
          {filtered.map((ot) => (
            <button
              key={ot.id}
              onClick={() => {
                setOpen(false);
                navigate({ to: "/app/objects/$key", params: { key: ot.key } });
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                currentPath === `/app/objects/${ot.key}`
                  ? "bg-aura-gradient-subtle font-medium"
                  : "hover:bg-accent",
              )}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: ot.color ?? "#8b5cf6" }}
              />
              <span className="flex-1 truncate text-left">{ot.plural_label}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 border-t pt-2">
          <button
            onClick={() => {
              setOpen(false);
              navigate({ to: "/app/settings/object-types" });
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" />
            Manage object types
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}


