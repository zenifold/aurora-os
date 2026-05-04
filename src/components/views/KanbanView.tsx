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
import type { Task } from "@/lib/types";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/types";
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";

interface Props {
  projectId: string;
  tasks: Task[];
  onTaskClick: (id: string) => void;
}

export function KanbanView({ projectId, tasks, onTaskClick }: Props) {
  const update = useUpdateTask(projectId);
  const create = useCreateTask(projectId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const s of STATUS_OPTIONS) map.set(s.value, []);
    for (const t of tasks) {
      const k = (t.status as string) ?? "todo";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return map;
  }, [tasks]);

  const handleDragEnd = (e: DragEndEvent) => {
    const taskId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId) return;
    const target = STATUS_OPTIONS.find((s) => `col-${s.value}` === overId);
    if (!target) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === target.value) return;
    update.mutate({ id: taskId, status: target.value });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {STATUS_OPTIONS.map((s) => (
          <Column
            key={s.value}
            id={`col-${s.value}`}
            title={s.label}
            color={s.color}
            tasks={grouped.get(s.value) ?? []}
            onAdd={(title) => create.mutate({ title, status: s.value })}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </DndContext>
  );
}

function Column({
  id,
  title,
  color,
  tasks,
  onAdd,
  onTaskClick,
}: {
  id: string;
  title: string;
  color: string;
  tasks: Task[];
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
      className={`flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30 transition-colors ${
        isOver ? "border-primary/50 bg-muted/60" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">{tasks.length}</span>
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
          <Card key={t.id} task={t} onClick={() => onTaskClick(t.id)} />
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

function Card({ task, onClick }: { task: Task; onClick: () => void }) {
  const { setNodeRef, transform, listeners, attributes, isDragging } = useDraggable({ id: task.id });
  const priority = PRIORITY_OPTIONS.find((p) => p.value === task.priority);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // Only open detail if not dragging
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
      className="cursor-grab rounded-md border border-border bg-card p-2.5 text-left shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <p className="line-clamp-2 text-sm font-medium">{task.title}</p>
      {(task.due_date || priority) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {priority && (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
              style={{ background: `${priority.color}22`, color: priority.color }}
            >
              {priority.label}
            </span>
          )}
          {task.due_date && (
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {format(parseISO(task.due_date), "MMM d")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
