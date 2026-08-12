import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  GripVertical,
  Diamond,
  Link2,
  Link2Off,
  ChevronUp,
  ChevronDown,
  Undo2,
  Redo2,
  Magnet,
  X,
  CalendarClock,
  Activity,
  Waves,
} from "lucide-react";
import {
  EMPTY_PLAN,
  isPlanContent,
  wouldCreateCycle,
  criticalPathIds,
  cascadeForward,
  type PlanContent,
  type PlanItem,
  type PlanLane,
} from "@/lib/plan-types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  initial: unknown;
  onChange: (next: PlanContent) => void;
}

const DAY = 86400000;
const ROW_H = 36;
const ROW_PAD = 6;
const LANE_LABEL_W = 192;

function rid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampPlan(v: unknown): PlanContent {
  if (isPlanContent(v)) return { ...EMPTY_PLAN, ...v, view: { zoom: 36, ...(v.view ?? {}) } };
  return EMPTY_PLAN;
}

function dateRange(items: PlanItem[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let min = today.getTime();
  let max = today.getTime() + 30 * DAY;
  for (const it of items) {
    const s = Date.parse(it.start);
    const e = Date.parse(it.end);
    if (!Number.isNaN(s)) min = Math.min(min, s);
    if (!Number.isNaN(e)) max = Math.max(max, e);
  }
  min -= 2 * DAY;
  max += 2 * DAY;
  const days = Math.max(14, Math.ceil((max - min) / DAY));
  return { start: min, days };
}

const STATUS_COLOR: Record<string, string> = {
  todo: "bg-muted text-foreground",
  in_progress: "bg-primary/80 text-primary-foreground",
  done: "bg-emerald-600/80 text-white",
  blocked: "bg-destructive/80 text-destructive-foreground",
};

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

type DragState =
  | { kind: "move"; itemId: string; startX: number; origStart: string; origEnd: string }
  | { kind: "resize-l"; itemId: string; startX: number; origStart: string }
  | { kind: "resize-r"; itemId: string; startX: number; origEnd: string }
  | { kind: "milestone"; itemId: string; startX: number; origStart: string }
  | { kind: "link"; fromId: string; fromX: number; fromY: number }
  | null;

export function PlanEditor({ initial, onChange }: Props) {
  const [plan, setPlan] = useState<PlanContent>(() => clampPlan(initial));
  // Undo/redo stacks of full PlanContent snapshots
  const undoStack = useRef<PlanContent[]>([]);
  const redoStack = useRef<PlanContent[]>([]);
  // While dragging, we coalesce intermediate states into a single history entry
  const dragHistoryPushed = useRef(false);

  const commit = (next: PlanContent, opts: { history?: boolean } = { history: true }) => {
    if (opts.history !== false) {
      undoStack.current.push(plan);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
    }
    setPlan(next);
    onChange(next);
  };
  // alias for previous call sites
  const update = (next: PlanContent) => commit(next);

  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(plan);
    setPlan(prev);
    onChange(prev);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(plan);
    setPlan(next);
    onChange(next);
  };

  // Selected items (multi-select)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const clearSelection = () => setSelectedIds(new Set());
  const selectOnly = (id: string) => setSelectedIds(new Set([id]));
  const toggleSelect = (id: string) =>
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Marquee selection state (in surface coords)
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number; additive: boolean; ids: Set<string> } | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (meta && ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y")) {
        e.preventDefault(); redo(); return;
      }
      if (e.key === "Escape") { clearSelection(); return; }
      if (selectedIds.size === 0) return;
      const ids = selectedIds;
      const step = Math.max(1, plan.view?.snapDays ?? 1);
      const delta = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      if (delta === 0 && e.key !== "Delete" && e.key !== "Backspace") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        commit({
          ...plan,
          items: plan.items
            .filter((i) => !ids.has(i.id))
            .map((i) =>
              i.deps?.some((d) => ids.has(d))
                ? { ...i, deps: i.deps.filter((d) => !ids.has(d)) }
                : i,
            ),
        });
        clearSelection();
        return;
      }
      e.preventDefault();
      const mode: "move" | "resize-r" | "resize-l" =
        e.shiftKey && !e.altKey ? "resize-r" : e.altKey && !e.shiftKey ? "resize-l" : "move";
      let nextItems = plan.items.map((i) => {
        if (!ids.has(i.id)) return i;
        const s = Date.parse(i.start);
        const en = Date.parse(i.end);
        if (mode === "resize-r") return { ...i, end: isoDate(Math.max(s, en + delta * DAY)) };
        if (mode === "resize-l") return { ...i, start: isoDate(Math.min(en, s + delta * DAY)) };
        return { ...i, start: isoDate(s + delta * DAY), end: isoDate(en + delta * DAY) };
      });
      if (plan.view?.autoCascade && mode === "move") {
        for (const id of ids) nextItems = cascadeForward(nextItems, id);
      }
      commit({ ...plan, items: nextItems });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, selectedIds]);

  const colW = Math.max(16, Math.min(120, plan.view?.zoom ?? 36));
  const snapDays = Math.max(0, plan.view?.snapDays ?? 1);
  const setZoom = (z: number) => update({ ...plan, view: { ...(plan.view ?? {}), zoom: z } });
  const setSnap = (s: number) =>
    update({ ...plan, view: { ...(plan.view ?? {}), snapDays: s } });

  // Ordered lanes from view.laneOrder (fall back to natural order)
  const orderedLanes = useMemo<PlanLane[]>(() => {
    const order = plan.view?.laneOrder ?? [];
    if (!order.length) return plan.lanes;
    const byId = new Map(plan.lanes.map((l) => [l.id, l]));
    const result: PlanLane[] = [];
    for (const id of order) {
      const l = byId.get(id);
      if (l) {
        result.push(l);
        byId.delete(id);
      }
    }
    for (const l of plan.lanes) if (byId.has(l.id)) result.push(l);
    return result;
  }, [plan.lanes, plan.view?.laneOrder]);

  const setLaneOrder = (ids: string[]) =>
    update({ ...plan, view: { ...(plan.view ?? {}), laneOrder: ids } });

  const moveLane = (laneId: string, delta: number) => {
    const ids = orderedLanes.map((l) => l.id);
    const i = ids.indexOf(laneId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setLaneOrder(ids);
  };

  const { start, days } = useMemo(() => dateRange(plan.items), [plan.items]);

  const addLane = () => {
    const lane: PlanLane = { id: rid("lane"), name: "New lane" };
    const lanes = [...plan.lanes, lane];
    update({
      ...plan,
      lanes,
      view: { ...(plan.view ?? {}), laneOrder: [...orderedLanes.map((l) => l.id), lane.id] },
    });
  };
  const renameLane = (id: string, name: string) => {
    update({ ...plan, lanes: plan.lanes.map((l) => (l.id === id ? { ...l, name } : l)) });
  };
  const removeLane = (id: string) => {
    update({
      ...plan,
      lanes: plan.lanes.filter((l) => l.id !== id),
      items: plan.items.filter((i) => i.lane !== id),
      view: {
        ...(plan.view ?? {}),
        laneOrder: (plan.view?.laneOrder ?? []).filter((l) => l !== id),
      },
    });
  };
  const addItem = (laneId: string, kind: "task" | "milestone" = "task") => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const s = today.toISOString().slice(0, 10);
    const e = new Date(today.getTime() + (kind === "milestone" ? 0 : 4 * DAY))
      .toISOString()
      .slice(0, 10);
    const it: PlanItem = {
      id: rid(kind === "milestone" ? "ms" : "item"),
      title: kind === "milestone" ? "Milestone" : "New item",
      lane: laneId,
      start: s,
      end: e,
      status: "todo",
      kind,
    };
    update({ ...plan, items: [...plan.items, it] });
  };
  const patchItem = (id: string, p: Partial<PlanItem>, opts: { history?: boolean } = {}) => {
    commit(
      { ...plan, items: plan.items.map((i) => (i.id === id ? { ...i, ...p } : i)) },
      opts,
    );
  };
  const removeItem = (id: string) =>
    update({
      ...plan,
      items: plan.items
        .filter((i) => i.id !== id)
        .map((i) => (i.deps?.includes(id) ? { ...i, deps: i.deps.filter((d) => d !== id) } : i)),
    });

  const addDep = (toId: string, fromId: string) => {
    if (toId === fromId) return;
    const target = plan.items.find((i) => i.id === toId);
    if (!target) return;
    if ((target.deps ?? []).includes(fromId)) {
      toast.info("Dependency already exists");
      return;
    }
    if (wouldCreateCycle(plan.items, fromId, toId)) {
      toast.error("Cannot link: would create a dependency cycle");
      return;
    }
    patchItem(toId, { deps: [...(target.deps ?? []), fromId] });
  };
  const removeDep = (toId: string, fromId: string) => {
    const target = plan.items.find((i) => i.id === toId);
    if (!target) return;
    patchItem(toId, { deps: (target.deps ?? []).filter((d) => d !== fromId) });
  };
  const toggleDep = (toId: string, fromId: string) => {
    const target = plan.items.find((i) => i.id === toId);
    if (!target) return;
    if ((target.deps ?? []).includes(fromId)) removeDep(toId, fromId);
    else addDep(toId, fromId);
  };

  const headerDays = useMemo(
    () => Array.from({ length: days }, (_, i) => new Date(start + i * DAY)),
    [start, days],
  );

  // Drag handling for bars / resize / milestones
  const dragRef = useRef<DragState>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  // Live cursor coords (relative to timeline surface) while link-dragging
  const [linkCursor, setLinkCursor] = useState<{ x: number; y: number; from: string } | null>(null);
  const [hoverDropId, setHoverDropId] = useState<string | null>(null);

  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;

      if (d.kind === "link") {
        const surface = surfaceRef.current;
        if (!surface) return;
        const rect = surface.getBoundingClientRect();
        setLinkCursor({
          x: ev.clientX - rect.left + surface.scrollLeft,
          y: ev.clientY - rect.top + surface.scrollTop,
          from: d.fromId,
        });
        return;
      }

      const dx = ev.clientX - d.startX;
      const rawDays = dx / colW;
      const step = snapDays > 0 ? snapDays : 0;
      const dDays = step > 0 ? Math.round(rawDays / step) * step : Math.round(rawDays);
      const useHistory = !dragHistoryPushed.current;
      if (useHistory) dragHistoryPushed.current = true;
      const histOpt = { history: useHistory };

      if (d.kind === "move") {
        const ns = Date.parse(d.origStart) + dDays * DAY;
        const ne = Date.parse(d.origEnd) + dDays * DAY;
        const updated = plan.items.map((i) =>
          i.id === d.itemId ? { ...i, start: isoDate(ns), end: isoDate(ne) } : i,
        );
        const cascaded = plan.view?.autoCascade ? cascadeForward(updated, d.itemId) : updated;
        commit({ ...plan, items: cascaded }, histOpt);
      } else if (d.kind === "resize-l") {
        const item = plan.items.find((i) => i.id === d.itemId);
        if (!item) return;
        const ns = Math.min(Date.parse(d.origStart) + dDays * DAY, Date.parse(item.end));
        patchItem(d.itemId, { start: isoDate(ns) }, histOpt);
      } else if (d.kind === "resize-r") {
        const item = plan.items.find((i) => i.id === d.itemId);
        if (!item) return;
        const ne = Math.max(Date.parse(d.origEnd) + dDays * DAY, Date.parse(item.start));
        const updated = plan.items.map((i) => (i.id === d.itemId ? { ...i, end: isoDate(ne) } : i));
        const cascaded = plan.view?.autoCascade ? cascadeForward(updated, d.itemId) : updated;
        commit({ ...plan, items: cascaded }, histOpt);
      } else if (d.kind === "milestone") {
        const ns = Date.parse(d.origStart) + dDays * DAY;
        patchItem(d.itemId, { start: isoDate(ns), end: isoDate(ns) }, histOpt);
      }
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d?.kind === "link" && hoverDropId && hoverDropId !== d.fromId) {
        addDep(hoverDropId, d.fromId);
      }
      dragRef.current = null;
      dragHistoryPushed.current = false;
      setLinkCursor(null);
      setHoverDropId(null);
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [colW, snapDays, plan.items, hoverDropId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Layout: per-lane row index for items + global y offsets per lane
  const layout = useMemo(() => {
    const laneItems = new Map<string, PlanItem[]>();
    for (const lane of orderedLanes) laneItems.set(lane.id, []);
    for (const it of plan.items) {
      const arr = laneItems.get(it.lane);
      if (arr) arr.push(it);
    }
    const itemRow = new Map<string, number>();
    const laneRows = new Map<string, number>();
    let y = 0;
    const laneTop = new Map<string, number>();
    for (const lane of orderedLanes) {
      laneTop.set(lane.id, y);
      const arr = laneItems.get(lane.id) ?? [];
      arr.forEach((it, idx) => itemRow.set(it.id, idx));
      const rows = Math.max(1, arr.length);
      laneRows.set(lane.id, rows);
      y += rows * ROW_H + ROW_PAD * 2;
    }
    return { itemRow, laneTop, laneRows, totalHeight: y, laneItems };
  }, [orderedLanes, plan.items]);

  const itemBox = (it: PlanItem) => {
    const s = Date.parse(it.start);
    const e = Date.parse(it.end);
    if (Number.isNaN(s) || Number.isNaN(e)) return null;
    const top = (layout.laneTop.get(it.lane) ?? 0) + ROW_PAD + (layout.itemRow.get(it.id) ?? 0) * ROW_H;
    const left = ((s - start) / DAY) * colW;
    const width = Math.max(colW, ((e - s) / DAY + 1) * colW - 4);
    return { top, left, width };
  };

  const [hoverItem, setHoverItem] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  // Highlights a specific edge from -> to when hovering a dep chip / candidate
  const [hoverEdge, setHoverEdge] = useState<{ from: string; to: string } | null>(null);

  const isDepHighlighted = (itemId: string) => {
    if (!hoverItem) return false;
    if (hoverItem === itemId) return true;
    const hovered = plan.items.find((i) => i.id === hoverItem);
    if (hovered?.deps?.includes(itemId)) return true;
    // also highlight items that depend on the hovered one
    const depender = plan.items.find((i) => i.id === itemId);
    if (depender?.deps?.includes(hoverItem)) return true;
    return false;
  };

  // Build SVG arrow paths for deps
  const arrows = useMemo(() => {
    const out: { id: string; d: string; from: string; to: string }[] = [];
    for (const it of plan.items) {
      for (const depId of it.deps ?? []) {
        const fromBox = (() => {
          const f = plan.items.find((x) => x.id === depId);
          return f ? itemBox(f) : null;
        })();
        const toBox = itemBox(it);
        if (!fromBox || !toBox) continue;
        const fx = fromBox.left + fromBox.width;
        const fy = fromBox.top + (ROW_H - ROW_PAD * 2) / 2 + ROW_PAD - 2;
        const tx = toBox.left;
        const ty = toBox.top + (ROW_H - ROW_PAD * 2) / 2 + ROW_PAD - 2;
        const mx = (fx + tx) / 2;
        const d = `M ${fx} ${fy} C ${mx} ${fy} ${mx} ${ty} ${tx} ${ty}`;
        out.push({ id: `${depId}->${it.id}`, d, from: depId, to: it.id });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.items, layout, colW, start]);

  const showCritical = !!plan.view?.showCriticalPath;
  const autoCascade = !!plan.view?.autoCascade;
  const criticalIds = useMemo(
    () => (showCritical ? criticalPathIds(plan.items) : new Set<string>()),
    [showCritical, plan.items],
  );
  const setCritical = (v: boolean) =>
    update({ ...plan, view: { ...(plan.view ?? {}), showCriticalPath: v } });
  const setAutoCascade = (v: boolean) =>
    update({ ...plan, view: { ...(plan.view ?? {}), autoCascade: v } });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-medium text-muted-foreground">Timeline</h3>
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={undo}
            disabled={undoStack.current.length === 0}
            title="Undo (⌘Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={redo}
            disabled={redoStack.current.length === 0}
            title="Redo (⌘⇧Z)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-6 w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1" title="Snap to grid">
                <Magnet className={cn("h-3.5 w-3.5", snapDays > 0 ? "text-primary" : "")} />
                <span className="text-xs">
                  {snapDays === 0 ? "Free" : snapDays === 1 ? "1d" : `${snapDays}d`}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Snap to grid</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[
                { v: 0, label: "Free (no snap)" },
                { v: 1, label: "1 day" },
                { v: 7, label: "1 week" },
              ].map((opt) => (
                <DropdownMenuItem key={opt.v} onClick={() => setSnap(opt.v)}>
                  <span className={cn("mr-2 h-2 w-2 rounded-full", snapDays === opt.v ? "bg-primary" : "bg-transparent")} />
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="mx-1 h-6 w-px bg-border" />
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom(Math.max(16, colW - 8))} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 px-2 text-xs w-20" title="Zoom preset">
                {colW <= 20 ? "Quarter" : colW <= 32 ? "Month" : colW <= 56 ? "Week" : "Day"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Zoom preset</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[
                { v: 18, label: "Quarter" },
                { v: 28, label: "Month" },
                { v: 44, label: "Week" },
                { v: 80, label: "Day" },
              ].map((opt) => (
                <DropdownMenuItem key={opt.v} onClick={() => setZoom(opt.v)}>
                  <span className={cn("mr-2 h-2 w-2 rounded-full", colW === opt.v ? "bg-primary" : "bg-transparent")} />
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom(Math.min(120, colW + 8))} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            onClick={() => {
              const surface = surfaceRef.current;
              if (!surface) return;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const offset = ((today.getTime() - start) / DAY) * colW;
              surface.scrollTo({ left: Math.max(0, offset - surface.clientWidth / 3), behavior: "smooth" });
            }}
            title="Jump to today"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            <span className="text-xs">Today</span>
          </Button>
          <Button
            size="sm"
            variant={showCritical ? "default" : "outline"}
            className="h-8 gap-1"
            onClick={() => setCritical(!showCritical)}
            title="Highlight the longest dependency chain"
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="text-xs">Critical</span>
          </Button>
          <Button
            size="sm"
            variant={autoCascade ? "default" : "outline"}
            className="h-8 gap-1"
            onClick={() => setAutoCascade(!autoCascade)}
            title="Auto-cascade: push successors when a predecessor moves"
          >
            <Waves className="h-3.5 w-3.5" />
            <span className="text-xs">Cascade</span>
          </Button>
          <Button size="sm" variant="outline" onClick={addLane} className="ml-2">
            <Plus className="mr-1 h-3.5 w-3.5" /> Lane
          </Button>
        </div>
      </div>

      {linkFrom && (
        <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs flex items-center justify-between">
          <span>
            Click a target item to add dependency from{" "}
            <strong>{plan.items.find((i) => i.id === linkFrom)?.title ?? linkFrom}</strong>
          </span>
          <Button size="sm" variant="ghost" onClick={() => setLinkFrom(null)}>
            Cancel
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border" ref={surfaceRef}>
        <div className="min-w-max">
          {/* header */}
          <div className="flex sticky top-0 bg-background z-10 border-b">
            <div
              className="shrink-0 px-2 py-1 text-xs font-medium text-muted-foreground border-r"
              style={{ width: LANE_LABEL_W }}
            >
              Lane
            </div>
            <div className="flex">
              {headerDays.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "shrink-0 text-[10px] text-center text-muted-foreground border-r py-1",
                    d.getDay() === 0 || d.getDay() === 6 ? "bg-muted/40" : "",
                  )}
                  style={{ width: colW }}
                >
                  <div>{d.toLocaleDateString(undefined, { month: "short" })}</div>
                  <div className="font-semibold text-foreground">{d.getDate()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* body */}
          <div className="flex">
            {/* lane labels */}
            <div className="shrink-0 border-r" style={{ width: LANE_LABEL_W }}>
              {orderedLanes.map((lane) => {
                const rows = layout.laneRows.get(lane.id) ?? 1;
                return (
                  <div
                    key={lane.id}
                    className="border-b group flex items-start gap-1 px-1 py-1"
                    style={{ height: rows * ROW_H + ROW_PAD * 2 }}
                  >
                    <div className="flex flex-col gap-0.5 pt-1">
                      <button
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => moveLane(lane.id, -1)}
                        title="Move up"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <GripVertical className="h-3 w-3 text-muted-foreground/40" />
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => moveLane(lane.id, 1)}
                        title="Move down"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <Input
                      value={lane.name}
                      onChange={(e) => renameLane(lane.id, e.target.value)}
                      className="h-7 border-0 bg-transparent px-1 text-sm font-medium focus-visible:ring-1"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          title="Add to lane"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => addItem(lane.id, "task")}>
                          <Plus className="mr-2 h-4 w-4" /> Task bar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addItem(lane.id, "milestone")}>
                          <Diamond className="mr-2 h-4 w-4" /> Milestone
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={() => removeLane(lane.id)}
                      title="Delete lane"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* timeline surface */}
            <div
              className="relative select-none"
              style={{ width: days * colW, height: layout.totalHeight }}
              onMouseDown={(ev) => {
                if (ev.button !== 0) return;
                if ((ev.target as HTMLElement).closest("[data-item]")) return;
                const surface = ev.currentTarget;
                const rect = surface.getBoundingClientRect();
                const x = ev.clientX - rect.left;
                const y = ev.clientY - rect.top;
                marqueeStartRef.current = {
                  x,
                  y,
                  additive: ev.shiftKey || ev.metaKey || ev.ctrlKey,
                  ids: new Set(selectedIds),
                };
                setMarquee({ x0: x, y0: y, x1: x, y1: y });
                if (!ev.shiftKey && !ev.metaKey && !ev.ctrlKey) clearSelection();
                const onMove = (e: MouseEvent) => {
                  const start = marqueeStartRef.current;
                  if (!start) return;
                  const nx = e.clientX - rect.left;
                  const ny = e.clientY - rect.top;
                  const x0 = Math.min(start.x, nx);
                  const y0 = Math.min(start.y, ny);
                  const x1 = Math.max(start.x, nx);
                  const y1 = Math.max(start.y, ny);
                  setMarquee({ x0, y0, x1, y1 });
                  // compute selection
                  const next = new Set(start.additive ? start.ids : []);
                  for (const it of plan.items) {
                    const b = itemBox(it);
                    if (!b) continue;
                    const bx0 = b.left;
                    const by0 = b.top;
                    const bx1 = b.left + b.width;
                    const by1 = b.top + ROW_H - ROW_PAD * 2;
                    if (bx0 < x1 && bx1 > x0 && by0 < y1 && by1 > y0) next.add(it.id);
                  }
                  setSelectedIds(next);
                };
                const onUp = () => {
                  marqueeStartRef.current = null;
                  setMarquee(null);
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
            >
              {/* day grid */}
              {headerDays.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "absolute top-0 bottom-0 border-r border-border/40",
                    d.getDay() === 0 || d.getDay() === 6 ? "bg-muted/20" : "",
                  )}
                  style={{ left: i * colW, width: colW }}
                />
              ))}
              {/* today line */}
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const off = ((today.getTime() - start) / DAY) * colW + colW / 2;
                if (off < 0 || off > days * colW) return null;
                return (
                  <div
                    className="absolute top-0 bottom-0 z-[1] pointer-events-none"
                    style={{ left: off, width: 0, borderLeft: "2px solid hsl(var(--primary) / 0.7)" }}
                    title="Today"
                  />
                );
              })()}
              {/* lane separators */}
              {orderedLanes.map((lane) => {
                const top = layout.laneTop.get(lane.id) ?? 0;
                const rows = layout.laneRows.get(lane.id) ?? 1;
                return (
                  <div
                    key={lane.id}
                    className="absolute left-0 right-0 border-b"
                    style={{ top: top + rows * ROW_H + ROW_PAD * 2 - 1, height: 0 }}
                  />
                );
              })}

              {/* dependency arrows */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={days * colW}
                height={layout.totalHeight}
              >
                <defs>
                  <marker id="plan-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
                  </marker>
                  <marker id="plan-arrow-hi" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
                  </marker>
                </defs>
                {arrows.map((a) => {
                  const hi =
                    hoverItem === a.from ||
                    hoverItem === a.to ||
                    (hoverEdge && hoverEdge.from === a.from && hoverEdge.to === a.to);
                  const crit = showCritical && criticalIds.has(a.from) && criticalIds.has(a.to);
                  return (
                    <path
                      key={a.id}
                      d={a.d}
                      fill="none"
                      strokeWidth={hi || crit ? 2.5 : 1.5}
                      className={
                        crit
                          ? "stroke-amber-500"
                          : hi
                            ? "stroke-primary"
                            : "stroke-muted-foreground/60"
                      }
                      markerEnd={hi || crit ? "url(#plan-arrow-hi)" : "url(#plan-arrow)"}
                    />
                  );
                })}
                {/* Live link drag preview */}
                {linkCursor && (() => {
                  const from = plan.items.find((i) => i.id === linkCursor.from);
                  if (!from) return null;
                  const fb = itemBox(from);
                  if (!fb) return null;
                  const fx = fb.left + fb.width;
                  const fy = fb.top + (ROW_H - ROW_PAD * 2) / 2 + ROW_PAD - 2;
                  const tx = linkCursor.x;
                  const ty = linkCursor.y;
                  const mx = (fx + tx) / 2;
                  const d = `M ${fx} ${fy} C ${mx} ${fy} ${mx} ${ty} ${tx} ${ty}`;
                  return (
                    <path
                      d={d}
                      fill="none"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      className="stroke-primary"
                      markerEnd="url(#plan-arrow-hi)"
                    />
                  );
                })()}
              </svg>

              {/* items */}
              {plan.items.map((it) => {
                const box = itemBox(it);
                if (!box) return null;
                const isMilestone = it.kind === "milestone";
                const dim = hoverItem && !isDepHighlighted(it.id) ? "opacity-30" : "";
                const isLinkSource = linkFrom === it.id;

                if (isMilestone) {
                  // diamond at start position
                  const cx = box.left + colW / 2;
                  const cy = box.top + (ROW_H - ROW_PAD * 2) / 2 + ROW_PAD - 2;
                  return (
                    <div
                      key={it.id}
                      data-item
                      className={cn("absolute group/item transition-opacity", dim)}
                      style={{ left: cx - 12, top: cy - 12, width: 24, height: 24 }}
                      onMouseEnter={() => {
                        setHoverItem(it.id);
                        if (linkCursor && linkCursor.from !== it.id) setHoverDropId(it.id);
                      }}
                      onMouseLeave={() => {
                        setHoverItem(null);
                        setHoverDropId((cur) => (cur === it.id ? null : cur));
                      }}
                      onClick={(ev) => {
                        if (linkFrom && linkFrom !== it.id) {
                          toggleDep(it.id, linkFrom);
                          setLinkFrom(null);
                        } else if (ev.shiftKey || ev.metaKey || ev.ctrlKey) {
                          toggleSelect(it.id);
                        } else {
                          selectOnly(it.id);
                        }
                      }}
                      title={`${it.title} • ${it.start}`}
                    >
                      <div
                        className={cn(
                          "h-6 w-6 rotate-45 border-2 cursor-grab active:cursor-grabbing shadow-sm",
                          STATUS_COLOR[it.status ?? "todo"],
                          isLinkSource ? "ring-2 ring-primary" : "border-foreground/40",
                          showCritical && criticalIds.has(it.id) ? "ring-2 ring-amber-500" : "",
                        )}
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          dragRef.current = {
                            kind: "milestone",
                            itemId: it.id,
                            startX: ev.clientX,
                            origStart: it.start,
                          };
                          document.body.style.cursor = "grabbing";
                        }}
                      />
                      <div className="absolute left-7 top-0 whitespace-nowrap text-[11px] bg-background/80 backdrop-blur px-1 rounded">
                        {it.title}
                      </div>
                    </div>
                  );
                }

                const isLinkDragging = !!linkCursor;
                const isDropTarget = isLinkDragging && hoverDropId === it.id && linkCursor!.from !== it.id;
                const dropInvalid =
                  isLinkDragging &&
                  linkCursor!.from === it.id;
                const dropCycle =
                  isDropTarget &&
                  (wouldCreateCycle(plan.items, linkCursor!.from, it.id) ||
                    (plan.items.find((x) => x.id === it.id)?.deps ?? []).includes(linkCursor!.from));

                return (
                  <div
                    key={it.id}
                    data-item
                    className={cn(
                      "absolute h-7 rounded text-xs flex items-stretch shadow-sm group/item transition-opacity",
                      STATUS_COLOR[it.status ?? "todo"],
                      isLinkSource ? "ring-2 ring-primary" : "",
                      isDropTarget && !dropCycle ? "ring-2 ring-primary" : "",
                      dropCycle ? "ring-2 ring-destructive" : "",
                      selectedIds.has(it.id) ? "ring-2 ring-primary/80" : "",
                      showCritical && criticalIds.has(it.id) ? "ring-2 ring-amber-500" : "",
                      dim,
                    )}
                    style={{ left: box.left + 2, width: box.width, top: box.top }}
                    onMouseEnter={() => {
                      setHoverItem(it.id);
                      if (isLinkDragging && !dropInvalid) setHoverDropId(it.id);
                    }}
                    onMouseLeave={() => {
                      setHoverItem(null);
                      if (isLinkDragging) setHoverDropId((cur) => (cur === it.id ? null : cur));
                    }}
                    onClick={(ev) => {
                      if (linkFrom && linkFrom !== it.id) {
                        toggleDep(it.id, linkFrom);
                        setLinkFrom(null);
                      } else if (ev.shiftKey || ev.metaKey || ev.ctrlKey) {
                        toggleSelect(it.id);
                      } else {
                        selectOnly(it.id);
                      }
                    }}
                    title={`${it.title}\n${it.start} → ${it.end}`}
                  >
                    {/* left resize */}
                    <div
                      className="w-1.5 cursor-ew-resize hover:bg-foreground/20 rounded-l"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        dragRef.current = {
                          kind: "resize-l",
                          itemId: it.id,
                          startX: ev.clientX,
                          origStart: it.start,
                        };
                      }}
                    />
                    {/* body / move */}
                    <div
                      className="flex-1 px-2 flex items-center gap-1 cursor-grab active:cursor-grabbing min-w-0"
                      onMouseDown={(ev) => {
                        if ((ev.target as HTMLElement).closest("[data-stop]")) return;
                        ev.preventDefault();
                        dragRef.current = {
                          kind: "move",
                          itemId: it.id,
                          startX: ev.clientX,
                          origStart: it.start,
                          origEnd: it.end,
                        };
                        document.body.style.cursor = "grabbing";
                      }}
                      onDoubleClick={() => {
                        const t = prompt("Rename item", it.title);
                        if (t !== null) patchItem(it.id, { title: t });
                      }}
                    >
                      <span className="truncate flex-1">{it.title}</span>
                      <button
                        data-stop
                        className="opacity-0 group-hover/item:opacity-100"
                        title={linkFrom === it.id ? "Cancel link" : "Link from this item"}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setLinkFrom(linkFrom === it.id ? null : it.id);
                        }}
                      >
                        <Link2 className="h-3 w-3" />
                      </button>
                      <button
                        data-stop
                        className="opacity-0 group-hover/item:opacity-100"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          removeItem(it.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    {/* right resize */}
                    <div
                      className="w-1.5 cursor-ew-resize hover:bg-foreground/20 rounded-r"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        dragRef.current = {
                          kind: "resize-r",
                          itemId: it.id,
                          startX: ev.clientX,
                          origEnd: it.end,
                        };
                      }}
                    />
                    {/* Drag-to-link handle (right side, outside bar) */}
                    <button
                      data-stop
                      title="Drag to link to another item"
                      className="absolute -right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary border-2 border-background shadow-sm opacity-0 group-hover/item:opacity-100 hover:scale-125 transition cursor-crosshair"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        const surface = surfaceRef.current;
                        if (!surface) return;
                        const rect = surface.getBoundingClientRect();
                        dragRef.current = {
                          kind: "link",
                          fromId: it.id,
                          fromX: ev.clientX,
                          fromY: ev.clientY,
                        };
                        setLinkCursor({
                          x: ev.clientX - rect.left + surface.scrollLeft,
                          y: ev.clientY - rect.top + surface.scrollTop,
                          from: it.id,
                        });
                        document.body.style.cursor = "crosshair";
                      }}
                    />
                  </div>
                );
              })}
              {marquee && (
                <div
                  className="absolute pointer-events-none border border-primary/60 bg-primary/10 rounded-sm"
                  style={{
                    left: marquee.x0,
                    top: marquee.y0,
                    width: marquee.x1 - marquee.x0,
                    height: marquee.y1 - marquee.y0,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail editor */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-muted-foreground">Items</h3>
        <div className="rounded-lg border divide-y">
          {plan.items.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">
              No items yet. Hover a lane and click + to add a task or milestone.
            </div>
          )}
          {plan.items.map((it) => {
            const deps = it.deps ?? [];
            const depItems = deps
              .map((id) => plan.items.find((i) => i.id === id))
              .filter((x): x is PlanItem => !!x);
            const incomingItems = plan.items.filter((other) =>
              (other.deps ?? []).includes(it.id),
            );
            const candidates = plan.items.filter(
              (other) =>
                other.id !== it.id &&
                !deps.includes(other.id) &&
                !wouldCreateCycle(plan.items, other.id, it.id),
            );
            const jumpTo = (targetId: string) => {
              const target = plan.items.find((i) => i.id === targetId);
              if (!target) return;
              const tb = itemBox(target);
              const surface = surfaceRef.current;
              if (!tb || !surface) return;
              surface.scrollTo({
                left: Math.max(0, tb.left - 80),
                top: Math.max(0, tb.top - 40),
                behavior: "smooth",
              });
              setHoverItem(targetId);
              window.setTimeout(() => setHoverItem(null), 1500);
            };
            return (
              <div key={it.id} className="space-y-2 p-2 text-sm">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-3 h-8"
                    value={it.title}
                    onChange={(e) => patchItem(it.id, { title: e.target.value })}
                  />
                  <select
                    className="col-span-2 h-8 rounded-md border bg-background px-2 text-xs"
                    value={it.lane}
                    onChange={(e) => patchItem(it.id, { lane: e.target.value })}
                  >
                    {plan.lanes.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="date"
                    className="col-span-2 h-8"
                    value={it.start}
                    onChange={(e) =>
                      patchItem(it.id, {
                        start: e.target.value,
                        end: it.kind === "milestone" ? e.target.value : it.end,
                      })
                    }
                  />
                  <Input
                    type="date"
                    className="col-span-2 h-8"
                    value={it.end}
                    disabled={it.kind === "milestone"}
                    onChange={(e) => patchItem(it.id, { end: e.target.value })}
                  />
                  <select
                    className="col-span-2 h-8 rounded-md border bg-background px-1 text-xs"
                    value={it.status ?? "todo"}
                    onChange={(e) => patchItem(it.id, { status: e.target.value as PlanItem["status"] })}
                  >
                    <option value="todo">Todo</option>
                    <option value="in_progress">Active</option>
                    <option value="done">Done</option>
                    <option value="blocked">Blocked</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="col-span-1 h-8 w-8 text-destructive"
                    onClick={() => removeItem(it.id)}
                    title="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Dependency summary panel */}
                <div className="rounded-md border bg-muted/20 p-2 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 min-w-[88px]">
                      <Link2 className="h-3 w-3" /> Depends on
                      <span className="rounded bg-muted px-1 text-[10px]">{depItems.length}</span>
                    </span>
                    {depItems.length === 0 && (
                      <span className="text-[11px] text-muted-foreground/70 italic">none</span>
                    )}
                    {depItems.map((d) => (
                      <span
                        key={d.id}
                        className="group/chip inline-flex items-center gap-0.5 rounded-full border bg-background px-1 py-0.5 text-[11px]"
                        onMouseEnter={() => setHoverEdge({ from: d.id, to: it.id })}
                        onMouseLeave={() => setHoverEdge(null)}
                      >
                        <button
                          type="button"
                          className="max-w-[140px] truncate hover:text-primary px-1"
                          onClick={() => jumpTo(d.id)}
                          title="Jump to item"
                        >
                          {d.title}
                        </button>
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                          onClick={() => removeDep(it.id, d.id)}
                          title="Unlink"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {candidates.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-[11px]">
                            <Plus className="h-3 w-3" /> Add
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuLabel>Add dependency</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {candidates.map((other) => (
                            <DropdownMenuItem
                              key={other.id}
                              onClick={() => addDep(it.id, other.id)}
                              onMouseEnter={() => setHoverEdge({ from: other.id, to: it.id })}
                              onMouseLeave={() => setHoverEdge(null)}
                            >
                              {other.title}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {deps.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                        onClick={() => patchItem(it.id, { deps: [] })}
                        title="Clear all dependencies"
                      >
                        <Link2Off className="mr-1 h-3 w-3" /> Clear
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 min-w-[88px]">
                      <Link2 className="h-3 w-3 -scale-x-100" /> Blocks
                      <span className="rounded bg-muted px-1 text-[10px]">{incomingItems.length}</span>
                    </span>
                    {incomingItems.length === 0 && (
                      <span className="text-[11px] text-muted-foreground/70 italic">none</span>
                    )}
                    {incomingItems.map((d) => (
                      <span
                        key={d.id}
                        className="group/chip inline-flex items-center gap-0.5 rounded-full border bg-background px-1 py-0.5 text-[11px]"
                        onMouseEnter={() => setHoverEdge({ from: it.id, to: d.id })}
                        onMouseLeave={() => setHoverEdge(null)}
                      >
                        <button
                          type="button"
                          className="max-w-[140px] truncate hover:text-primary px-1"
                          onClick={() => jumpTo(d.id)}
                          title="Jump to item"
                        >
                          {d.title}
                        </button>
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                          onClick={() => removeDep(d.id, it.id)}
                          title="Unlink"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
