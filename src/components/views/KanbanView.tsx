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
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { useProjectRelationIndicators } from "@/hooks/use-task-relations";
import { useProjectWorkflow, DEFAULT_WORKFLOW } from "@/hooks/use-project-workflow";
import { colorForTask } from "@/lib/view-config";
import { Plus, Calendar as CalendarIcon, ArrowLeftCircle, ArrowRightCircle, Tag, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";

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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const cardFields = viewConfig.cardFields ?? ["priority", "due_date"];
  const statusColorMap = useMemo(() => new Map(workflow.map((s) => [s.id, s.color])), [workflow]);

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const s of workflow) map.set(s.id, []);
    for (const t of tasks) {
      const k = (t.status as string) ?? workflow[0]?.id ?? "todo";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return map;
  }, [tasks, workflow]);

  const handleDragEnd = (e: DragEndEvent) => {
    const taskId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId) return;
    const target = workflow.find((s) => `col-${s.id}` === overId);
    if (!target) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === target.id) return;
    update.mutate({ id: taskId, status: target.id });
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
              colorFor={(t) => colorForTask(t, viewConfig, statusColorMap)}
              onAdd={(title) => create.mutate({ title, status: s.id })}
              onTaskClick={onTaskClick}
            />
          );
        })}
      </div>
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
  colorFor,
  onAdd,
  onTaskClick,
}: {
  id: string;
  title: string;
  color: string;
  wipLimit: number | null;
  overLimit: boolean;
  tasks: Task[];
  indicators?: Map<string, { blockedBy: number; blocking: number }>;
  cardFields: Array<"priority" | "due_date" | "assignees" | "tags">;
  colorFor: (t: Task) => string | null;
  onAdd: (title: string) => void;
  onTaskClick: (id: string) => void;
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
        {tasks.map((t) => (
          <Card
            key={t.id}
            task={t}
            cardFields={cardFields}
            accent={colorFor(t)}
            onClick={() => onTaskClick(t.id)}
            indicator={indicators?.get(t.id)}
          />
        ))}
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
  onClick,
  indicator,
}: {
  task: Task;
  cardFields: Array<"priority" | "due_date" | "assignees" | "tags">;
  accent: string | null;
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

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        borderLeft: accent ? `3px solid ${accent}` : undefined,
      }}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
      className="relative cursor-grab overflow-hidden rounded-md border border-border bg-card p-2.5 text-left shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
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
        <p className="line-clamp-2 text-sm font-medium">{task.title}</p>
      </div>

      {hasFooter && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {showPriority && priority && (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
              style={{ background: `${priority.color}22`, color: priority.color }}
            >
              {priority.label}
            </span>
          )}
          {showDue && task.due_date && (
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {format(parseISO(task.due_date), "MMM d")}
            </span>
          )}
          {showAssignees && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {task.assignee_ids.length}
            </span>
          )}
          {showTags && (
            <span className="inline-flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {task.tags.slice(0, 2).join(", ")}{task.tags.length > 2 ? "…" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
