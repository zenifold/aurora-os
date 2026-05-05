import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanvasLink, CanvasNote, Task, ViewConfig } from "@/lib/types";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "@/lib/types";
import { getTaskTypeMeta } from "@/lib/task-types";
import { useUpdateView } from "@/hooks/use-views";
import { Maximize2, Minus, Plus, StickyNote, Trash2, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Pos = { x: number; y: number };
type Positions = Record<string, Pos>;

const CARD_W = 220;
const CARD_H = 120;
const GAP_X = 32;
const GAP_Y = 32;
const COLS = 4;

const NOTE_COLORS: Record<NonNullable<CanvasNote["color"]>, { bg: string; border: string }> = {
  yellow: { bg: "#fef3c7", border: "#fcd34d" },
  pink: { bg: "#fce7f3", border: "#f9a8d4" },
  blue: { bg: "#dbeafe", border: "#93c5fd" },
  green: { bg: "#dcfce7", border: "#86efac" },
  purple: { bg: "#ede9fe", border: "#c4b5fd" },
};

function autoLayout(tasks: Task[], existing: Positions): Positions {
  const next: Positions = { ...existing };
  let i = 0;
  for (const t of tasks) {
    if (next[t.id]) continue;
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    next[t.id] = { x: 60 + col * (CARD_W + GAP_X), y: 60 + row * (CARD_H + GAP_Y) };
    i++;
  }
  return next;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
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

  const [positions, setPositions] = useState<Positions>(() =>
    autoLayout(tasks, viewConfig.canvasPositions ?? {}),
  );
  const [notes, setNotes] = useState<CanvasNote[]>(viewConfig.canvasNotes ?? []);
  const [links, setLinks] = useState<CanvasLink[]>(viewConfig.canvasLinks ?? []);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [linkSource, setLinkSource] = useState<string | null>(null); // task id or note:<id>
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<Pos>({ x: 0, y: 0 });
  const [selectedLink, setSelectedLink] = useState<string | null>(null);

  useEffect(() => {
    setPositions((prev) => autoLayout(tasks, prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.map((t) => t.id).join("|")]);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingTask = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const draggingNote = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const panning = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const persist = useCallback(
    (next: { positions?: Positions; notes?: CanvasNote[]; links?: CanvasLink[] }) => {
      if (!viewId) return;
      updateView.mutate({
        id: viewId,
        config: {
          ...viewConfig,
          canvasPositions: next.positions ?? positions,
          canvasNotes: next.notes ?? notes,
          canvasLinks: next.links ?? links,
        },
      });
    },
    [viewId, viewConfig, updateView, positions, notes, links],
  );

  // ---- Coordinate helpers ----
  const screenToCanvas = (clientX: number, clientY: number): Pos => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
  };

  // ---- Task drag ----
  const onCardPointerDown = (e: React.PointerEvent, taskId: string) => {
    if (linkSource) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = positions[taskId] ?? { x: 0, y: 0 };
    draggingTask.current = {
      id: taskId, startX: e.clientX, startY: e.clientY, origX: p.x, origY: p.y, moved: false,
    };
  };

  // ---- Note drag ----
  const onNotePointerDown = (e: React.PointerEvent, id: string) => {
    if (linkSource) return;
    if (editingNote === id) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const n = notes.find((nn) => nn.id === id);
    if (!n) return;
    draggingNote.current = {
      id, startX: e.clientX, startY: e.clientY, origX: n.x, origY: n.y, moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (linkSource) {
      setMousePos(screenToCanvas(e.clientX, e.clientY));
    }
    if (draggingTask.current) {
      const d = draggingTask.current;
      const dx = (e.clientX - d.startX) / zoom;
      const dy = (e.clientY - d.startY) / zoom;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true;
      setPositions((prev) => ({ ...prev, [d.id]: { x: d.origX + dx, y: d.origY + dy } }));
    } else if (draggingNote.current) {
      const d = draggingNote.current;
      const dx = (e.clientX - d.startX) / zoom;
      const dy = (e.clientY - d.startY) / zoom;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true;
      setNotes((prev) => prev.map((n) => (n.id === d.id ? { ...n, x: d.origX + dx, y: d.origY + dy } : n)));
    } else if (panning.current) {
      const p = panning.current;
      setPan({ x: p.origX + (e.clientX - p.startX), y: p.origY + (e.clientY - p.startY) });
    }
  };

  const onPointerUp = () => {
    if (draggingTask.current) {
      const id = draggingTask.current.id;
      setPositions((prev) => {
        const p = prev[id];
        if (!p) return prev;
        const snapped = { x: Math.round(p.x / 8) * 8, y: Math.round(p.y / 8) * 8 };
        const next = { ...prev, [id]: snapped };
        persist({ positions: next });
        return next;
      });
    }
    if (draggingNote.current) {
      const id = draggingNote.current.id;
      setNotes((prev) => {
        const next = prev.map((n) => {
          if (n.id !== id) return n;
          return { ...n, x: Math.round(n.x / 8) * 8, y: Math.round(n.y / 8) * 8 };
        });
        persist({ notes: next });
        return next;
      });
    }
    draggingTask.current = null;
    draggingNote.current = null;
    panning.current = null;
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (linkSource) {
      // cancel link draw
      setLinkSource(null);
      return;
    }
    setSelectedLink(null);
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
    const xs = [...Object.values(positions).map((p) => p.x), ...notes.map((n) => n.x)];
    const ys = [...Object.values(positions).map((p) => p.y), ...notes.map((n) => n.y)];
    if (!xs.length) return;
    setPan({ x: -Math.min(...xs) + 40, y: -Math.min(...ys) + 40 });
    setZoom(1);
  };

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // ---- Notes ops ----
  const addNote = () => {
    const center = screenToCanvas(
      (containerRef.current?.clientWidth ?? 600) / 2,
      (containerRef.current?.clientHeight ?? 400) / 2,
    );
    const n: CanvasNote = {
      id: uid(), x: center.x - 90, y: center.y - 60, w: 180, h: 120, text: "", color: "yellow",
    };
    const next = [...notes, n];
    setNotes(next);
    persist({ notes: next });
    setEditingNote(n.id);
  };

  const updateNote = (id: string, patch: Partial<CanvasNote>) => {
    const next = notes.map((n) => (n.id === id ? { ...n, ...patch } : n));
    setNotes(next);
    persist({ notes: next });
  };

  const deleteNote = (id: string) => {
    const next = notes.filter((n) => n.id !== id);
    const nextLinks = links.filter((l) => l.from !== `note:${id}` && l.to !== `note:${id}`);
    setNotes(next);
    setLinks(nextLinks);
    persist({ notes: next, links: nextLinks });
  };

  // ---- Links ops ----
  const startLink = (sourceId: string) => {
    setLinkSource(sourceId);
  };

  const completeLink = (targetId: string) => {
    if (!linkSource || linkSource === targetId) {
      setLinkSource(null);
      return;
    }
    if (links.some((l) => l.from === linkSource && l.to === targetId)) {
      setLinkSource(null);
      return;
    }
    const newLink: CanvasLink = { id: uid(), from: linkSource, to: targetId };
    const next = [...links, newLink];
    setLinks(next);
    persist({ links: next });
    setLinkSource(null);
  };

  const deleteLink = (id: string) => {
    const next = links.filter((l) => l.id !== id);
    setLinks(next);
    persist({ links: next });
    setSelectedLink(null);
  };

  // ---- Anchor resolver: where lines connect ----
  const anchorOf = (refId: string): Pos | null => {
    if (refId.startsWith("note:")) {
      const id = refId.slice(5);
      const n = notes.find((nn) => nn.id === id);
      if (!n) return null;
      return { x: n.x + (n.w ?? 180) / 2, y: n.y + (n.h ?? 120) / 2 };
    }
    const p = positions[refId];
    if (!p) return null;
    const t = taskMap.get(refId);
    const w = t ? getTaskTypeMeta(t.task_type).canvasW : CARD_W;
    const h = t ? getTaskTypeMeta(t.task_type).canvasH : CARD_H;
    return { x: p.x + w / 2, y: p.y + h / 2 };
  };

  // SVG bounds: large fixed canvas. We'll set viewBox to cover all positions.
  const bounds = useMemo(() => {
    let minX = 0, minY = 0, maxX = 2000, maxY = 1500;
    Object.values(positions).forEach((p) => {
      minX = Math.min(minX, p.x - 200); minY = Math.min(minY, p.y - 200);
      maxX = Math.max(maxX, p.x + 400); maxY = Math.max(maxY, p.y + 400);
    });
    notes.forEach((n) => {
      minX = Math.min(minX, n.x - 200); minY = Math.min(minY, n.y - 200);
      maxX = Math.max(maxX, n.x + 400); maxY = Math.max(maxY, n.y + 400);
    });
    return { minX, minY, w: maxX - minX, h: maxY - minY };
  }, [positions, notes]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted/20">
      {/* Controls */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addNote} aria-label="Add sticky note" title="Add sticky note">
          <StickyNote className="h-3.5 w-3.5" />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
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

      {linkSource && (
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary shadow-sm">
          Click another card to link · Esc / click empty to cancel
        </div>
      )}

      {tasks.length === 0 && notes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          No tasks yet — add one and it will appear on the canvas.
        </div>
      )}

      <div
        ref={containerRef}
        className={cn("h-full w-full", linkSource ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing")}
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
          {/* Links SVG layer */}
          <svg
            className="pointer-events-none absolute"
            style={{ left: bounds.minX, top: bounds.minY, width: bounds.w, height: bounds.h, overflow: "visible" }}
            viewBox={`${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
              </marker>
              <marker id="arrow-muted" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" />
              </marker>
            </defs>
            {links.map((l) => {
              const a = anchorOf(l.from);
              const b = anchorOf(l.to);
              if (!a || !b) return null;
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              const sel = selectedLink === l.id;
              const stroke = sel ? "hsl(var(--primary))" : "color-mix(in oklab, hsl(var(--muted-foreground)) 70%, transparent)";
              return (
                <g key={l.id} className="pointer-events-auto" style={{ cursor: "pointer" }}>
                  <path
                    d={`M ${a.x} ${a.y} C ${(a.x + mx) / 2} ${a.y}, ${(b.x + mx) / 2} ${b.y}, ${b.x} ${b.y}`}
                    stroke="transparent"
                    strokeWidth={14}
                    fill="none"
                    onClick={(e) => { e.stopPropagation(); setSelectedLink(l.id); }}
                  />
                  <path
                    d={`M ${a.x} ${a.y} C ${(a.x + mx) / 2} ${a.y}, ${(b.x + mx) / 2} ${b.y}, ${b.x} ${b.y}`}
                    stroke={stroke}
                    strokeWidth={sel ? 2.5 : 1.75}
                    fill="none"
                    markerEnd={sel ? "url(#arrow)" : "url(#arrow-muted)"}
                  />
                  {sel && (
                    <g
                      transform={`translate(${mx - 10}, ${my - 10})`}
                      onClick={(e) => { e.stopPropagation(); deleteLink(l.id); }}
                      style={{ cursor: "pointer" }}
                    >
                      <circle cx={10} cy={10} r={10} fill="hsl(var(--background))" stroke="hsl(var(--primary))" />
                      <path d="M 6 6 L 14 14 M 14 6 L 6 14" stroke="hsl(var(--primary))" strokeWidth={1.5} />
                    </g>
                  )}
                </g>
              );
            })}
            {linkSource && (() => {
              const a = anchorOf(linkSource);
              if (!a) return null;
              return (
                <path
                  d={`M ${a.x} ${a.y} L ${mousePos.x} ${mousePos.y}`}
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.75}
                  strokeDasharray="6 4"
                  fill="none"
                />
              );
            })()}
          </svg>

          {/* Sticky notes */}
          {notes.map((n) => {
            const c = NOTE_COLORS[n.color ?? "yellow"];
            const isLinkTarget = !!linkSource && hoverTarget === `note:${n.id}` && linkSource !== `note:${n.id}`;
            return (
              <div
                key={n.id}
                onPointerDown={(e) => onNotePointerDown(e, n.id)}
                onMouseEnter={() => setHoverTarget(`note:${n.id}`)}
                onMouseLeave={() => setHoverTarget((h) => (h === `note:${n.id}` ? null : h))}
                onClick={(e) => {
                  e.stopPropagation();
                  if (linkSource) { completeLink(`note:${n.id}`); return; }
                  if (draggingNote.current?.moved) return;
                }}
                className={cn(
                  "group absolute select-none rounded-md p-2 shadow-md transition",
                  linkSource ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
                  isLinkTarget && "ring-2 ring-primary ring-offset-2",
                )}
                style={{
                  left: n.x, top: n.y, width: n.w ?? 180, minHeight: n.h ?? 120,
                  backgroundColor: c.bg, border: `1px solid ${c.border}`,
                  transform: "rotate(-0.4deg)",
                }}
              >
                {editingNote === n.id ? (
                  <textarea
                    autoFocus
                    value={n.text}
                    onChange={(e) => setNotes((prev) => prev.map((nn) => (nn.id === n.id ? { ...nn, text: e.target.value } : nn)))}
                    onBlur={() => { setEditingNote(null); persist({ notes }); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="h-full min-h-[100px] w-full resize-none border-0 bg-transparent text-xs leading-relaxed outline-none placeholder:text-foreground/40"
                    placeholder="Type a note…"
                    style={{ color: "#1f2937" }}
                  />
                ) : (
                  <div
                    className="min-h-[100px] whitespace-pre-wrap text-xs leading-relaxed"
                    style={{ color: "#1f2937" }}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingNote(n.id); }}
                  >
                    {n.text || <span className="opacity-50">Double-click to edit</span>}
                  </div>
                )}

                {/* Hover toolbar */}
                <div
                  className="absolute -top-2 right-2 flex items-center gap-0.5 rounded-md border border-border/60 bg-card/95 px-1 py-0.5 opacity-0 shadow-sm transition group-hover:opacity-100"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {(Object.keys(NOTE_COLORS) as Array<keyof typeof NOTE_COLORS>).map((col) => (
                    <button
                      key={col}
                      type="button"
                      aria-label={`Color ${col}`}
                      onClick={(e) => { e.stopPropagation(); updateNote(n.id, { color: col }); }}
                      className={cn("h-3 w-3 rounded-full border", n.color === col && "ring-2 ring-foreground/40")}
                      style={{ backgroundColor: NOTE_COLORS[col].bg, borderColor: NOTE_COLORS[col].border }}
                    />
                  ))}
                  <div className="mx-0.5 h-3 w-px bg-border" />
                  <button
                    type="button"
                    aria-label="Link from note"
                    onClick={(e) => { e.stopPropagation(); startLink(`note:${n.id}`); }}
                    className="rounded p-0.5 hover:bg-muted"
                  >
                    <Link2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete note"
                    onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }}
                    className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Task cards */}
          {tasks.map((task) => {
            const pos = positions[task.id];
            if (!pos) return null;
            const t = taskMap.get(task.id) ?? task;
            const status = STATUS_OPTIONS.find((s) => s.value === t.status);
            const priority = PRIORITY_OPTIONS.find((p) => p.value === t.priority);
            const meta = getTaskTypeMeta(t.task_type);
            const isLinkTarget = !!linkSource && hoverTarget === task.id && linkSource !== task.id;
            return (
              <div
                key={task.id}
                onPointerDown={(e) => onCardPointerDown(e, task.id)}
                onMouseEnter={() => setHoverTarget(task.id)}
                onMouseLeave={() => setHoverTarget((h) => (h === task.id ? null : h))}
                onClick={(e) => {
                  e.stopPropagation();
                  if (linkSource) { completeLink(task.id); return; }
                  if (draggingTask.current?.moved) return;
                  onTaskClick?.(task.id);
                }}
                className={cn(
                  "group absolute select-none rounded-xl border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md",
                  linkSource ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
                  isLinkTarget && "ring-2 ring-primary ring-offset-2",
                )}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: meta.canvasW,
                  minHeight: meta.canvasH,
                  borderColor: meta.color,
                  borderWidth: t.task_type === "initiative" ? 3 : t.task_type === "epic" ? 2 : 1,
                  borderRadius: t.task_type === "subtask" ? 999 : 12,
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
                    <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{status.label}</span>
                  )}
                  {t.due_date && (
                    <span className="text-muted-foreground">
                      {new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
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

                {/* Link handle: visible on hover */}
                <button
                  type="button"
                  aria-label="Link from task"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); startLink(task.id); }}
                  className="absolute -right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-primary/60 bg-card p-1 opacity-0 shadow transition group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground"
                  title="Drag to link"
                >
                  <Link2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {selectedLink && (
        <div className="absolute bottom-12 left-1/2 z-20 -translate-x-1/2 rounded-md border border-border bg-card px-3 py-1.5 text-xs shadow">
          <span className="text-muted-foreground">Link selected · </span>
          <button onClick={() => deleteLink(selectedLink)} className="text-destructive hover:underline">
            <Trash2 className="mr-1 inline h-3 w-3" />Delete
          </button>
          <button onClick={() => setSelectedLink(null)} className="ml-2 text-muted-foreground hover:text-foreground">
            <X className="inline h-3 w-3" />
          </button>
        </div>
      )}

      <p className="pointer-events-none absolute bottom-3 left-4 text-[10px] text-muted-foreground">
        Drag cards to arrange · Hover a card and click <Link2 className="inline h-2.5 w-2.5" /> to link · Add sticky notes from toolbar · ⌘/Ctrl + scroll to zoom
      </p>
    </div>
  );
}
