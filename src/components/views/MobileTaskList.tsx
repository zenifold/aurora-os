import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { PRIORITY_OPTIONS } from "@/lib/types";
import { useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { useProjectWorkflow, DEFAULT_WORKFLOW } from "@/hooks/use-project-workflow";
import { useUIStore } from "@/stores/ui-store";
import { SwipeRow } from "@/components/app/SwipeRow";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Trash2, Inbox, Calendar as CalendarIcon } from "lucide-react";
import { format, isPast, isToday, isTomorrow, parseISO, addDays, isBefore } from "date-fns";
import { haptic } from "@/lib/haptics";

interface Props {
  projectId: string;
  tasks: Task[];
  onTaskClick?: (id: string) => void;
}

type Bucket = "Overdue" | "Today" | "Tomorrow" | "This week" | "Later" | "No date";
const ORDER: Bucket[] = ["Overdue", "Today", "Tomorrow", "This week", "Later", "No date"];

function bucketFor(t: Task): Bucket {
  if (!t.due_date) return "No date";
  const d = parseISO(t.due_date);
  if (isToday(d)) return "Today";
  if (isPast(d)) return "Overdue";
  if (isTomorrow(d)) return "Tomorrow";
  if (isBefore(d, addDays(new Date(), 7))) return "This week";
  return "Later";
}

export function MobileTaskList({ projectId, tasks, onTaskClick }: Props) {
  const update = useUpdateTask(projectId);
  const remove = useDeleteTask(projectId);
  const { data: workflow = DEFAULT_WORKFLOW } = useProjectWorkflow(projectId);
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);

  const groups = useMemo(() => {
    const m = new Map<Bucket, Task[]>();
    for (const b of ORDER) m.set(b, []);
    for (const t of tasks) m.get(bucketFor(t))!.push(t);
    return m;
  }, [tasks]);

  const handleClick = (id: string) => {
    haptic("tap");
    if (onTaskClick) onTaskClick(id);
    else setSelectedTaskId(id);
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-aura-gradient-subtle">
          <Inbox className="h-6 w-6 text-aura-gradient" />
        </div>
        <p className="text-sm font-medium">All caught up</p>
        <p className="mt-1 text-xs text-muted-foreground">No tasks here yet.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {ORDER.map((bucket) => {
        const list = groups.get(bucket) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={bucket}>
            <h2 className="sticky top-14 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
              <span className={bucket === "Overdue" ? "text-destructive" : ""}>
                {bucket}
              </span>
              <span>{list.length}</span>
            </h2>
            {list.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                workflow={workflow}
                onComplete={() => {
                  haptic("success");
                  const doneStatus =
                    workflow.find((s) => s.id === "done")?.id ??
                    workflow[workflow.length - 1]?.id ??
                    "done";
                  update.mutate({ id: t.id, status: doneStatus });
                }}
                onDelete={() => {
                  haptic("warn");
                  remove.mutate(t.id);
                }}
                onClick={() => handleClick(t.id)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function TaskRow({
  task,
  workflow,
  onComplete,
  onDelete,
  onClick,
}: {
  task: Task;
  workflow: { id: string; name: string; color: string }[];
  onComplete: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const status = workflow.find((s) => s.id === task.status);
  const priority = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
  const isDone = task.status === "done";

  return (
    <SwipeRow
      leftAction={{
        label: "Done",
        icon: <Check className="h-4 w-4" />,
        color: "bg-emerald-600",
        onAction: onComplete,
      }}
      rightActions={[
        {
          label: "Delete",
          icon: <Trash2 className="h-4 w-4" />,
          color: "bg-destructive",
          onAction: onDelete,
        },
      ]}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-accent/40"
      >
        <Checkbox
          checked={isDone}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={() => onComplete()}
          className="mt-0.5 h-5 w-5"
        />
        <div className="min-w-0 flex-1">
          <p
            className={`line-clamp-2 text-sm ${
              isDone ? "text-muted-foreground line-through" : "font-medium"
            }`}
          >
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {status && (
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: status.color }}
                />
                {status.name}
              </span>
            )}
            {task.due_date && (
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {format(parseISO(task.due_date), "MMM d")}
              </span>
            )}
          </div>
        </div>
        {priority && (
          <span
            className="mt-1 h-2 w-2 shrink-0 rounded-full"
            style={{ background: priority.color }}
            aria-label={priority.label}
          />
        )}
      </button>
    </SwipeRow>
  );
}
