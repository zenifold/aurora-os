import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { Task, Project } from "@/lib/types";
import { STATUS_OPTIONS } from "@/lib/types";
import { format, isPast, parseISO } from "date-fns";
import { Briefcase, CheckCircle2, Inbox, Star, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportRowsToCSV } from "@/lib/exports";
import { useMemo, useState } from "react";
import { SavedViewsBar, type ActiveView } from "@/components/views/SavedViewsBar";
import { PRESETS, useSavedViews } from "@/hooks/use-saved-views";
import { applyFiltersAndSorts } from "@/lib/filtering";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/loading-scaffolds";
import { useProjects } from "@/hooks/use-projects";
import { useSidebarFavorites } from "@/hooks/use-sidebar-favorites";


export const Route = createFileRoute("/app/my-tasks")({
  component: MyWork,
});

function MyWork() {
  const { user } = useAuth();
  const ws = useWorkspaceStore((s) => s.current);
  const [active, setActive] = useState<ActiveView>({ kind: "preset", id: "my-open" });
  const { data: saved = [] } = useSavedViews();
  const { data: projects = [] } = useProjects();
  const { data: favorites = [] } = useSidebarFavorites();


  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["my-tasks-all", ws?.id, user?.id],
    enabled: !!user && !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const filtered = useMemo(() => {
    if (!user) return [];
    if (active.kind === "all") {
      return tasks.filter((t) => (t.assignee_ids ?? []).includes(user.id));
    }
    if (active.kind === "preset") {
      const preset = PRESETS.find((p) => p.id === active.id);
      if (!preset) return tasks;
      return tasks.filter((t) => preset.predicate(t, user.id));
    }
    const view = saved.find((v) => v.id === active.id);
    if (!view) return tasks;
    let base = tasks;
    if (view.scope === "mine") base = base.filter((t) => (t.assignee_ids ?? []).includes(user.id));
    return applyFiltersAndSorts(base, view.filters, view.sorts);
  }, [tasks, active, user, saved]);

  const favProjects = useMemo(() => {
    const ids = new Set(favorites.filter((f) => f.item_type === "project").map((f) => f.item_id));
    return projects.filter((p) => ids.has(p.id));
  }, [favorites, projects]);

  // Projects the user is monitoring/involved in via assigned tasks (excluding favorites already shown)
  const involvedProjects = useMemo(() => {
    if (!user) return [];
    const favIds = new Set(favProjects.map((p) => p.id));
    const ids = new Set<string>();
    tasks.forEach((t) => {
      if ((t.assignee_ids ?? []).includes(user.id) && t.project_id) ids.add(t.project_id);
    });
    return projects.filter((p) => ids.has(p.id) && !favIds.has(p.id));
  }, [tasks, user, projects, favProjects]);

  const activeLabel = useMemo(() => {
    if (active.kind === "all") return "Everything assigned to you";
    if (active.kind === "preset") return PRESETS.find((p) => p.id === active.id)?.name ?? "View";
    return saved.find((v) => v.id === active.id)?.name ?? "Saved view";
  }, [active, saved]);

  // Lightweight personal counters
  const myCounts = useMemo(() => {
    if (!user) return { total: 0, today: 0, overdue: 0, done: 0 };
    let total = 0, today = 0, overdue = 0, done = 0;
    const now = new Date();
    for (const t of tasks) {
      if (!(t.assignee_ids ?? []).includes(user.id)) continue;
      total++;
      if (t.status === "done") done++;
      if (t.due_date) {
        const d = parseISO(t.due_date);
        if (isPast(d) && t.status !== "done") overdue++;
        else if (d.toDateString() === now.toDateString()) today++;
      }
    }
    return { total, today, overdue, done };
  }, [tasks, user]);

  return (
    <div className="animate-page-in mx-auto w-full max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      <div className="flex items-center gap-3">
        <div className="icon-tile h-11 w-11">
          <Inbox className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-semibold tracking-tight lg:text-2xl">My Work</h1>
          <p className="text-xs text-muted-foreground lg:text-sm">
            Tasks, projects, and spaces you care about · {ws?.name}
          </p>
        </div>
      </div>

      {/* Personal pulse strip */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Open", value: myCounts.total - myCounts.done, tone: "text-foreground" },
          { label: "Due today", value: myCounts.today, tone: "text-primary" },
          { label: "Overdue", value: myCounts.overdue, tone: "text-destructive" },
          { label: "Done", value: myCounts.done, tone: "text-emerald-500" },
        ].map((s) => (
          <div key={s.label} className="surface-card animate-count-in flex flex-col gap-1 p-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{s.label}</span>
            <span className={`font-display text-2xl font-semibold tabular-nums ${s.tone}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Saved / favorited */}
      {favProjects.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> Saved
          </h2>
          <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {favProjects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}


      {/* Monitoring / involved */}
      {involvedProjects.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Monitoring
          </h2>
          <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {involvedProjects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}

      {/* Tasks */}
      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tasks · {activeLabel}
          </h2>
          <Button
            variant="outline"
            size="sm"
            disabled={filtered.length === 0}
            onClick={() => {
              const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "";
              exportRowsToCSV(
                `tasks-${new Date().toISOString().slice(0, 10)}.csv`,
                filtered.map((t) => ({
                  title: t.title,
                  project: projectName(t.project_id),
                  status: t.status,
                  priority: t.priority,
                  due_date: t.due_date ?? "",
                  start_date: t.start_date ?? "",
                  tags: (t.tags ?? []).join("; "),
                })),
                [
                  { key: "title", label: "Title" },
                  { key: "project", label: "Project" },
                  { key: "status", label: "Status" },
                  { key: "priority", label: "Priority" },
                  { key: "due_date", label: "Due" },
                  { key: "start_date", label: "Start" },
                  { key: "tags", label: "Tags" },
                ],
              );
            }}
          >
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>
        <SavedViewsBar active={active} onChange={setActive} />

        {isLoading ? (
          <div className="mt-4">
            <ListSkeleton rows={6} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All clear"
            description="Nothing matches this view right now."
            className="mt-4"
          />
        ) : (
          <div className="mt-4 rounded-xl border border-border bg-card">
            <ul className="divide-y divide-border">
              {filtered.map((t) => {
                const status = STATUS_OPTIONS.find((s) => s.value === t.status);
                const overdue =
                  t.due_date && isPast(parseISO(t.due_date)) && t.status !== "done";
                return (
                  <li key={t.id}>
                    <Link
                      to="/app/p/$projectId"
                      params={{ projectId: t.project_id }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: status?.color ?? "var(--status-todo)" }}
                      />
                      <span className="flex-1 truncate text-sm">{t.title}</span>
                      {t.due_date && (
                        <span
                          className={`text-xs ${
                            overdue ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {format(parseISO(t.due_date), "MMM d")}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to="/app/p/$projectId"
      params={{ projectId: project.id }}
      className="group hover-lift press flex w-[60vw] max-w-[260px] shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm hover:border-primary/40 sm:w-auto sm:max-w-none sm:shrink"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${project.color}22` }}
      >
        <Briefcase className="h-3.5 w-3.5" style={{ color: project.color }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{project.name}</div>
        {project.client_name && (
          <div className="truncate text-[11px] text-muted-foreground">{project.client_name}</div>
        )}
      </div>
    </Link>
  );
}

