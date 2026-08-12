import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useProject, useUpdateProject } from "@/hooks/use-projects";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ListChecks, Link2 } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { useViews, useUpdateView, useCreateView } from "@/hooks/use-views";
import { useCustomFields } from "@/hooks/use-custom-fields";
import { useUIStore } from "@/stores/ui-store";
import { TableView } from "@/components/views/TableView";
import { KanbanView } from "@/components/views/KanbanView";
import { CanvasView } from "@/components/views/CanvasView";
import { CalendarView } from "@/components/views/CalendarView";
import { TimelineView } from "@/components/views/TimelineView";
import { SprintView } from "@/components/views/SprintView";
import { MobileTaskList } from "@/components/views/MobileTaskList";
import { ViewTabs } from "@/components/views/ViewTabs";
import { ViewOptions } from "@/components/views/ViewOptions";
import { FilterBar } from "@/components/views/FilterBar";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { ShareDialog } from "@/components/app/ShareDialog";
import { MagicAddDialog } from "@/components/app/MagicAddDialog";
import { PresenceStack } from "@/components/app/PresenceStack";
import { usePresence } from "@/hooks/use-presence";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { applyFiltersAndSorts } from "@/lib/filtering";
import type { Filter, Sort, View, ViewConfig } from "@/lib/types";
import { Loader2, Settings, UserPlus, Wand2, LayoutDashboard, FileText, Star, MessageSquare, Activity, Camera, CheckSquare, Sparkles } from "lucide-react";
import { useSidebarFavorites, useToggleFavorite } from "@/hooks/use-sidebar-favorites";
import { ProjectActionsMenu } from "@/components/projects/ProjectActionsMenu";
import { ProjectPhaseChip } from "@/components/projects/ProjectPhaseChip";

import { Link } from "@tanstack/react-router";
import { useIsMobile } from "@/hooks/use-mobile-breakpoint";
import { useIsWorkspaceOwner } from "@/hooks/use-workspace-role";
import { toast } from "sonner";
import { isTabEnabled } from "@/lib/work-modes";

export const Route = createFileRoute("/app/p/$projectId")({
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const updateProject = useUpdateProject();
  const clientAccountId = project?.client_account_id ?? null;
  const { data: clientAccount } = useQuery({
    queryKey: ["client-account-min", clientAccountId],
    enabled: !!clientAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("id,name")
        .eq("id", clientAccountId!)
        .single();
      if (error) throw error;
      return data as { id: string; name: string };
    },
  });
  const { data: tasks = [], isLoading } = useTasks(projectId);
  const { data: views = [] } = useViews(projectId);
  const { data: fields = [] } = useCustomFields();
  const updateView = useUpdateView(projectId);
  const createView = useCreateView(projectId);
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);
  const selectedTaskId = useUIStore((s) => s.selectedTaskId);
  const { user } = useAuth();
  const { users: presenceUsers } = usePresence(`presence:project:${projectId}`, {
    display_name: user?.email?.split("@")[0],
    viewing_task_id: selectedTaskId,
  });

  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [magicOpen, setMagicOpen] = useState(false);
  // moveOpen state removed — folders are gone; client assignment lives in ProjectActionsMenu.
  void updateProject;
  const isMobile = useIsMobile();
  const isOwner = useIsWorkspaceOwner();
  const { data: favorites = [] } = useSidebarFavorites();
  const toggleFav = useToggleFavorite();
  const isPinned = favorites.some(
    (f) => f.item_type === "project" && f.item_id === projectId,
  );

  // Pick default view
  useEffect(() => {
    if (views.length === 0) {
      setActiveViewId(null);
      return;
    }
    if (!activeViewId || !views.find((v) => v.id === activeViewId)) {
      const def = views.find((v) => v.is_default) ?? views[0];
      setActiveViewId(def.id);
    }
  }, [views, activeViewId]);

  const activeView = useMemo<View | null>(
    () => views.find((v) => v.id === activeViewId) ?? null,
    [views, activeViewId]
  );

  const filteredTasks = useMemo(() => {
    if (!activeView) return tasks;
    return applyFiltersAndSorts(tasks, activeView.filters ?? [], activeView.sorts ?? []);
  }, [tasks, activeView]);

  const isLockedForMe = !!activeView?.config?.locked && !isOwner;

  const duplicateAndEdit = async (
    overrides: Partial<{ filters: Filter[]; sorts: Sort[]; group_by: string | null; config: ViewConfig }>
  ) => {
    if (!activeView) return;
    const res = await createView.mutateAsync({
      name: `${activeView.name} (copy)`,
      view_type: activeView.view_type,
      filters: overrides.filters ?? activeView.filters,
      sorts: overrides.sorts ?? activeView.sorts,
      group_by: overrides.group_by !== undefined ? overrides.group_by : activeView.group_by,
    });
    setActiveViewId(res.id);
    toast.success("Duplicated locked view so you can customize");
  };

  const guard = (fn: () => void, overrides: Parameters<typeof duplicateAndEdit>[0]) => {
    if (isLockedForMe) {
      void duplicateAndEdit(overrides);
      return;
    }
    fn();
  };

  const setFilters = (filters: Filter[]) => {
    guard(() => activeView && updateView.mutate({ id: activeView.id, filters }), { filters });
  };
  const setSorts = (sorts: Sort[]) => {
    guard(() => activeView && updateView.mutate({ id: activeView.id, sorts }), { sorts });
  };
  const setGroupBy = (group_by: string | null) => {
    guard(() => activeView && updateView.mutate({ id: activeView.id, group_by }), { group_by });
  };
  const setConfig = (config: ViewConfig) => {
    guard(() => activeView && updateView.mutate({ id: activeView.id, config }), { config });
  };

  const handleSaveAsView = async (name: string) => {
    if (!activeView) return;
    const res = await createView.mutateAsync({
      name,
      filters: activeView.filters,
      sorts: activeView.sorts,
      group_by: activeView.group_by,
    });
    setActiveViewId(res.id);
  };

  // If a child route is active (e.g. /settings, /overview, /pages), render it
  // instead of the project task views.
  const matches = useMatches();
  const hasChildMatch = matches.some(
    (m) => m.routeId !== "/app/p/$projectId" && m.routeId.startsWith("/app/p/$projectId")
  );
  if (hasChildMatch) {
    return <Outlet />;
  }

  if (isLoading || !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4">
        <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link to="/app/clients" className="hover:text-foreground">Clients</Link>
          <ChevronRight className="h-3 w-3" />
          {clientAccount ? (
            <Link
              to="/app/clients/$accountId"
              params={{ accountId: clientAccount.id }}
              className="hover:text-foreground"
            >
              {clientAccount.name}
            </Link>
          ) : (
            <span>Unassigned</span>
          )}
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{project.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="press flex h-9 w-9 items-center justify-center rounded-lg text-base shadow-elegant transition-transform hover:scale-105"
            style={{ backgroundColor: `${project.color}22`, color: project.color }}
          >
            <span className="font-display text-lg font-semibold">{project.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display truncate text-lg font-semibold leading-tight tracking-tight lg:text-xl">{project.name}</h1>
              <ProjectPhaseChip projectId={projectId} />
            </div>
            {project.description && (
              <p className="hidden truncate text-sm text-muted-foreground sm:block">{project.description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              toggleFav.mutate({ item_type: "project", item_id: projectId, pinned: isPinned })
            }
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={isPinned ? "Unpin from My Projects" : "Pin to My Projects"}
            title={isPinned ? "Unpin from your starred projects" : "Star to add to your projects (shown first in quick task)"}
          >
            <Star className={isPinned ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4"} />
          </button>
          <div className="hidden items-center gap-1.5 lg:flex">
            <PresenceStack users={presenceUsers} />
            <Button variant="outline" size="sm" onClick={() => setMagicOpen(true)}>
              <Wand2 className="mr-2 h-4 w-4 text-primary" /> Magic Add
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Share
            </Button>
            {activeView && (
              <ViewOptions view={activeView} fields={fields} onChange={setConfig} />
            )}
            <ProjectActionsMenu projectId={projectId} />
            <Button variant="ghost" size="icon" asChild aria-label="Project settings">
              <Link to="/app/p/$projectId/settings" params={{ projectId }}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          {/* Mobile project actions */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Project settings"
            asChild
          >
            <Link to="/app/p/$projectId/settings" params={{ projectId }}>
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        </div>

        {/* Project sub-pages (tasks is the default landing; show only enabled tabs) */}
        <div data-tour="project-tabs"><ProjectSubNav projectId={projectId} enabledTabs={project.enabled_tabs} /></div>

        <ViewTabs
          views={views}
          activeId={activeViewId}
          onSelect={setActiveViewId}
          projectId={projectId}
        />
      </div>

      {activeView?.view_type === "table" && (
        <FilterBar
          filters={activeView.filters ?? []}
          sorts={activeView.sorts ?? []}
          groupBy={activeView.group_by}
          fields={fields}
          onFiltersChange={setFilters}
          onSortsChange={setSorts}
          onGroupByChange={setGroupBy}
          onSaveAsView={handleSaveAsView}
        />
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {isMobile && activeView?.view_type !== "kanban" ? (
          <MobileTaskList
            projectId={projectId}
            tasks={filteredTasks}
            onTaskClick={(id) => setSelectedTaskId(id)}
          />
        ) : (
          <>
            {(!activeView || activeView.view_type === "table") && (
              <TableView
                projectId={projectId}
                tasks={filteredTasks}
                fields={fields}
                groupBy={activeView?.group_by ?? null}
                viewConfig={activeView?.config ?? {}}
                onTaskClick={(id) => setSelectedTaskId(id)}
              />
            )}
            {activeView?.view_type === "kanban" && (
              <KanbanView
                projectId={projectId}
                tasks={filteredTasks}
                viewConfig={activeView.config ?? {}}
                onTaskClick={(id) => setSelectedTaskId(id)}
                presenceUsers={presenceUsers}
              />
            )}
            {activeView?.view_type === "canvas" && (
              <CanvasView
                projectId={projectId}
                viewId={activeView.id}
                tasks={filteredTasks}
                viewConfig={activeView.config ?? {}}
                onTaskClick={(id) => setSelectedTaskId(id)}
              />
            )}
            {activeView?.view_type === "calendar" && (
              <CalendarView
                projectId={projectId}
                tasks={filteredTasks}
                onTaskClick={(id) => setSelectedTaskId(id)}
              />
            )}
            {activeView?.view_type === "timeline" && (
              <TimelineView
                projectId={projectId}
                tasks={filteredTasks}
                onTaskClick={(id) => setSelectedTaskId(id)}
              />
            )}
            {activeView?.view_type === "sprint" && (
              <SprintView
                projectId={projectId}
                tasks={filteredTasks}
                viewConfig={activeView.config ?? {}}
                onTaskClick={(id) => setSelectedTaskId(id)}
              />
            )}
          </>
        )}
      </div>

      <TaskDetailPanel
        projectId={projectId}
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        fields={fields}
        viewKind={(activeView?.view_type as "table" | "kanban" | "canvas" | "calendar" | "timeline" | "sprint" | undefined) ?? "table"}
        orderedTaskIds={filteredTasks.map((t) => t.id)}
        onSelectTask={(id) => setSelectedTaskId(id)}
      />

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} projectName={project.name} />
      <MagicAddDialog open={magicOpen} onOpenChange={setMagicOpen} projectId={projectId} />
    </div>
  );
}

// Compact secondary nav for project sub-pages (Overview, Pages, Canvas, etc.).
// Renders below the title row so the action cluster stays clean. Active state
// is derived from the current router location.
function ProjectSubNav({
  projectId,
  enabledTabs,
}: {
  projectId: string;
  enabledTabs: string[] | null | undefined;
}) {
  const matches = useMatches();
  const pathname = matches[matches.length - 1]?.pathname ?? "";
  const tabs: { key: string; label: string; icon: typeof LayoutDashboard; to: string }[] = [
    { key: "tasks", label: "Tasks", icon: CheckSquare, to: `/app/p/${projectId}` },
    { key: "overview", label: "Overview", icon: LayoutDashboard, to: `/app/p/${projectId}/overview` },
    { key: "pages", label: "Pages", icon: FileText, to: `/app/p/${projectId}/pages` },
    { key: "canvas", label: "Canvas", icon: Sparkles, to: `/app/p/${projectId}/canvas` },
    { key: "chat", label: "Chat", icon: MessageSquare, to: `/app/p/${projectId}/chat` },
    { key: "status", label: "Status", icon: Activity, to: `/app/p/${projectId}/status` },
    { key: "baseline", label: "Baseline", icon: Camera, to: `/app/p/${projectId}/baseline` },
    { key: "approvals", label: "Approvals", icon: CheckSquare, to: `/app/p/${projectId}/approvals` },
    { key: "intake", label: "Intake", icon: FileText, to: `/app/p/${projectId}/intake` },
    { key: "requirements", label: "Requirements", icon: ListChecks, to: `/app/p/${projectId}/requirements` },
    { key: "dependencies", label: "Dependencies", icon: Link2, to: `/app/p/${projectId}/dependencies` },
  ];
  const visible = tabs.filter(
    (t) => t.key === "tasks" || isTabEnabled(enabledTabs, t.key as Parameters<typeof isTabEnabled>[1]),
  );
  if (visible.length <= 1) return null;
  return (
    <nav
      className="mt-3 -mb-1 flex items-center gap-0.5 overflow-x-auto border-b border-border/40 pb-0"
      aria-label="Project sections"
    >
      {visible.map((t) => {
        const Icon = t.icon;
        const active =
          t.key === "tasks"
            ? pathname === `/app/p/${projectId}` || pathname === `/app/p/${projectId}/`
            : pathname.startsWith(t.to);
        return (
          <Link
            key={t.key}
            to={t.to}
            className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-t-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
            {active && (
              <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
