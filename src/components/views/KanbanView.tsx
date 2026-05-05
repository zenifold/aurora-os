import { useMemo, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task, ViewConfig } from "@/lib/types";
import { PRIORITY_OPTIONS } from "@/lib/types";
import { getTaskTypeMeta } from "@/lib/task-types";
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { useProjectRelationIndicators } from "@/hooks/use-task-relations";
import {
  useProjectWorkflow,
  useProjectTransitions,
  useProjectDwellTimes,
  DEFAULT_WORKFLOW,
} from "@/hooks/use-project-workflow";
import { useTransitionGuard } from "@/hooks/use-transition-guard";
import { runTransitionActions } from "@/lib/transition-actions";
import { findTransition } from "@/lib/workflow-engine";
import { supabase } from "@/integrations/supabase/client";
import { colorForTask } from "@/lib/view-config";
import { Plus, Calendar as CalendarIcon, ArrowLeftCircle, ArrowRightCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { AssigneeAvatars } from "@/components/tasks/AssigneeAvatars";
import { BulkActionBar } from "@/components/views/BulkActionBar";

interface Props {
  projectId: string;
  tasks: Task[];
  viewConfig?: ViewConfig;
  onTaskClick: (id: string) => void;
}

export function KanbanView({ projectId, tasks, viewConfig = {}, onTaskClick }: Props) {
  const update = useUpdateTask(projectId);
  const create = useCreateTask(projectId);
  const { data: indicators } = useProjectRelationIndicators(projectId);
  const { data: workflow = DEFAULT_WORKFLOW } = useProjectWorkflow(projectId);
  const { data: transitions = [] } = useProjectTransitions(projectId);
  const { data: dwellTimes } = useProjectDwellTimes(projectId);
  const guard = useTransitionGuard();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const cardFields = viewConfig.cardFields ?? ["priority", "due_date"];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string, mode: "single" | "additive") => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === "additive") {
        if (next.has(id)) next.delete(id); else next.add(id);
      } else {
        if (next.size === 1 && next.has(id)) next.clear();
        else { next.clear(); next.add(id); }
      }
      return next;
    });
  };
  const statusColorMap = useMemo(() => new Map(workflow.map((s) => [s.id, s.color])), [workflow]);
  // Resolve task.status (which may be a name or id) to a workflow status row
  const findStatusForTask = (t: Task) =>
    workflow.find((s) => s.id === t.status) ??
    workflow.find((s) => s.name.toLowerCase() === String(t.status).toLowerCase());

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const s of workflow) map.set(s.id, []);
    for (const t of tasks) {
      const matched =
        workflow.find((s) => s.id === t.status) ??
        workflow.find((s) => s.name.toLowerCase() === String(t.status).toLowerCase());
      const key = matched?.id ?? workflow[0]?.id ?? "todo";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks, workflow]);

  const handleDragEnd = async (e: DragEndEvent) => {
    const taskId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId) return;
    const target = workflow.find((s) => `col-${s.id}` === overId);
    if (!target) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const fromStatus = findStatusForTask(task);
    if (fromStatus?.id === target.id) return;
    const destinationCount = (grouped.get(target.id) ?? []).length;
    const result = await guard({
      task,
      toStatus: target,
      fromStatus,
      workflow,
      transitions,
      destinationCount,
    });
    if (!result.allowed) return;
    update.mutate(
      { id: taskId, status: target.id },
      {
        onSuccess: async () => {
          const transition = fromStatus
            ? findTransition(transitions, fromStatus.id, target.id)
            : undefined;
          if (!transition?.actions?.length) return;
          const { data: u } = await supabase.auth.getUser();
          await runTransitionActions(transition.actions, {
            task,
            fromStatus,
            toStatus: target,
            transition,
            actorId: u.user?.id ?? null,
          });
        },
      },
    );
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-full snap-x snap-mandatory gap-3 overflow-x-auto p-3 lg:snap-none lg:p-4">
        {workflow.map((s) => {
          const list = grouped.get(s.id) ?? [];
          const overLimit = s.wip_limit != null && list.length > s.wip_limit;
          return (
            <Column
              key={s.id}
              id={`col-${s.id}`}
              title={s.name}
              color={s.color}
              wipLimit={s.wip_limit}
              overLimit={overLimit}
              tasks={list}
              indicators={indicators}
              cardFields={cardFields}
              slaHours={s.sla_hours}
              dwellTimes={dwellTimes}
              colorFor={(t) => colorForTask(t, viewConfig, statusColorMap)}
              onAdd={(title) => create.mutate({ title, status: s.id })}
              onTaskClick={(id, e) => {
                if (e && (e.metaKey || e.ctrlKey || e.shiftKey)) {
                  toggleSelect(id, "additive");
                } else if (selected.size > 0) {
                  toggleSelect(id, "additive");
                } else {
                  onTaskClick(id);
                }
              }}
              selected={selected}
            />
          );
        })}
      </div>
      <BulkActionBar projectId={projectId} selected={selected} onClear={() => setSelected(new Set())} />
    </DndContext>
  );
}

function Column({
  id,
  title,
  color,
  wipLimit,
  overLimit,
  tasks,
  indicators,
  cardFields,
  slaHours,
  dwellTimes,
  colorFor,
  onAdd,
  onTaskClick,
  selected,
}: {
  id: string;
  title: string;
  color: string;
  wipLimit: number | null;
  overLimit: boolean;
  tasks: Task[];
  indicators?: Map<string, { blockedBy: number; blocking: number }> | Record<string, { blockedBy: number; blocking: number }>;
  cardFields: Array<"priority" | "due_date" | "assignees" | "tags">;
  slaHours: number | null;
  dwellTimes?: Map<string, number>;
  colorFor: (t: Task) => string | null;
  onAdd: (title: string) => void;
  onTaskClick: (id: string, e?: React.MouseEvent) => void;
  selected: Set<string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");

  const submit = () => {
    if (val.trim()) onAdd(val.trim());
    setVal("");
    setAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[calc(100vw-2rem)] max-w-sm shrink-0 snap-center flex-col rounded-lg border bg-muted/30 transition-colors lg:w-72 ${
        overLimit ? "border-destructive/60" : isOver ? "border-primary/50 bg-muted/60" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="text-sm font-medium">{title}</span>
          <span className={`text-xs ${overLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {tasks.length}{wipLimit != null ? `/${wipLimit}` : ""}
          </span>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {tasks.map((t) => {
          const dwell = dwellTimes?.get(t.id);
          const slaPct = slaHours != null && dwell != null ? dwell / slaHours : null;
          return (
            <Card
              key={t.id}
              task={t}
              cardFields={cardFields}
              accent={colorFor(t)}
              slaPct={slaPct}
              isSelected={selected.has(t.id)}
              onClick={(e) => onTaskClick(t.id, e)}
              indicator={indicators ? (typeof (indicators as { get?: unknown }).get === "function" ? (indicators as Map<string, { blockedBy: number; blocking: number }>).get(t.id) : (indicators as unknown as Record<string, { blockedBy: number; blocking: number }>)[t.id]) : undefined}
            />
          );
        })}
        {adding && (
          <Input
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") {
                setAdding(false);
                setVal("");
              }
            }}
            placeholder="Task title"
            className="h-8 text-sm"
          />
        )}
        {!adding && tasks.length === 0 && (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> New task
          </button>
        )}
      </div>
    </div>
  );
}

function Card({
  task,
  cardFields,
  accent,
  slaPct,
  onClick,
  indicator,
}: {
  task: Task;
  cardFields: Array<"priority" | "due_date" | "assignees" | "tags">;
  accent: string | null;
  slaPct: number | null;
  onClick: () => void;
  indicator?: { blockedBy: number; blocking: number };
}) {
  const { setNodeRef, transform, listeners, attributes, isDragging } = useDraggable({ id: task.id });
  const priority = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
  const isBlocked = (indicator?.blockedBy ?? 0) > 0;
  const isBlocking = (indicator?.blocking ?? 0) > 0;
  const showPriority = cardFields.includes("priority") && priority;
  const showDue = cardFields.includes("due_date") && task.due_date;
  const showAssignees = cardFields.includes("assignees") && task.assignee_ids.length > 0;
  const showTags = cardFields.includes("tags") && task.tags.length > 0;
  const hasFooter = showPriority || showDue || showAssignees || showTags;

  const typeMeta = getTaskTypeMeta(task.task_type);
  const TypeIcon = typeMeta.icon;
  const isInitiative = typeMeta.type === "initiative";
  const isEpic = typeMeta.type === "epic";
  const isSubtask = typeMeta.type === "subtask";
  const childCount = task.child_count ?? 0;
  const completedCount = task.completed_child_count ?? 0;
  // SLA aging: green <60%, amber 60-100%, red >100% of allotted time in this status
  const slaTone =
    slaPct == null
      ? null
      : slaPct >= 1
        ? "hsl(var(--destructive))"
        : slaPct >= 0.6
          ? "hsl(38 92% 50%)"
          : null;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        borderLeft: `${isInitiative ? 4 : isEpic ? 3 : 2}px solid ${accent ?? typeMeta.color}`,
      }}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={`relative cursor-grab overflow-hidden rounded-md border border-border bg-card text-left shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${
        isInitiative ? "p-3 ring-1 ring-inset" : isSubtask ? "p-2" : "p-2.5"
      }`}
    >
      {/* SLA aging top bar */}
      {slaTone && (
        <span
          aria-hidden
          className="absolute left-0 right-0 top-0 h-[2px]"
          style={{ background: slaTone }}
          title={`SLA dwell: ${(slaPct! * 100).toFixed(0)}% of budget`}
        />
      )}
      {/* Right-edge dependency strip */}
      {(isBlocked || isBlocking) && (
        <span
          aria-hidden
          className="absolute right-0 top-0 h-full w-[3px]"
          style={{
            background:
              isBlocked && isBlocking
                ? "repeating-linear-gradient(45deg, hsl(var(--destructive)) 0 4px, hsl(var(--primary)) 4px 8px)"
                : isBlocked
                  ? "hsl(var(--destructive))"
                  : "hsl(var(--primary))",
          }}
        />
      )}

      <div className="flex items-start gap-1.5">
        <TypeIcon
          className={`mt-0.5 shrink-0 ${isInitiative ? "h-4 w-4" : "h-3.5 w-3.5"}`}
          style={{ color: typeMeta.color }}
          aria-label={typeMeta.label}
        />
        {isBlocked && (
          <ArrowLeftCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
            aria-label={`Blocked by ${indicator?.blockedBy} task(s)`}
          />
        )}
        {isBlocking && !isBlocked && (
          <ArrowRightCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
            aria-label={`Blocking ${indicator?.blocking} task(s)`}
          />
        )}
        <p className={`line-clamp-2 flex-1 ${isInitiative ? "text-sm font-bold" : isSubtask ? "text-xs" : "text-sm font-medium"} ${isSubtask && task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        {(isInitiative || isEpic) && childCount > 0 && (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
            style={{ background: typeMeta.tint, color: typeMeta.color }}
            title={`${completedCount} of ${childCount} complete`}
          >
            {completedCount}/{childCount}
          </span>
        )}
      </div>

      {hasFooter && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {showPriority && priority && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: `${priority.color}22`, color: priority.color }}
            >
              {priority.label}
            </span>
          )}
          {showDue && task.due_date && (() => {
            const days = differenceInCalendarDays(parseISO(task.due_date), new Date());
            const tone = days < 0
              ? "bg-destructive/15 text-destructive"
              : days <= 1
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-muted text-muted-foreground";
            return (
              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${tone}`}>
                <CalendarIcon className="h-3 w-3" />
                {format(parseISO(task.due_date), "MMM d")}
              </span>
            );
          })()}
          {showTags && task.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-accent/60 px-1.5 py-0.5 text-[10px] text-accent-foreground">
              #{t}
            </span>
          ))}
          {showTags && task.tags.length > 3 && (
            <span className="text-[10px]">+{task.tags.length - 3}</span>
          )}
          <div className="ml-auto">
            {showAssignees && <AssigneeAvatars ids={task.assignee_ids} max={3} size={20} />}
          </div>
        </div>
      )}
    </div>
  );
}
