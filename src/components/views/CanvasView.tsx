import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Task, ViewConfig } from "@/lib/types";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "@/lib/types";
import { useUpdateView } from "@/hooks/use-views";
import { Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Pos = { x: number; y: number };
type Positions = Record<string, Pos>;

const CARD_W = 220;
const CARD_H = 120;
const GAP_X = 32;
const GAP_Y = 32;
const COLS = 4;

function autoLayout(tasks: Task[], existing: Positions): Positions {
  const next: Positions = { ...existing };
  let i = 0;
  for (const t of tasks) {
    if (next[t.id]) continue;
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    next[t.id] = {
      x: 60 + col * (CARD_W + GAP_X),
      y: 60 + row * (CARD_H + GAP_Y),
    };
    i++;
  }
  return next;
}

export function CanvasView({
  projectId,
  viewId,
  tasks,
  viewConfig,
  onTaskClick,
}: {
  projectId: string;
  viewId: string | null;
  tasks: Task[];
  viewConfig: ViewConfig;
  onTaskClick?: (id: string) => void;
}) {
  const updateView = useUpdateView(projectId);

  // Local positions: hydrate from view config + auto-place new tasks
  const [positions, setPositions] = useState<Positions>(() =>
    autoLayout(tasks, viewConfig.canvasPositions ?? {}),
  );

  // Sync when tasks list changes (new tasks need a slot)
  useEffect(() => {
    setPositions((prev) => autoLayout(tasks, prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.map((t) => t.id).join("|")]);

  // Pan + zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingTask = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panning = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const persist = useCallback(
    (next: Positions) => {
      if (!viewId) return;
      updateView.mutate({
        id: viewId,
        config: { ...viewConfig, canvasPositions: next },
      });
    },
    [viewId, viewConfig, updateView],
  );

  const onCardPointerDown = (e: React.PointerEvent, taskId: string) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = positions[taskId] ?? { x: 0, y: 0 };
    draggingTask.current = {
      id: taskId,
      startX: e.clientX,
      startY: e.clientY,
      origX: p.x,
      origY: p.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (draggingTask.current) {
      const d = draggingTask.current;
      const dx = (e.clientX - d.startX) / zoom;
      const dy = (e.clientY - d.startY) / zoom;
      setPositions((prev) => ({ ...prev, [d.id]: { x: d.origX + dx, y: d.origY + dy } }));
    } else if (panning.current) {
      const p = panning.current;
      setPan({ x: p.origX + (e.clientX - p.startX), y: p.origY + (e.clientY - p.startY) });
    }
  };

  const onPointerUp = () => {
    if (draggingTask.current) {
      // Snap to 8px grid
      const id = draggingTask.current.id;
      setPositions((prev) => {
        const p = prev[id];
        if (!p) return prev;
        const snapped = { x: Math.round(p.x / 8) * 8, y: Math.round(p.y / 8) * 8 };
        const next = { ...prev, [id]: snapped };
        persist(next);
        return next;
      });
    }
    draggingTask.current = null;
    panning.current = null;
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    panning.current = { startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y };
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      setZoom((z) => Math.min(2, Math.max(0.3, z + delta)));
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  const fit = () => {
    const xs = Object.values(positions).map((p) => p.x);
    const ys = Object.values(positions).map((p) => p.y);
    if (!xs.length) return;
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    setPan({ x: -minX + 40, y: -minY + 40 });
    setZoom(1);
  };

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted/20">
      {/* Controls */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} aria-label="Zoom out">
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-[44px] text-center text-xs tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} aria-label="Zoom in">
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fit} aria-label="Fit to content">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {tasks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          No tasks yet — add one and it will appear on the canvas.
        </div>
      )}

      <div
        ref={containerRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in oklab, var(--foreground) 12%, transparent) 1px, transparent 1px)",
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        <div
          className="relative origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width: 1,
            height: 1,
          }}
        >
          {tasks.map((task) => {
            const pos = positions[task.id];
            if (!pos) return null;
            const t = taskMap.get(task.id) ?? task;
            const status = STATUS_OPTIONS.find((s) => s.value === t.status);
            const priority = PRIORITY_OPTIONS.find((p) => p.value === t.priority);
            return (
              <div
                key={task.id}
                onPointerDown={(e) => onCardPointerDown(e, task.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  // Only treat as click if no drag occurred
                  if (
                    draggingTask.current &&
                    Math.abs(e.clientX - draggingTask.current.startX) < 4 &&
                    Math.abs(e.clientY - draggingTask.current.startY) < 4
                  ) {
                    onTaskClick?.(task.id);
                  } else if (!draggingTask.current) {
                    onTaskClick?.(task.id);
                  }
                }}
                className="absolute cursor-grab select-none rounded-xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md active:cursor-grabbing"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: CARD_W,
                  minHeight: CARD_H,
                  borderLeft: status ? `3px solid ${status.color}` : undefined,
                }}
              >
                <p className="line-clamp-2 text-sm font-medium leading-snug">{t.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                  {priority && (
                    <span
                      className="rounded px-1.5 py-0.5 font-medium"
                      style={{
                        backgroundColor: `color-mix(in oklab, ${priority.color} 18%, transparent)`,
                        color: priority.color,
                      }}
                    >
                      {priority.label}
                    </span>
                  )}
                  {status && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                      {status.label}
                    </span>
                  )}
                  {t.due_date && (
                    <span className="text-muted-foreground">
                      {new Date(t.due_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
                {t.tags && t.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {t.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="pointer-events-none absolute bottom-3 left-4 text-[10px] text-muted-foreground">
        Drag cards to arrange · Drag empty space to pan · ⌘/Ctrl + scroll to zoom
      </p>
    </div>
  );
}
