import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useProject, useUpdateProject } from "@/hooks/use-projects";
import { useDivisions, useFolders } from "@/hooks/use-folders";
import { ChevronRight, Move } from "lucide-react";
import { MoveToFolderDialog } from "@/components/folders/MoveToFolderDialog";
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
import { Loader2, Settings, UserPlus, Wand2, LayoutDashboard } from "lucide-react";
import { ProjectActionsMenu } from "@/components/projects/ProjectActionsMenu";
import { Link } from "@tanstack/react-router";
import { useIsMobile } from "@/hooks/use-mobile-breakpoint";
import { useIsWorkspaceOwner } from "@/hooks/use-workspace-role";
import { toast } from "sonner";

export const Route = createFileRoute("/app/p/$projectId")({
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: divisions = [] } = useDivisions();
  const { data: allFolders = [] } = useFolders();
  const updateProject = useUpdateProject();
  const folderChain = useMemo(() => {
    const chain: { id: string; name: string }[] = [];
    let cur = project?.folder_id ? allFolders.find((f) => f.id === project.folder_id) : undefined;
    while (cur) {
      chain.unshift({ id: cur.id, name: cur.name });
      cur = cur.parent_id ? allFolders.find((f) => f.id === cur!.parent_id) : undefined;
    }
    return chain;
  }, [project?.folder_id, allFolders]);
  const division = divisions.find((d) => d.id === project?.division_id);
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
  });

  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [magicOpen, setMagicOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const isMobile = useIsMobile();
  const isOwner = useIsWorkspaceOwner();

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
        {(division || folderChain.length > 0) && (
          <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {division && (
              <>
                <Link to="/app/d/$divisionSlug" params={{ divisionSlug: division.slug }} className="hover:text-foreground">{division.name}</Link>
                <ChevronRight className="h-3 w-3" />
              </>
            )}
            {folderChain.map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <Link to="/app/f/$folderId" params={{ folderId: c.id }} className="hover:text-foreground">{c.name}</Link>
                <ChevronRight className="h-3 w-3" />
              </span>
            ))}
            <span className="text-foreground">{project.name}</span>
            <button
              type="button"
              onClick={() => setMoveOpen(true)}
              className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Move to folder"
            >
              <Move className="h-3 w-3" /> Move
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-base"
            style={{ backgroundColor: `${project.color}22`, color: project.color }}
          >
            <span className="text-lg font-semibold">{project.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold leading-tight lg:text-xl">{project.name}</h1>
            {project.description && (
              <p className="hidden truncate text-sm text-muted-foreground sm:block">{project.description}</p>
            )}
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <PresenceStack users={presenceUsers} />
            <Button variant="outline" size="sm" onClick={() => setMagicOpen(true)}>
              <Wand2 className="mr-2 h-4 w-4 text-primary" /> Magic Add
            </Button>
            <Button variant="ghost" size="sm" asChild title="Project overview">
              <Link to="/app/p/$projectId/overview" params={{ projectId }}>
                <LayoutDashboard className="mr-1.5 h-4 w-4" /> Overview
              </Link>
            </Button>
            <ProjectActionsMenu projectId={projectId} />
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Share
            </Button>
            {activeView && (
              <ViewOptions view={activeView} fields={fields} onChange={setConfig} />
            )}
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
        {isMobile && activeView?.view_type !== "table" ? (
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
      />

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} projectName={project.name} />
      <MagicAddDialog open={magicOpen} onOpenChange={setMagicOpen} projectId={projectId} />
    </div>
  );
}
