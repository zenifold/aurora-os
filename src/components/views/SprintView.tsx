import { useMemo, useState } from "react";
import { useSprints, useSprintTasks, useAddTaskToSprint, useRemoveTaskFromSprint, useCreateSprint } from "@/hooks/use-sprints";
import { supabase } from "@/integrations/supabase/client";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import type { Task, ViewConfig } from "@/lib/types";
import type { Sprint, SprintTask } from "@/lib/sprint-types";
import { SPRINT_STATUS_META } from "@/lib/sprint-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssigneeAvatars } from "@/components/tasks/AssigneeAvatars";
import { Plus, X, Target, Sparkles, ArrowRight, Inbox, Wand2, Calendar } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  projectId: string;
  tasks: Task[];
  viewConfig: ViewConfig;
  onTaskClick: (id: string) => void;
}

type Lane = "backlog" | "grooming" | "next" | "active";

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-amber-400",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

export function SprintView({ projectId, tasks, onTaskClick }: Props) {
  const { data: sprints = [] } = useSprints(projectId);
  const qc = useQueryClient();

  const activeSprint = sprints.find((s) => s.status === "active") ?? null;
  const planningSprints = sprints.filter((s) => s.status === "planning");
  const [nextSprintId, setNextSprintId] = useState<string | null>(planningSprints[0]?.id ?? null);
  const nextSprint = sprints.find((s) => s.id === nextSprintId) ?? planningSprints[0] ?? null;

  // Pull sprint_tasks for the displayed sprints
  const sprintIds = [activeSprint?.id, nextSprint?.id].filter(Boolean) as string[];
  const linkQueries = useQueries({
    queries: sprintIds.map((sid) => ({
      queryKey: ["sprint_tasks", sid],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("sprint_tasks" as never)
          .select("*")
          .eq("sprint_id", sid);
        if (error) throw error;
        return (data ?? []) as unknown as SprintTask[];
      },
    })),
  });

  // Also pull all sprint links for this project to know which tasks are claimed elsewhere
  const allLinksQuery = useQueries({
    queries: sprints.map((s) => ({
      queryKey: ["sprint_tasks", s.id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("sprint_tasks" as never)
          .select("*")
          .eq("sprint_id", s.id);
        if (error) throw error;
        return (data ?? []) as unknown as SprintTask[];
      },
    })),
  });

  const allLinkedTaskIds = useMemo(() => {
    const set = new Set<string>();
    allLinksQuery.forEach((q) => (q.data ?? []).forEach((l) => set.add(l.task_id)));
    return set;
  }, [allLinksQuery]);

  const activeLinks = useMemo(() => {
    const idx = sprintIds.indexOf(activeSprint?.id ?? "");
    return idx >= 0 ? linkQueries[idx]?.data ?? [] : [];
  }, [linkQueries, sprintIds, activeSprint]);

  const nextLinks = useMemo(() => {
    const idx = sprintIds.indexOf(nextSprint?.id ?? "");
    return idx >= 0 ? linkQueries[idx]?.data ?? [] : [];
  }, [linkQueries, sprintIds, nextSprint]);

  const activeLinkedIds = useMemo(() => new Set(activeLinks.map((l) => l.task_id)), [activeLinks]);
  const nextLinkedIds = useMemo(() => new Set(nextLinks.map((l) => l.task_id)), [nextLinks]);

  // Lane allocation
  const isUngroomed = (t: Task) =>
    !t.due_date && (!t.tags || t.tags.length === 0) && !t.priority;

  const lanes = useMemo(() => {
    const backlog: Task[] = [];
    const grooming: Task[] = [];
    const next: Task[] = [];
    const active: Task[] = [];
    for (const t of tasks) {
      if (t.status === "done" || t.status === "cancelled") continue;
      if (activeLinkedIds.has(t.id)) {
        active.push(t);
      } else if (nextLinkedIds.has(t.id)) {
        next.push(t);
      } else if (allLinkedTaskIds.has(t.id)) {
        // assigned to another sprint - skip from these lanes
        continue;
      } else if (!t.priority || t.priority === "low" || isUngroomed(t)) {
        grooming.push(t);
      } else {
        backlog.push(t);
      }
    }
    const sortFn = (a: Task, b: Task) => {
      const order = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
    };
    return {
      backlog: backlog.sort(sortFn),
      grooming: grooming.sort(sortFn),
      next: next.sort(sortFn),
      active: active.sort(sortFn),
    };
  }, [tasks, activeLinkedIds, nextLinkedIds, allLinkedTaskIds]);

  const addToActive = useAddTaskToSprint(activeSprint?.id ?? "", projectId);
  const removeFromActive = useRemoveTaskFromSprint(activeSprint?.id ?? "", projectId);
  const addToNext = useAddTaskToSprint(nextSprint?.id ?? "", projectId);
  const removeFromNext = useRemoveTaskFromSprint(nextSprint?.id ?? "", projectId);

  const moveTo = (taskId: string, target: Lane, fromLane: Lane) => {
    // remove from current sprint container if needed
    if (fromLane === "active" && activeSprint) removeFromActive.mutate(taskId);
    if (fromLane === "next" && nextSprint) removeFromNext.mutate(taskId);
    // add to target
    if (target === "active" && activeSprint) addToActive.mutate({ task_id: taskId });
    if (target === "next" && nextSprint) addToNext.mutate({ task_id: taskId });
    if (target === "next" && !nextSprint) {
      toast.error("Create a planning sprint first");
    }
    if (target === "active" && !activeSprint) {
      toast.error("Start an active sprint first");
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string, lane: Lane) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ taskId, lane }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, target: Lane) => {
    e.preventDefault();
    try {
      const { taskId, lane } = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (lane === target) return;
      moveTo(taskId, target, lane);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex h-full flex-col">
      <SprintHeader
        projectId={projectId}
        sprints={sprints}
        activeSprint={activeSprint}
        nextSprint={nextSprint}
        onSelectNext={setNextSprintId}
        nextLane={lanes.next}
        activeLane={lanes.active}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-4 lg:p-4">
        <Lane
          title="Grooming"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          tone="muted"
          description="Needs priority, scope or estimate"
          tasks={lanes.grooming}
          laneId="grooming"
          onTaskClick={onTaskClick}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          actions={(t) => (
            <>
              {nextSprint && (
                <LaneAction
                  icon={<ArrowRight className="h-3 w-3" />}
                  label={`To ${nextSprint.name}`}
                  onClick={() => moveTo(t.id, "next", "grooming")}
                />
              )}
            </>
          )}
        />
        <Lane
          title="Backlog"
          icon={<Inbox className="h-3.5 w-3.5" />}
          tone="muted"
          description="Ready, prioritized, awaiting a sprint"
          tasks={lanes.backlog}
          laneId="backlog"
          onTaskClick={onTaskClick}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          actions={(t) => (
            <>
              {nextSprint && (
                <LaneAction
                  icon={<ArrowRight className="h-3 w-3" />}
                  label={`To ${nextSprint.name}`}
                  onClick={() => moveTo(t.id, "next", "backlog")}
                />
              )}
            </>
          )}
        />
        <Lane
          title={nextSprint ? `Next: ${nextSprint.name}` : "Next sprint"}
          icon={<Target className="h-3.5 w-3.5" />}
          tone="primary"
          description={
            nextSprint
              ? `${format(new Date(nextSprint.start_date), "MMM d")} – ${format(
                  new Date(nextSprint.end_date),
                  "MMM d",
                )}`
              : "Plan upcoming work"
          }
          tasks={lanes.next}
          laneId="next"
          empty={
            !nextSprint && (
              <CreateSprintInlineButton projectId={projectId} onCreated={setNextSprintId} />
            )
          }
          capacityHours={nextSprint?.capacity_hours ?? null}
          plannedCount={lanes.next.length}
          onTaskClick={onTaskClick}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          actions={(t) => (
            <>
              <LaneAction
                icon={<X className="h-3 w-3" />}
                label="Remove from sprint"
                onClick={() => moveTo(t.id, "backlog", "next")}
              />
              {activeSprint && (
                <LaneAction
                  icon={<ArrowRight className="h-3 w-3" />}
                  label="Promote to active"
                  onClick={() => moveTo(t.id, "active", "next")}
                />
              )}
            </>
          )}
        />
        <Lane
          title={activeSprint ? `Active: ${activeSprint.name}` : "Active sprint"}
          icon={<Target className="h-3.5 w-3.5" />}
          tone="success"
          description={
            activeSprint
              ? `${format(new Date(activeSprint.start_date), "MMM d")} – ${format(
                  new Date(activeSprint.end_date),
                  "MMM d",
                )}`
              : "No sprint in flight"
          }
          tasks={lanes.active}
          laneId="active"
          plannedCount={lanes.active.length}
          capacityHours={activeSprint?.capacity_hours ?? null}
          onTaskClick={onTaskClick}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          actions={(t) => (
            <LaneAction
              icon={<X className="h-3 w-3" />}
              label="Remove from sprint"
              onClick={() => moveTo(t.id, "backlog", "active")}
            />
          )}
        />
      </div>
    </div>
  );
}

function SprintHeader({
  projectId,
  sprints,
  activeSprint,
  nextSprint,
  onSelectNext,
  nextLane,
  activeLane,
}: {
  projectId: string;
  sprints: Sprint[];
  activeSprint: Sprint | null;
  nextSprint: Sprint | null;
  onSelectNext: (id: string) => void;
  nextLane: Task[];
  activeLane: Task[];
}) {
  const planning = sprints.filter((s) => s.status === "planning");

  const dayProgress = activeSprint
    ? (() => {
        const total = differenceInCalendarDays(new Date(activeSprint.end_date), new Date(activeSprint.start_date));
        const elapsed = Math.max(
          0,
          Math.min(total, differenceInCalendarDays(new Date(), new Date(activeSprint.start_date))),
        );
        return total > 0 ? Math.round((elapsed / total) * 100) : 0;
      })()
    : 0;

  const nextCapacityPct =
    nextSprint?.capacity_hours && nextSprint.capacity_hours > 0
      ? Math.round(((nextSprint.planned_hours ?? 0) / nextSprint.capacity_hours) * 100)
      : null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/20 px-3 py-2.5 lg:px-4">
      <div className="flex items-center gap-2 text-sm">
        <Target className="h-4 w-4 text-primary" />
        <span className="font-medium">Sprint planning</span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        {/* Active sprint */}
        {activeSprint ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs">
            <span className="text-emerald-700 dark:text-emerald-400">●</span>
            <span className="font-medium">{activeSprint.name}</span>
            <span className="text-muted-foreground">· {activeLane.length} tasks</span>
            <Progress value={dayProgress} className="h-1 w-16" />
          </div>
        ) : (
          <Badge variant="outline" className="text-xs">No active sprint</Badge>
        )}

        {/* Next sprint selector */}
        {planning.length > 1 ? (
          <Select value={nextSprint?.id ?? ""} onValueChange={onSelectNext}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Pick planning sprint" />
            </SelectTrigger>
            <SelectContent>
              {planning.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : nextSprint ? (
          <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs">
            <Calendar className="h-3 w-3 text-primary" />
            <span className="font-medium">{nextSprint.name}</span>
            <span className="text-muted-foreground">· {nextLane.length} tasks</span>
            {nextCapacityPct !== null && (
              <span
                className={cn(
                  "rounded px-1 text-[10px] font-medium",
                  nextCapacityPct > 100
                    ? "bg-destructive/10 text-destructive"
                    : nextCapacityPct > 80
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {nextCapacityPct}% cap
              </span>
            )}
          </div>
        ) : (
          <CreateSprintInlineButton projectId={projectId} onCreated={onSelectNext} />
        )}
      </div>
    </div>
  );
}

function CreateSprintInlineButton({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: (id: string) => void;
}) {
  const create = useCreateSprint(projectId);
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const twoWeeks = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: "",
    goal: "",
    start_date: today,
    end_date: twoWeeks,
    capacity_hours: "",
  });

  const submit = async () => {
    if (!form.name.trim()) return;
    const res = await create.mutateAsync({
      name: form.name.trim(),
      goal: form.goal.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date,
      capacity_hours: form.capacity_hours ? Number(form.capacity_hours) : null,
    });
    onCreated(res.id);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New sprint
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New planning sprint</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              autoFocus
              value={form.name}
              placeholder="Sprint 12"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Goal</Label>
            <Textarea
              rows={2}
              value={form.goal}
              placeholder="Outcome you want to achieve"
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Capacity (hours)</Label>
            <Input
              type="number"
              min={0}
              placeholder="80"
              value={form.capacity_hours}
              onChange={(e) => setForm({ ...form, capacity_hours: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!form.name.trim() || create.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Lane({
  title,
  icon,
  description,
  tone,
  tasks,
  laneId,
  empty,
  capacityHours,
  plannedCount,
  onTaskClick,
  onDragStart,
  onDrop,
  actions,
}: {
  title: string;
  icon: React.ReactNode;
  description?: string;
  tone: "muted" | "primary" | "success";
  tasks: Task[];
  laneId: Lane;
  empty?: React.ReactNode;
  capacityHours?: number | null;
  plannedCount?: number;
  onTaskClick: (id: string) => void;
  onDragStart: (e: React.DragEvent, taskId: string, lane: Lane) => void;
  onDrop: (e: React.DragEvent, target: Lane) => void;
  actions?: (t: Task) => React.ReactNode;
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/30 bg-primary/5"
      : tone === "success"
        ? "border-emerald-500/20 bg-emerald-500/5"
        : "border-border bg-muted/20";

  return (
    <div
      className={cn("flex min-h-0 flex-col rounded-lg border", toneClass)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, laneId)}
    >
      <div className="flex items-start justify-between border-b border-border/50 px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {icon}
            <span className="truncate">{title}</span>
            <Badge variant="secondary" className="text-[10px]">{tasks.length}</Badge>
          </div>
          {description && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-1.5 overflow-auto p-2">
        {tasks.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            {empty ?? "Empty"}
          </div>
        ) : (
          tasks.map((t) => (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => onDragStart(e, t.id, laneId)}
              onClick={() => onTaskClick(t.id)}
              className="group cursor-grab rounded-md border border-border bg-card p-2 text-sm shadow-sm transition-all hover:border-primary/40 hover:shadow active:cursor-grabbing"
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    PRIORITY_DOT[t.priority] ?? "bg-slate-400",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 pl-3.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  {t.due_date && (
                    <span className="flex items-center gap-0.5">
                      <Calendar className="h-2.5 w-2.5" />
                      {format(new Date(t.due_date), "MMM d")}
                    </span>
                  )}
                  {t.tags && t.tags.length > 0 && (
                    <span className="truncate">#{t.tags[0]}</span>
                  )}
                </div>
                <AssigneeAvatars ids={t.assignee_ids ?? []} max={2} size={18} />
              </div>
              {actions && (
                <div
                  className="mt-1.5 flex flex-wrap gap-1 pl-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {actions(t)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LaneAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
    >
      {icon}
      {label}
    </button>
  );
}
