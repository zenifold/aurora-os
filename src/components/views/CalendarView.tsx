import { useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "@/lib/types";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  projectId: string;
  tasks: Task[];
  onTaskClick: (id: string) => void;
}

export function CalendarView({ projectId, tasks, onTaskClick }: Props) {
  const [cursor, setCursor] = useState(() => new Date());
  const [colorBy, setColorBy] = useState<"priority" | "status">("priority");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [createFor, setCreateFor] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const updateTask = useUpdateTask(projectId);
  const createTask = useCreateTask(projectId);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const arr: Date[] = [];
    const d = new Date(start);
    while (d <= end) {
      arr.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return arr;
  }, [cursor]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = format(parseISO(t.due_date), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks]);

  const handleDrop = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    setDraggingId(null);
    if (!id) return;
    const due_date = format(day, "yyyy-MM-dd");
    updateTask.mutate({ id, due_date } as Partial<Task> & { id: string });
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !createFor) return;
    const created = await createTask.mutateAsync({ title: newTitle.trim() });
    await updateTask.mutateAsync({ id: created.id, due_date: createFor } as Partial<Task> & { id: string });
    setNewTitle("");
    setCreateFor(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">{format(cursor, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5 text-xs">
            <button
              onClick={() => setColorBy("priority")}
              className={`rounded px-2 py-1 transition ${colorBy === "priority" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Priority
            </button>
            <button
              onClick={() => setColorBy("status")}
              className={`rounded px-2 py-1 transition ${colorBy === "status" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Status
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(subMonths(cursor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-2 py-1.5">{d}</div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6 overflow-hidden">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const list = tasksByDate.get(key) ?? [];
          const dim = !isSameMonth(day, cursor);
          return (
            <div
              key={key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, day)}
              onDoubleClick={() => setCreateFor(key)}
              className={`group relative min-h-0 overflow-hidden border-b border-r border-border p-1.5 ${dim ? "bg-muted/20" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isToday(day)
                      ? "bg-primary font-semibold text-primary-foreground"
                      : dim
                      ? "text-muted-foreground"
                      : ""
                  }`}
                >
                  {format(day, "d")}
                </span>
                <button
                  onClick={() => setCreateFor(key)}
                  className="rounded p-0.5 text-muted-foreground opacity-0 transition hover:bg-accent group-hover:opacity-100"
                  aria-label="Add task"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-1">
                {list.slice(0, 4).map((t) => {
                  const status = STATUS_OPTIONS.find((s) => s.value === t.status);
                  const priority = PRIORITY_OPTIONS.find((p) => p.value === t.priority);
                  const color = colorBy === "priority"
                    ? (priority?.color ?? "var(--muted-foreground)")
                    : (status?.color ?? "var(--muted-foreground)");
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(t.id);
                        e.dataTransfer.setData("text/plain", t.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => onTaskClick(t.id)}
                      title={t.title}
                      className="flex w-full cursor-pointer items-center gap-1.5 rounded bg-card px-1.5 py-0.5 text-left text-xs shadow-sm hover:bg-accent"
                      style={{ borderLeft: `3px solid ${color}` }}
                    >
                      <span className="flex-1 truncate">{t.title}</span>
                      {t.assignee_ids.length > 0 && (
                        <AssigneeAvatars ids={t.assignee_ids} max={2} size={14} />
                      )}
                    </div>
                  );
                })}
                {list.length > 4 && (
                  <span className="px-1.5 text-[10px] text-muted-foreground">+{list.length - 4} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!createFor} onOpenChange={(o) => !o && setCreateFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              New task {createFor && `· ${format(parseISO(createFor), "MMM d")}`}
            </DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task title"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateFor(null)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
