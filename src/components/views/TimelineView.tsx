import { useMemo, useRef, useState, useEffect, useCallback } from "react";
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
import type { CustomFieldDef, EffortValue, Task } from "@/lib/types";
import { PRIORITY_OPTIONS, STATUS_OPTIONS, effortToDays } from "@/lib/types";
import { getTaskTypeMeta } from "@/lib/task-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  RotateCcw,
  Save,
  Sparkles,
  Gauge,
  Bookmark,
  Trash2,
  Plus,
  ChevronDown,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useUpdateTask } from "@/hooks/use-tasks";
import { useCustomFields } from "@/hooks/use-custom-fields";
import { useProjectDependencyEdges, type DependencyEdge } from "@/hooks/use-project-relations";
import { toast } from "sonner";

interface Props {
  projectId: string;
  tasks: Task[];
  onTaskClick: (id: string) => void;
}

type Zoom = "day" | "week" | "month";
type ColorBy = "priority" | "status" | "effort";

const ZOOM_PX: Record<Zoom, number> = { day: 36, week: 18, month: 8 };
const ROW_H = 36;
const LABEL_W = 260;

interface ScenarioState {
  enabled: boolean;
  multiplier: number; // 0.5..3
  hoursPerDay: number;
  overrides: Record<string, number>; // taskId -> effort multiplier override
}

const DEFAULT_SCENARIO: ScenarioState = {
  enabled: false,
  multiplier: 1,
  hoursPerDay: 8,
  overrides: {},
};

function readEffort(task: Task, effortFieldId: string | null): EffortValue | null {
  if (!effortFieldId) return null;
  const raw = task.custom_values?.[effortFieldId];
  if (!raw || typeof raw !== "object") return null;
  const v = raw as { amount?: unknown; unit?: unknown };
  if (typeof v.amount !== "number") return null;
  const unit = (v.unit === "hours" || v.unit === "days" || v.unit === "points") ? v.unit : "days";
  return { amount: v.amount, unit };
}

interface ScenarioSnapshot {
  id: string;
  name: string;
  state: ScenarioState;
  savedAt: string;
}

function snapshotsKey(projectId: string) {
  return `aura.scenarios.${projectId}`;
}

function loadSnapshots(projectId: string): ScenarioSnapshot[] {
  try {
    const raw = localStorage.getItem(snapshotsKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function TimelineView({ projectId, tasks, onTaskClick }: Props) {
  const [zoom, setZoom] = useState<Zoom>("week");
  const [colorBy, setColorBy] = useState<ColorBy>("priority");
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [scenario, setScenario] = useState<ScenarioState>(DEFAULT_SCENARIO);
  const [showScenario, setShowScenario] = useState(false);
  const [snapshots, setSnapshots] = useState<ScenarioSnapshot[]>(() => loadSnapshots(projectId));
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);
  const [newSnapshotName, setNewSnapshotName] = useState("");
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
  const [cascadeMode, setCascadeMode] = useState(true);

  const { data: edges = [] } = useProjectDependencyEdges(projectId);

  const { data: fields = [] } = useCustomFields();
  const effortFields = useMemo(
    () => (fields as CustomFieldDef[]).filter((f) => f.field_type === "effort"),
    [fields],
  );
  const [effortFieldId, setEffortFieldId] = useState<string | null>(null);
  useEffect(() => {
    if (!effortFieldId && effortFields.length > 0) setEffortFieldId(effortFields[0].id);
  }, [effortFields, effortFieldId]);

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

  // Keyboard shortcuts: ←/→ scroll, +/- zoom
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") {
        scrollRef.current?.scrollBy({ left: -dayPx * 7, behavior: "smooth" });
      } else if (e.key === "ArrowRight") {
        scrollRef.current?.scrollBy({ left: dayPx * 7, behavior: "smooth" });
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => (z === "month" ? "week" : "day"));
      } else if (e.key === "-" || e.key === "_") {
        setZoom((z) => (z === "day" ? "week" : "month"));
      } else if (e.key.toLowerCase() === "t") {
        setCursor(startOfMonth(new Date()));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dayPx]);

  // Compute scenario-adjusted range for each task. Rules:
  //  - if both start_date & due_date present → use them; if scenario, stretch length by multiplier.
  //  - else if effort > 0 → derive bar from start_date (or due_date - effort, or today).
  //  - else if only due_date → 1-day bar at due_date.
  //  - else if only start_date → 1-day bar at start_date.
  const taskRange = useCallback(
    (t: Task): { start: Date; end: Date; planned: boolean } | null => {
      const p = preview[t.id];
      if (p) return { ...p, planned: false };

      const due = t.due_date ? parseISO(t.due_date) : null;
      const start = t.start_date ? parseISO(t.start_date) : null;
      const effort = readEffort(t, effortFieldId);
      const baseDays = effortToDays(effort, scenario.hoursPerDay);
      const taskMult = scenario.overrides[t.id] ?? 1;
      const mult = scenario.enabled ? scenario.multiplier * taskMult : 1;
      const effortDays = Math.max(0, Math.round(baseDays * mult));

      // both dates → real bar
      if (start && due) {
        if (scenario.enabled && effortDays > 0) {
          // anchor at start_date, length = effortDays (min 1)
          const len = Math.max(1, effortDays);
          return { start, end: addDays(start, len - 1), planned: true };
        }
        return { start, end: due, planned: false };
      }

      if (effortDays > 0) {
        const len = Math.max(1, effortDays);
        if (start) return { start, end: addDays(start, len - 1), planned: true };
        if (due) return { start: addDays(due, -(len - 1)), end: due, planned: true };
        // no anchor: place at today
        const today = new Date();
        return { start: today, end: addDays(today, len - 1), planned: true };
      }

      if (due) return { start: due, end: due, planned: false };
      if (start) return { start, end: start, planned: false };
      return null;
    },
    [preview, effortFieldId, scenario],
  );

  const visibleTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.due_date || t.start_date) return true;
        if (effortFieldId && readEffort(t, effortFieldId)) return scenario.enabled;
        return false;
      }),
    [tasks, effortFieldId, scenario.enabled],
  );

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const rowIndex = useMemo(
    () => new Map(visibleTasks.map((t, i) => [t.id, i])),
    [visibleTasks],
  );
  const edgesByFrom = useMemo(() => {
    const m = new Map<string, DependencyEdge[]>();
    for (const e of edges) {
      const arr = m.get(e.from) ?? [];
      arr.push(e);
      m.set(e.from, arr);
    }
    return m;
  }, [edges]);

  // Conflicts: successor whose start is before predecessor.end + lag + 1
  const conflicts = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const e of edges) {
      const fromT = taskMap.get(e.from);
      const toT = taskMap.get(e.to);
      if (!fromT || !toT) continue;
      const fromEnd = fromT.due_date ? parseISO(fromT.due_date) : null;
      const toStart = toT.start_date
        ? parseISO(toT.start_date)
        : toT.due_date
        ? parseISO(toT.due_date)
        : null;
      if (!fromEnd || !toStart) continue;
      const earliest = addDays(fromEnd, e.lagDays + 1);
      if (toStart < earliest) {
        const arr = out.get(e.to) ?? [];
        arr.push(fromT.title);
        out.set(e.to, arr);
      }
    }
    return out;
  }, [edges, taskMap]);

  const summary = useMemo(() => {
    if (!effortFieldId) return null;
    let totalDays = 0;
    let count = 0;
    for (const t of tasks) {
      const e = readEffort(t, effortFieldId);
      if (!e) continue;
      const baseline = effortToDays(e, scenario.hoursPerDay);
      const mult = scenario.enabled ? scenario.multiplier * (scenario.overrides[t.id] ?? 1) : 1;
      totalDays += baseline * mult;
      count++;
    }
    return { totalDays, count };
  }, [tasks, effortFieldId, scenario]);

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
        const orig = taskMap.get(drag.id);
        const origEnd = orig?.due_date ? parseISO(orig.due_date) : null;
        const deltaDays = origEnd ? differenceInCalendarDays(p.end, origEnd) : 0;
        updateTask.mutate({
          id: drag.id,
          start_date: sameRange ? null : startStr,
          due_date: endStr,
        } as Partial<Task> & { id: string });

        // Cascade: shift downstream successors when end-date moved later
        if (cascadeMode && deltaDays !== 0) {
          const cascaded = collectDownstream(drag.id, edgesByFrom);
          let count = 0;
          for (const id of cascaded) {
            if (id === drag.id) continue;
            const t = taskMap.get(id);
            if (!t) continue;
            const patch: Partial<Task> & { id: string } = { id };
            let changed = false;
            if (t.start_date) {
              patch.start_date = format(addDays(parseISO(t.start_date), deltaDays), "yyyy-MM-dd");
              changed = true;
            }
            if (t.due_date) {
              patch.due_date = format(addDays(parseISO(t.due_date), deltaDays), "yyyy-MM-dd");
              changed = true;
            }
            if (changed) {
              updateTask.mutate(patch);
              count++;
            }
          }
          if (count > 0) {
            toast.success(
              `Shifted ${count} downstream item${count === 1 ? "" : "s"} by ${deltaDays > 0 ? "+" : ""}${deltaDays}d`,
            );
          }
        }
      }
      setDrag(null);
      setTimeout(
        () =>
          setPreview((prev) => {
            const next = { ...prev };
            delete next[drag.id];
            return next;
          }),
        300,
      );
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

  const applyScenario = async () => {
    // Persist scenario-adjusted bars to start_date / due_date for each visible task
    const updates = visibleTasks
      .map((t) => {
        const r = taskRange(t);
        if (!r || !r.planned) return null;
        return {
          id: t.id,
          start_date: format(r.start, "yyyy-MM-dd"),
          due_date: format(r.end, "yyyy-MM-dd"),
        };
      })
      .filter(Boolean) as Array<{ id: string; start_date: string; due_date: string }>;
    if (updates.length === 0) {
      toast.info("No effort-driven tasks to apply.");
      return;
    }
    await Promise.all(
      updates.map((u) =>
        updateTask.mutateAsync(u as Partial<Task> & { id: string }),
      ),
    );
    toast.success(`Applied scenario to ${updates.length} task${updates.length === 1 ? "" : "s"}`);
    setScenario((s) => ({ ...s, overrides: {} }));
  };

  // Persist snapshots to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(snapshotsKey(projectId), JSON.stringify(snapshots));
    } catch {
      /* ignore quota errors */
    }
  }, [snapshots, projectId]);

  const saveSnapshot = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const snap: ScenarioSnapshot = {
      id: crypto.randomUUID(),
      name: trimmed,
      state: { ...scenario, enabled: true },
      savedAt: new Date().toISOString(),
    };
    setSnapshots((s) => [...s, snap]);
    setActiveSnapshotId(snap.id);
    setNewSnapshotName("");
    toast.success(`Saved scenario "${trimmed}"`);
  };

  const loadSnapshot = (id: string) => {
    const snap = snapshots.find((s) => s.id === id);
    if (!snap) return;
    setScenario(snap.state);
    setActiveSnapshotId(id);
    setShowScenario(true);
    toast.success(`Loaded "${snap.name}"`);
  };

  const deleteSnapshot = (id: string) => {
    setSnapshots((s) => s.filter((x) => x.id !== id));
    if (activeSnapshotId === id) setActiveSnapshotId(null);
  };

  const updateSnapshot = (id: string) => {
    setSnapshots((s) =>
      s.map((x) => (x.id === id ? { ...x, state: { ...scenario, enabled: true }, savedAt: new Date().toISOString() } : x)),
    );
    toast.success("Snapshot updated");
  };

  const activeSnapshot = snapshots.find((s) => s.id === activeSnapshotId) ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCursor(subMonths(cursor, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCursor(addMonths(cursor, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium">{format(cursor, "MMMM yyyy")}</span>
          {summary && summary.count > 0 && (
            <Badge variant="secondary" className="ml-2 gap-1">
              <Gauge className="h-3 w-3" />
              {summary.totalDays.toFixed(1)} d · {summary.count} sized
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {effortFields.length > 1 && (
            <Select value={effortFieldId ?? ""} onValueChange={setEffortFieldId}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Effort field" />
              </SelectTrigger>
              <SelectContent>
                {effortFields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant={showScenario ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowScenario((s) => !s);
              if (!scenario.enabled) setScenario((s) => ({ ...s, enabled: true }));
            }}
            disabled={!effortFieldId}
            className="gap-1.5"
            title={effortFieldId ? "Toggle scenario planning" : "Add a Level of Effort field in Settings → Custom fields"}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Scenario
          </Button>
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5 text-xs">
            {(["priority", "status", "effort"] as const).map((o) => (
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

      {/* Scenario panel */}
      {showScenario && effortFieldId && (
        <div className="flex flex-col gap-2 border-b border-border bg-aura-gradient-subtle px-4 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Scenario</span>
              <button
                className="ml-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
                onClick={() => setScenario((s) => ({ ...s, enabled: !s.enabled }))}
              >
                {scenario.enabled ? "● Live" : "○ Off"}
              </button>
            </div>
            <div className="flex min-w-[260px] items-center gap-3">
              <span className="text-muted-foreground">Effort multiplier</span>
              <Slider
                value={[scenario.multiplier * 100]}
                min={50}
                max={300}
                step={10}
                className="w-44"
                onValueChange={(v) => setScenario((s) => ({ ...s, multiplier: v[0] / 100 }))}
              />
              <span className="w-10 text-right font-mono">{Math.round(scenario.multiplier * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Hours / day</span>
              <input
                type="number"
                min="1"
                max="24"
                value={scenario.hoursPerDay}
                onChange={(e) =>
                  setScenario((s) => ({ ...s, hoursPerDay: Math.max(1, Number(e.target.value) || 8) }))
                }
                className="h-7 w-14 rounded border border-border bg-background px-2 text-xs"
              />
            </div>
            <div className="flex-1" />
            {[0.75, 1, 1.25, 1.5, 2].map((m) => (
              <button
                key={m}
                onClick={() => setScenario((s) => ({ ...s, multiplier: m }))}
                className={`rounded border px-2 py-1 text-[11px] ${
                  Math.abs(scenario.multiplier - m) < 0.01
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {m === 1 ? "Realistic" : m < 1 ? `Optimistic ${m}×` : `Buffer ${m}×`}
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1"
              onClick={() => {
                setScenario(DEFAULT_SCENARIO);
                setActiveSnapshotId(null);
              }}
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
            <Button size="sm" className="h-7 gap-1" onClick={applyScenario}>
              <Save className="h-3 w-3" /> Apply to dates
            </Button>
          </div>

          {/* Snapshots row */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
            <Bookmark className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">Snapshots</span>
            {snapshots.length === 0 && (
              <span className="text-muted-foreground">None saved — capture the current dials as Baseline, Optimistic, Buffer…</span>
            )}
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className={`group flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                  activeSnapshotId === snap.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:bg-accent"
                }`}
              >
                <button onClick={() => loadSnapshot(snap.id)} title={`Load "${snap.name}"`}>
                  {snap.name}
                  <span className="ml-1 font-mono opacity-60">{Math.round(snap.state.multiplier * 100)}%</span>
                </button>
                {activeSnapshotId === snap.id && (
                  <button
                    onClick={() => updateSnapshot(snap.id)}
                    className="rounded p-0.5 hover:bg-background/60"
                    title="Update with current settings"
                  >
                    <Save className="h-2.5 w-2.5" />
                  </button>
                )}
                <button
                  onClick={() => deleteSnapshot(snap.id)}
                  className="rounded p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-destructive/20"
                  title="Delete snapshot"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              <Input
                value={newSnapshotName}
                onChange={(e) => setNewSnapshotName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveSnapshot(newSnapshotName);
                }}
                placeholder="Name (Baseline, Optimistic…)"
                className="h-7 w-44 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1"
                onClick={() => saveSnapshot(newSnapshotName)}
                disabled={!newSnapshotName.trim()}
              >
                <Plus className="h-3 w-3" /> Save
              </Button>
            </div>
          </div>

          {/* Per-task overrides editor */}
          {scenario.enabled && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 self-start rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent">
                  <ChevronDown className="h-3 w-3" />
                  Per-task overrides
                  {Object.keys(scenario.overrides).length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      {Object.keys(scenario.overrides).length}
                    </Badge>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[420px] p-0">
                <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
                  <span className="font-medium">Override per task</span>
                  <button
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setScenario((s) => ({ ...s, overrides: {} }))}
                  >
                    Clear all
                  </button>
                </div>
                <div className="max-h-[320px] overflow-auto p-2">
                  {visibleTasks.filter((t) => readEffort(t, effortFieldId)).length === 0 && (
                    <p className="p-3 text-center text-xs text-muted-foreground">
                      No sized tasks yet.
                    </p>
                  )}
                  {visibleTasks
                    .filter((t) => readEffort(t, effortFieldId))
                    .map((t) => {
                      const e = readEffort(t, effortFieldId)!;
                      const override = scenario.overrides[t.id] ?? 1;
                      return (
                        <div
                          key={t.id}
                          className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50"
                        >
                          <span className="min-w-0 flex-1 truncate text-xs" title={t.title}>
                            {t.title}
                          </span>
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {e.amount}
                            {e.unit === "hours" ? "h" : e.unit === "days" ? "d" : "p"}
                          </span>
                          <Slider
                            value={[override * 100]}
                            min={25}
                            max={300}
                            step={25}
                            className="w-28"
                            onValueChange={(v) =>
                              setScenario((s) => ({
                                ...s,
                                overrides: { ...s.overrides, [t.id]: v[0] / 100 },
                              }))
                            }
                          />
                          <span className="w-10 text-right font-mono text-[10px]">
                            {Math.round(override * 100)}%
                          </span>
                          {scenario.overrides[t.id] !== undefined && (
                            <button
                              onClick={() =>
                                setScenario((s) => {
                                  const next = { ...s.overrides };
                                  delete next[t.id];
                                  return { ...s, overrides: next };
                                })
                              }
                              className="rounded p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                              title="Reset to 100%"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {activeSnapshot && (
            <div className="text-[11px] text-muted-foreground">
              Active snapshot: <span className="font-medium text-foreground">{activeSnapshot.name}</span>
            </div>
          )}
        </div>
      )}


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
                Task {effortFieldId ? "· effort" : ""}
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
              {effortFieldId
                ? "No tasks with dates or effort yet. Add a due date or fill in the Level of Effort field."
                : "No tasks with dates yet. Add a due or start date — or create a Level of Effort field in Settings → Custom fields to plan with effort."}
            </div>
          ) : (
            visibleTasks.map((t) => {
              const r = taskRange(t);
              if (!r) return null;
              const startOffset = differenceInCalendarDays(r.start, range.start);
              const length = Math.max(1, differenceInCalendarDays(r.end, r.start) + 1);
              const left = startOffset * dayPx;
              const width = length * dayPx;
              const status = STATUS_OPTIONS.find((s) => s.value === t.status);
              const priority = PRIORITY_OPTIONS.find((p) => p.value === t.priority);
              const typeMeta = getTaskTypeMeta(t.task_type);
              const effort = readEffort(t, effortFieldId);
              const effortDays = effortToDays(effort, scenario.hoursPerDay);
              let color = typeMeta.color;
              if (colorBy === "priority") color = priority?.color ?? typeMeta.color;
              else if (colorBy === "status") color = status?.color ?? typeMeta.color;
              else if (colorBy === "effort") {
                // gradient from teal (small) → amber → red (huge)
                if (effortDays === 0) color = "oklch(0.7 0.02 240)";
                else if (effortDays < 2) color = "oklch(0.7 0.12 180)";
                else if (effortDays < 5) color = "oklch(0.7 0.14 80)";
                else if (effortDays < 10) color = "oklch(0.65 0.18 40)";
                else color = "oklch(0.6 0.22 25)";
              }
              const done = t.status === "done";
              const barH = typeMeta.barHeight;
              const taskMult = scenario.overrides[t.id] ?? 1;
              return (
                <div
                  key={t.id}
                  className="flex border-b border-border/50"
                  style={{ height: ROW_H }}
                >
                  <div
                    className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border bg-background px-3 text-sm"
                    style={{ width: LABEL_W }}
                  >
                    <button
                      onClick={() => onTaskClick(t.id)}
                      className="min-w-0 flex-1 truncate text-left hover:underline"
                      title={t.title}
                    >
                      {t.title}
                    </button>
                    {effort && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {effort.amount}
                        {effort.unit === "hours" ? "h" : effort.unit === "days" ? "d" : "p"}
                      </span>
                    )}
                    {scenario.enabled && effort && (
                      <select
                        value={taskMult}
                        onChange={(e) =>
                          setScenario((s) => ({
                            ...s,
                            overrides: { ...s.overrides, [t.id]: Number(e.target.value) },
                          }))
                        }
                        className="h-5 shrink-0 rounded border border-border bg-background text-[10px]"
                        title="Per-task scenario multiplier"
                      >
                        <option value={0.5}>0.5×</option>
                        <option value={0.75}>0.75×</option>
                        <option value={1}>1×</option>
                        <option value={1.25}>1.25×</option>
                        <option value={1.5}>1.5×</option>
                        <option value={2}>2×</option>
                      </select>
                    )}
                  </div>
                  <div className="relative flex-1" style={{ width: totalWidth }}>
                    <div
                      className={`group absolute flex cursor-grab items-center text-xs text-white shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${done ? "opacity-60" : ""} ${r.planned ? "ring-1 ring-primary/40" : ""}`}
                      style={{
                        top: (ROW_H - barH) / 2,
                        height: barH,
                        left,
                        width: Math.max(width, 12),
                        background: r.planned
                          ? `repeating-linear-gradient(45deg, ${color}, ${color} 6px, color-mix(in oklab, ${color} 70%, transparent) 6px, color-mix(in oklab, ${color} 70%, transparent) 12px)`
                          : `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 80%, transparent))`,
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
                        if (r.planned) return; // don't drag planned bars; persist via Apply
                        e.preventDefault();
                        setDrag({
                          id: t.id,
                          mode: "move",
                          startX: e.clientX,
                          origStart: r.start,
                          origEnd: r.end,
                        });
                      }}
                      title={
                        r.planned
                          ? "Planned from effort — Apply scenario to commit dates"
                          : `${format(r.start, "MMM d")} → ${format(r.end, "MMM d")}`
                      }
                    >
                      {!r.planned && (
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
                      )}
                      <span
                        className="mx-2 truncate"
                        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
                      >
                        {t.title}
                        {r.planned && " ·"}
                        {r.planned && (
                          <span className="ml-1 opacity-80">{length}d</span>
                        )}
                      </span>
                      {!r.planned && (
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
                      )}
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
