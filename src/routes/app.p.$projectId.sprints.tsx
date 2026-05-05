import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useProject } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import {
  useSprints,
  useSprintTasks,
  useCreateSprint,
  useUpdateSprint,
  useDeleteSprint,
  useAddTaskToSprint,
  useRemoveTaskFromSprint,
} from "@/hooks/use-sprints";
import { SPRINT_STATUS_META, type Sprint } from "@/lib/sprint-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Calendar, Plus, Trash2, Target, Loader2, X } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/p/$projectId/sprints")({
  component: SprintsPage,
});

function SprintsPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: sprints = [], isLoading } = useSprints(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const active = useMemo(
    () => sprints.find((s) => s.id === activeId) ?? sprints[0] ?? null,
    [sprints, activeId],
  );

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
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/app/p/$projectId" params={{ projectId }}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {project.name}
            </div>
            <h1 className="text-lg font-semibold lg:text-xl">Sprints</h1>
          </div>
          <CreateSprintDialog
            projectId={projectId}
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={(id) => setActiveId(id)}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-border bg-muted/20 lg:border-b-0 lg:border-r">
          {sprints.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No sprints yet. Create your first one to start planning.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {sprints.map((s) => {
                const meta = SPRINT_STATUS_META[s.status];
                const isActive = active?.id === s.id;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setActiveId(s.id)}
                      className={cn(
                        "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                        isActive && "bg-muted",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{s.name}</span>
                        <Badge variant="secondary" className={cn("text-[10px]", meta.tone)}>
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(s.start_date), "MMM d")} –{" "}
                        {format(new Date(s.end_date), "MMM d")}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <main className="min-h-0 overflow-auto">
          {active ? (
            <SprintDetail sprint={active} projectId={projectId} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
              <Target className="h-10 w-10 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-semibold">Plan your first sprint</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Group tasks into a timeboxed sprint. Track capacity in hours and points,
                  monitor burndown, and ship predictably.
                </p>
              </div>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New sprint
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function CreateSprintDialog({
  projectId,
  open,
  onOpenChange,
  onCreated,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const create = useCreateSprint(projectId);
  const today = new Date().toISOString().slice(0, 10);
  const twoWeeks = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: "",
    goal: "",
    start_date: today,
    end_date: twoWeeks,
    capacity_hours: "",
    capacity_points: "",
  });

  const submit = async () => {
    if (!form.name.trim()) return;
    const res = await create.mutateAsync({
      name: form.name.trim(),
      goal: form.goal.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date,
      capacity_hours: form.capacity_hours ? Number(form.capacity_hours) : null,
      capacity_points: form.capacity_points ? Number(form.capacity_points) : null,
    });
    onCreated(res.id);
    onOpenChange(false);
    setForm({
      name: "",
      goal: "",
      start_date: today,
      end_date: twoWeeks,
      capacity_hours: "",
      capacity_points: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New sprint
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New sprint</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sprint-name">Name</Label>
            <Input
              id="sprint-name"
              placeholder="Sprint 1: Foundations"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sprint-goal">Goal (optional)</Label>
            <Textarea
              id="sprint-goal"
              placeholder="What outcome will this sprint deliver?"
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sprint-start">Start</Label>
              <Input
                id="sprint-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sprint-end">End</Label>
              <Input
                id="sprint-end"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sprint-cap-hours">Capacity hours</Label>
              <Input
                id="sprint-cap-hours"
                type="number"
                min={0}
                placeholder="80"
                value={form.capacity_hours}
                onChange={(e) => setForm({ ...form, capacity_hours: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sprint-cap-points">Capacity points</Label>
              <Input
                id="sprint-cap-points"
                type="number"
                min={0}
                placeholder="40"
                value={form.capacity_points}
                onChange={(e) => setForm({ ...form, capacity_points: e.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!form.name.trim() || create.isPending}>
            Create sprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SprintDetail({ sprint, projectId }: { sprint: Sprint; projectId: string }) {
  const { data: tasks = [] } = useTasks(projectId);
  const { data: links = [] } = useSprintTasks(sprint.id);
  const update = useUpdateSprint(projectId);
  const remove = useDeleteSprint(projectId);
  const addTask = useAddTaskToSprint(sprint.id, projectId);
  const removeTask = useRemoveTaskFromSprint(sprint.id, projectId);
  const [planning, setPlanning] = useState(sprint.status === "planning");

  const linkedIds = useMemo(() => new Set(links.map((l) => l.task_id)), [links]);
  const sprintTasks = useMemo(
    () => tasks.filter((t) => linkedIds.has(t.id)),
    [tasks, linkedIds],
  );
  const backlog = useMemo(
    () => tasks.filter((t) => !linkedIds.has(t.id) && t.status !== "done"),
    [tasks, linkedIds],
  );

  const totalDays = differenceInCalendarDays(new Date(sprint.end_date), new Date(sprint.start_date));
  const elapsed = Math.max(
    0,
    Math.min(totalDays, differenceInCalendarDays(new Date(), new Date(sprint.start_date))),
  );
  const progressPct = totalDays > 0 ? Math.round((elapsed / totalDays) * 100) : 0;

  const completedCount = sprintTasks.filter((t) => t.status === "done").length;
  const completionPct =
    sprintTasks.length > 0 ? Math.round((completedCount / sprintTasks.length) * 100) : 0;

  const capacityPct =
    sprint.capacity_hours && sprint.capacity_hours > 0
      ? Math.round((sprint.planned_hours / sprint.capacity_hours) * 100)
      : null;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{sprint.name}</h2>
            <Badge
              variant="secondary"
              className={cn("text-xs", SPRINT_STATUS_META[sprint.status].tone)}
            >
              {SPRINT_STATUS_META[sprint.status].label}
            </Badge>
          </div>
          {sprint.goal && <p className="text-sm text-muted-foreground">{sprint.goal}</p>}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {format(new Date(sprint.start_date), "MMM d, yyyy")} –{" "}
            {format(new Date(sprint.end_date), "MMM d, yyyy")} · {totalDays} days
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sprint.status}
            onValueChange={(v) =>
              update.mutate({ id: sprint.id, status: v as Sprint["status"] })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["planning", "active", "completed", "cancelled"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {SPRINT_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={planning ? "default" : "outline"}
            size="sm"
            onClick={() => setPlanning((p) => !p)}
          >
            {planning ? "Done planning" : "Plan sprint"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Delete sprint">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this sprint?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tasks remain in the project. Only the sprint container and burndown history
                  are removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => remove.mutate(sprint.id)}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Progress"
          value={`${completedCount} / ${sprintTasks.length}`}
          sub={`${completionPct}% complete`}
          progress={completionPct}
        />
        <StatCard
          label="Timebox"
          value={`Day ${elapsed} / ${totalDays}`}
          sub={`${progressPct}% elapsed`}
          progress={progressPct}
        />
        <StatCard
          label="Hours"
          value={
            sprint.capacity_hours
              ? `${sprint.planned_hours} / ${sprint.capacity_hours}h`
              : `${sprint.planned_hours}h`
          }
          sub={
            capacityPct === null
              ? "No capacity set"
              : capacityPct > 100
                ? `Overcommitted by ${capacityPct - 100}%`
                : `${capacityPct}% capacity`
          }
          progress={capacityPct ?? 0}
          tone={
            capacityPct === null
              ? undefined
              : capacityPct > 100
                ? "danger"
                : capacityPct > 80
                  ? "warning"
                  : "ok"
          }
        />
        <StatCard
          label="Points"
          value={
            sprint.capacity_points
              ? `${sprint.planned_points} / ${sprint.capacity_points}`
              : `${sprint.planned_points}`
          }
          sub={`${sprint.completed_points} completed`}
          progress={
            sprint.capacity_points && sprint.capacity_points > 0
              ? Math.round((sprint.planned_points / sprint.capacity_points) * 100)
              : 0
          }
        />
      </div>

      {/* Body */}
      {planning ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Backlog</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Click a task to add it to this sprint.
            </p>
            <div className="space-y-1.5">
              {backlog.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No unassigned tasks.
                </div>
              ) : (
                backlog.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => addTask.mutate({ task_id: t.id })}
                    className="group flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/50"
                  >
                    <span className="truncate">{t.title}</span>
                    <Plus className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))
              )}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">In sprint ({sprintTasks.length})</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Click the × to return a task to the backlog.
            </p>
            <div className="space-y-1.5">
              {sprintTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No tasks committed yet.
                </div>
              ) : (
                sprintTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="truncate">{t.title}</span>
                    <button
                      onClick={() => removeTask.mutate(t.id)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Remove from sprint"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h3 className="mb-3 text-sm font-semibold">
            Sprint backlog ({sprintTasks.length})
          </h3>
          {sprintTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No tasks in this sprint yet.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setPlanning(true)}>
                Plan sprint
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {sprintTasks.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-border bg-card p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{t.title}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.status}
                    </Badge>
                  </div>
                  {t.due_date && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Due {format(new Date(t.due_date), "MMM d")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  progress,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  progress: number;
  tone?: "ok" | "warning" | "danger";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      <div className="mt-2">
        <Progress
          value={Math.min(100, Math.max(0, progress))}
          className={cn(
            "h-1.5",
            tone === "danger" && "[&>div]:bg-rose-500",
            tone === "warning" && "[&>div]:bg-amber-500",
            tone === "ok" && "[&>div]:bg-emerald-500",
          )}
        />
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
