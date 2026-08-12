import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { PRIORITY_OPTIONS } from "@/lib/types";
import { useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { useProjectWorkflow, DEFAULT_WORKFLOW } from "@/hooks/use-project-workflow";
import { useProjectRelationIndicators } from "@/hooks/use-task-relations";
import { getTaskTypeMeta } from "@/lib/task-types";
import { useUIStore } from "@/stores/ui-store";
import { SwipeRow } from "@/components/app/SwipeRow";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Check,
  Trash2,
  Inbox,
  Calendar as CalendarIcon,
  Rows3,
  Rows2,
  ArrowLeftCircle,
  ArrowRightCircle,
} from "lucide-react";
import { format, isPast, isToday, isTomorrow, parseISO, addDays, isBefore } from "date-fns";
import { haptic } from "@/lib/haptics";
import { AssigneeAvatars } from "@/components/tasks/AssigneeAvatars";
import { useUserPreferences, useUpdateUserPreferences } from "@/hooks/use-user-preferences";

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
  const { data: indicators } = useProjectRelationIndicators(projectId);
  const getIndicator = (id: string) => {
    if (!indicators) return undefined;
    if (typeof (indicators as { get?: unknown }).get === "function") {
      return (indicators as Map<string, { blockedBy: number; blocking: number }>).get(id);
    }
    return (indicators as unknown as Record<string, { blockedBy: number; blocking: number }>)[id];
  };
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);
  const { data: prefs } = useUserPreferences();
  const updatePrefs = useUpdateUserPreferences();
  const isCompact = prefs?.density === "compact" || prefs?.density === "ultra";

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
      <div className="flex items-center justify-between gap-2 border-b border-border bg-background px-4 py-1.5 text-[11px] text-muted-foreground">
        <span>{tasks.length} task{tasks.length === 1 ? "" : "s"}</span>
        <button
          type="button"
          onClick={() => updatePrefs.mutate({ density: isCompact ? "comfortable" : "compact" })}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent/50"
          aria-label="Toggle density"
        >
          {isCompact ? <Rows3 className="h-3.5 w-3.5" /> : <Rows2 className="h-3.5 w-3.5" />}
          {isCompact ? "Comfortable" : "Compact"}
        </button>
      </div>
      {ORDER.map((bucket) => {
        const list = groups.get(bucket) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={bucket}>
            <h2 className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                compact={isCompact}
                indicator={getIndicator(t.id)}
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
  compact = false,
  indicator,
  onComplete,
  onDelete,
  onClick,
}: {
  task: Task;
  workflow: { id: string; name: string; color: string }[];
  compact?: boolean;
  indicator?: { blockedBy: number; blocking: number };
  onComplete: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const status = workflow.find((s) => s.id === task.status);
  const priority = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
  const isDone = task.status === "done";
  const typeMeta = getTaskTypeMeta(task.task_type);
  const TypeIcon = typeMeta.icon;
  const isParentType =
    typeMeta.type === "initiative" ||
    typeMeta.type === "epic" ||
    typeMeta.type === "milestone";
  const childCount = task.child_count ?? 0;
  const completedCount = task.completed_child_count ?? 0;
  const isBlocked = (indicator?.blockedBy ?? 0) > 0;
  const isBlocking = (indicator?.blocking ?? 0) > 0;
  const borderWidth =
    typeMeta.type === "initiative" ? 3 :
    typeMeta.type === "epic" ? 2 :
    typeMeta.type === "milestone" ? 2 :
    typeMeta.type === "subtask" ? 1 : 0;

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
        style={
          borderWidth > 0
            ? { borderLeft: `${borderWidth}px solid ${typeMeta.color}` }
            : undefined
        }
        className={`flex w-full items-center gap-3 px-4 text-left active:bg-accent/40 ${compact ? "py-2" : "items-start py-3"}`}
      >
        <Checkbox
          checked={isDone}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={() => onComplete()}
          className={`${compact ? "h-4 w-4" : "mt-0.5 h-5 w-5"}`}
        />
        <div className="min-w-0 flex-1">
          <div className={compact ? "flex items-center gap-2" : "flex items-start gap-1.5"}>
            <TypeIcon
              className={`shrink-0 ${compact ? "" : "mt-0.5"}`}
              style={{ width: 14, height: 14, color: typeMeta.color }}
              aria-label={typeMeta.label}
            />
            {isBlocked && (
              <ArrowLeftCircle
                className={`shrink-0 text-destructive ${compact ? "" : "mt-0.5"}`}
                style={{ width: 14, height: 14 }}
                aria-label={`Blocked by ${indicator?.blockedBy} task(s)`}
              />
            )}
            {isBlocking && !isBlocked && (
              <ArrowRightCircle
                className={`shrink-0 text-primary ${compact ? "" : "mt-0.5"}`}
                style={{ width: 14, height: 14 }}
                aria-label={`Blocking ${indicator?.blocking} task(s)`}
              />
            )}
            <p
              className={`text-sm ${compact ? "truncate flex-1" : "line-clamp-2 flex-1"} ${
                isDone ? "text-muted-foreground line-through" : "font-medium"
              } ${typeMeta.type === "initiative" ? "font-semibold" : ""}`}
            >
              {task.title}
            </p>
            {isParentType && childCount > 0 && (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                style={{ background: typeMeta.tint, color: typeMeta.color }}
                title={`${completedCount} of ${childCount} complete`}
              >
                {completedCount}/{childCount}
              </span>
            )}
            {compact && task.due_date && (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {format(parseISO(task.due_date), "MMM d")}
              </span>
            )}
          </div>
          {!compact && (
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
              {task.tags.slice(0, 2).map((tg) => (
                <span key={tg} className="rounded-full bg-accent/60 px-1.5 py-0.5 text-[10px] text-accent-foreground">
                  #{tg}
                </span>
              ))}
              {task.assignee_ids.length > 0 && (
                <AssigneeAvatars ids={task.assignee_ids} max={3} size={16} className="ml-auto" />
              )}
            </div>
          )}
        </div>
        {priority && (
          <span
            className={`shrink-0 rounded-full ${compact ? "h-2 w-2" : "mt-1 h-2 w-2"}`}
            style={{ background: priority.color }}
            aria-label={priority.label}
          />
        )}
      </button>
    </SwipeRow>
  );
}
