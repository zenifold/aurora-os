import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useProject } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { useViews, useUpdateView, useCreateView } from "@/hooks/use-views";
import { useCustomFields } from "@/hooks/use-custom-fields";
import { useUIStore } from "@/stores/ui-store";
import { TableView } from "@/components/views/TableView";
import { ViewTabs } from "@/components/views/ViewTabs";
import { FilterBar } from "@/components/views/FilterBar";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { applyFiltersAndSorts } from "@/lib/filtering";
import type { Filter, Sort, View } from "@/lib/types";
import { Loader2 } from "lucide-react";

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

  const [activeViewId, setActiveViewId] = useState<string | null>(null);

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
          <div>
            <h1 className="text-xl font-semibold leading-tight">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>
        <ViewTabs
          views={views}
          activeId={activeViewId}
          onSelect={setActiveViewId}
          projectId={projectId}
        />
      </div>

      {activeView && (
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
        <TableView
          projectId={projectId}
          tasks={filteredTasks}
          fields={fields}
          groupBy={activeView?.group_by ?? null}
          onTaskClick={(id) => setSelectedTaskId(id)}
        />
      </div>

      <TaskDetailPanel
        projectId={projectId}
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        fields={fields}
      />
    </div>
  );
}
