import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useProject } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { useViews, useUpdateView, useCreateView } from "@/hooks/use-views";
import { useCustomFields } from "@/hooks/use-custom-fields";
import { useUIStore } from "@/stores/ui-store";
import { TableView } from "@/components/views/TableView";
import { KanbanView } from "@/components/views/KanbanView";
import { CalendarView } from "@/components/views/CalendarView";
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
import { Loader2, Settings, UserPlus, Wand2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/p/$projectId")({
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
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

  const setFilters = (filters: Filter[]) => {
    if (activeView) updateView.mutate({ id: activeView.id, filters });
  };
  const setSorts = (sorts: Sort[]) => {
    if (activeView) updateView.mutate({ id: activeView.id, sorts });
  };
  const setGroupBy = (group_by: string | null) => {
    if (activeView) updateView.mutate({ id: activeView.id, group_by });
  };
  const setConfig = (config: ViewConfig) => {
    if (activeView) updateView.mutate({ id: activeView.id, config });
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
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-base"
            style={{ backgroundColor: `${project.color}22`, color: project.color }}
          >
            <span className="text-lg font-semibold">{project.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold leading-tight">{project.name}</h1>
            {project.description && (
              <p className="truncate text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
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
          <Button variant="ghost" size="icon" asChild aria-label="Project settings">
            <Link to="/app/p/$projectId/settings" params={{ projectId }}>
              <Settings className="h-4 w-4" />
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
        {(!activeView || activeView.view_type === "table") && (
          <TableView
            projectId={projectId}
            tasks={filteredTasks}
            fields={fields}
            groupBy={activeView?.group_by ?? null}
            onTaskClick={(id) => setSelectedTaskId(id)}
          />
        )}
        {activeView?.view_type === "kanban" && (
          <KanbanView
            projectId={projectId}
            tasks={filteredTasks}
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
