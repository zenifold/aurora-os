import { useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "@/lib/types";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  tasks: Task[];
  onTaskClick: (id: string) => void;
}

export function CalendarView({ tasks, onTaskClick }: Props) {
  const [cursor, setCursor] = useState(() => new Date());

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">{format(cursor, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
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

      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const list = tasksByDate.get(key) ?? [];
          const dim = !isSameMonth(day, cursor);
          return (
            <div
              key={key}
              className={`min-h-0 border-b border-r border-border p-1.5 ${dim ? "bg-muted/20" : ""}`}
            >
              <div className="mb-1 flex items-center">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isToday(day)
                      ? "bg-primary text-primary-foreground font-semibold"
                      : dim
                      ? "text-muted-foreground"
                      : ""
                  }`}
                >
                  {format(day, "d")}
                </span>
              </div>
              <div className="space-y-1">
                {list.slice(0, 3).map((t) => {
                  const status = STATUS_OPTIONS.find((s) => s.value === t.status);
                  const priority = PRIORITY_OPTIONS.find((p) => p.value === t.priority);
                  const color = priority?.color ?? status?.color ?? "var(--muted-foreground)";
                  return (
                    <button
                      key={t.id}
                      onClick={() => onTaskClick(t.id)}
                      className="flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-xs hover:bg-accent"
                      style={{ borderLeft: `2px solid ${color}` }}
                    >
                      <span className="truncate">{t.title}</span>
                    </button>
                  );
                })}
                {list.length > 3 && (
                  <span className="px-1.5 text-[10px] text-muted-foreground">+{list.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* day click handled per-task; could add day click to create */}
      <DayClickHelper onPick={(d) => isSameDay(d, d)} />
    </div>
  );
}

function DayClickHelper(_: { onPick: (d: Date) => void }) {
  return null;
}
