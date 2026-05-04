import { useMemo, useRef, useState, useEffect } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isSameDay,
  isWeekend,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import type { Task } from "@/lib/types";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "@/lib/types";
import { getTaskTypeMeta } from "@/lib/task-types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUpdateTask } from "@/hooks/use-tasks";

interface Props {
  projectId: string;
  tasks: Task[];
  onTaskClick: (id: string) => void;
}

type Zoom = "day" | "week" | "month";

const ZOOM_PX: Record<Zoom, number> = { day: 36, week: 18, month: 8 };
const ROW_H = 36;
const LABEL_W = 240;

export function TimelineView({ projectId, tasks, onTaskClick }: Props) {
  const [zoom, setZoom] = useState<Zoom>("week");
  const [colorBy, setColorBy] = useState<"priority" | "status">("priority");
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [drag, setDrag] = useState<{
    id: string;
    mode: "move" | "resize-start" | "resize-end";
    startX: number;
    origStart: Date;
    origEnd: Date;
  } | null>(null);
  const [preview, setPreview] = useState<Record<string, { start: Date; end: Date }>>({});
  const updateTask = useUpdateTask(projectId);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayPx = ZOOM_PX[zoom];

  // Render 4 months around cursor
  const range = useMemo(() => {
    const start = subMonths(cursor, 1);
    const end = endOfMonth(addMonths(cursor, 2));
    return { start, end, days: differenceInCalendarDays(end, start) + 1 };
  }, [cursor]);

  // Auto-scroll to today on first mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const offset = differenceInCalendarDays(new Date(), range.start) * dayPx;
    scrollRef.current.scrollLeft = Math.max(0, offset - 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleTasks = useMemo(
    () => tasks.filter((t) => t.due_date || t.start_date),
    [tasks]
  );

  // Build month labels & day cells
  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < range.days; i++) arr.push(addDays(range.start, i));
    return arr;
  }, [range]);

  const monthBlocks = useMemo(() => {
    const blocks: { label: string; days: number }[] = [];
    let i = 0;
    while (i < days.length) {
      const monthStart = days[i];
      let count = 0;
      while (i < days.length && days[i].getMonth() === monthStart.getMonth()) {
        count++;
        i++;
      }
      blocks.push({ label: format(monthStart, "MMMM yyyy"), days: count });
    }
    return blocks;
  }, [days]);

  const getRange = (t: Task): { start: Date; end: Date } | null => {
    const p = preview[t.id];
    if (p) return p;
    const due = t.due_date ? parseISO(t.due_date) : null;
    const start = t.start_date ? parseISO(t.start_date) : due;
    const end = due ?? start;
    if (!start || !end) return null;
    return { start, end };
  };

  // Mouse handlers for drag
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - drag.startX;
      const days = Math.round(dx / dayPx);
      let s = drag.origStart;
      let en = drag.origEnd;
      if (drag.mode === "move") {
        s = addDays(drag.origStart, days);
        en = addDays(drag.origEnd, days);
      } else if (drag.mode === "resize-start") {
        s = addDays(drag.origStart, days);
        if (s > en) s = en;
      } else if (drag.mode === "resize-end") {
        en = addDays(drag.origEnd, days);
        if (en < s) en = s;
      }
      setPreview((p) => ({ ...p, [drag.id]: { start: s, end: en } }));
    };
    const onUp = () => {
      const p = preview[drag.id];
      if (p) {
        const startStr = format(p.start, "yyyy-MM-dd");
        const endStr = format(p.end, "yyyy-MM-dd");
        const sameRange = isSameDay(p.start, p.end);
        updateTask.mutate({
          id: drag.id,
          start_date: sameRange ? null : startStr,
          due_date: endStr,
        } as Partial<Task> & { id: string });
      }
      setDrag(null);
      // clear preview for this id after mutation completes
      setTimeout(() => setPreview((prev) => {
        const next = { ...prev };
        delete next[drag.id];
        return next;
      }), 300);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, dayPx, preview, updateTask]);

  const totalWidth = days.length * dayPx;
  const todayOffset = differenceInCalendarDays(new Date(), range.start) * dayPx;
  const todayInRange = todayOffset >= 0 && todayOffset <= totalWidth;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(subMonths(cursor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium">{format(cursor, "MMMM yyyy")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5 text-xs">
            {(["priority", "status"] as const).map((o) => (
              <button
                key={o}
                onClick={() => setColorBy(o)}
                className={`rounded px-2 py-1 capitalize transition ${colorBy === o ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                {o}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5 text-xs">
            {(["day", "week", "month"] as const).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`rounded px-2 py-1 capitalize transition ${zoom === z ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                {z}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline body */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: LABEL_W + totalWidth }}>
          {/* Header row: months + days */}
          <div className="sticky top-0 z-20 bg-background">
            <div className="flex border-b border-border">
              <div
                className="sticky left-0 z-30 shrink-0 border-r border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground"
                style={{ width: LABEL_W }}
              >
                Task
              </div>
              <div className="flex">
                {monthBlocks.map((b, i) => (
                  <div
                    key={i}
                    className="border-r border-border px-2 py-2 text-xs font-medium"
                    style={{ width: b.days * dayPx }}
                  >
                    {b.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex border-b border-border bg-muted/20">
              <div
                className="sticky left-0 z-30 shrink-0 border-r border-border bg-muted/20"
                style={{ width: LABEL_W }}
              />
              <div className="flex">
                {days.map((d, i) => (
                  <div
                    key={i}
                    className={`shrink-0 border-r border-border/40 text-center text-[10px] leading-tight ${
                      isWeekend(d) ? "bg-muted/40 text-muted-foreground" : ""
                    } ${isSameDay(d, new Date()) ? "bg-primary/10 font-semibold text-primary" : ""}`}
                    style={{ width: dayPx, paddingTop: 2, paddingBottom: 2 }}
                  >
                    {zoom === "month" ? (i % 7 === 0 ? format(d, "d") : "") : format(d, "d")}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Today line */}
          {todayInRange && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-primary"
              style={{ left: LABEL_W + todayOffset }}
            />
          )}

          {/* Rows */}
          {visibleTasks.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No tasks with dates yet. Add a due or start date to see them here.
            </div>
          ) : (
            visibleTasks.map((t) => {
              const r = getRange(t);
              if (!r) return null;
              const startOffset = differenceInCalendarDays(r.start, range.start);
              const length = Math.max(1, differenceInCalendarDays(r.end, r.start) + 1);
              const left = startOffset * dayPx;
              const width = length * dayPx;
              const status = STATUS_OPTIONS.find((s) => s.value === t.status);
              const priority = PRIORITY_OPTIONS.find((p) => p.value === t.priority);
              const typeMeta = getTaskTypeMeta(t.task_type);
              const color = colorBy === "priority"
                ? (priority?.color ?? typeMeta.color)
                : (status?.color ?? typeMeta.color);
              const done = t.status === "done";
              const barH = typeMeta.barHeight;
              return (
                <div key={t.id} className="flex border-b border-border/50" style={{ height: ROW_H }}>
                  <div
                    className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border bg-background px-3 text-sm"
                    style={{ width: LABEL_W }}
                  >
                    <button
                      onClick={() => onTaskClick(t.id)}
                      className="truncate text-left hover:underline"
                      title={t.title}
                    >
                      {t.title}
                    </button>
                  </div>
                  <div className="relative flex-1" style={{ width: totalWidth }}>
                    <div
                      className={`group absolute flex cursor-grab items-center text-xs text-white shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${done ? "opacity-60" : ""}`}
                      style={{
                        top: (ROW_H - barH) / 2,
                        height: barH,
                        left,
                        width: Math.max(width, 12),
                        background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 80%, transparent))`,
                        borderRadius: t.task_type === "subtask" ? 999 : 6,
                        border: `1px solid ${typeMeta.color}`,
                      }}
                      onClick={(e) => {
                        if (drag) return;
                        e.stopPropagation();
                        onTaskClick(t.id);
                      }}
                      onMouseDown={(e) => {
                        if ((e.target as HTMLElement).dataset.handle) return;
                        e.preventDefault();
                        setDrag({
                          id: t.id,
                          mode: "move",
                          startX: e.clientX,
                          origStart: r.start,
                          origEnd: r.end,
                        });
                      }}
                    >
                      <div
                        data-handle="start"
                        className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize rounded-l-md bg-black/20 opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDrag({
                            id: t.id,
                            mode: "resize-start",
                            startX: e.clientX,
                            origStart: r.start,
                            origEnd: r.end,
                          });
                        }}
                      />
                      <span className="mx-2 truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                        {t.title}
                      </span>
                      <div
                        data-handle="end"
                        className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-r-md bg-black/20 opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDrag({
                            id: t.id,
                            mode: "resize-end",
                            startX: e.clientX,
                            origStart: r.start,
                            origEnd: r.end,
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
