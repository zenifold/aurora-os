import { useEffect, useRef, useState } from "react";
import type { CanvasNote, Task } from "@/lib/types";
import { STATUS_OPTIONS } from "@/lib/types";
import type { Positions } from "@/lib/canvas-layouts";
import { cn } from "@/lib/utils";

interface Props {
  tasks: Task[];
  positions: Positions;
  notes: CanvasNote[];
  bounds: { minX: number; minY: number; w: number; h: number };
  pan: { x: number; y: number };
  zoom: number;
  /** Size of the visible canvas area in screen pixels. */
  viewport: { w: number; h: number };
  /** Set pan such that the given canvas point is centered. */
  centerOn: (cx: number, cy: number) => void;
}

const MM_W = 200;
const MM_H = 140;
const TASK_W = 220;
const TASK_H = 120;

export function CanvasMinimap({
  tasks,
  positions,
  notes,
  bounds,
  pan,
  zoom,
  viewport,
  centerOn,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Scale: fit bounds into the minimap box, preserving aspect ratio.
  const scale = Math.min(MM_W / Math.max(bounds.w, 1), MM_H / Math.max(bounds.h, 1));
  const innerW = bounds.w * scale;
  const innerH = bounds.h * scale;

  // Convert canvas coords -> minimap-local coords.
  const toMM = (x: number, y: number) => ({
    x: (x - bounds.minX) * scale,
    y: (y - bounds.minY) * scale,
  });

  // The viewport rectangle (in canvas coords) is the area currently visible
  // on screen: top-left = -pan/zoom, size = viewport / zoom.
  const vp = {
    x: -pan.x / zoom,
    y: -pan.y / zoom,
    w: viewport.w / zoom,
    h: viewport.h / zoom,
  };
  const vpMM = toMM(vp.x, vp.y);

  const statusColor = (s: string | null | undefined) =>
    STATUS_OPTIONS.find((o) => o.value === s)?.color ?? "var(--muted-foreground)";

  const handleJump = (clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    // Convert minimap-local back to canvas coords.
    const cx = localX / scale + bounds.minX;
    const cy = localY / scale + bounds.minY;
    centerOn(cx, cy);
  };

  // Allow click-drag on the minimap to scrub the viewport.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      handleJump(e.clientX, e.clientY);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, bounds.minX, bounds.minY]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="absolute bottom-4 right-4 z-20 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm hover:text-foreground"
        title="Show minimap"
      >
        Minimap
      </button>
    );
  }

  return (
    <div
      className="absolute bottom-4 right-4 z-20 select-none rounded-lg border border-border bg-card/95 p-1.5 shadow-md backdrop-blur"
      style={{ width: MM_W + 12 }}
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Minimap
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-[10px] text-muted-foreground hover:text-foreground"
          aria-label="Hide minimap"
        >
          ✕
        </button>
      </div>
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded border border-border bg-muted/30",
          "cursor-pointer",
        )}
        style={{ width: MM_W, height: MM_H }}
        onPointerDown={(e) => {
          dragging.current = true;
          handleJump(e.clientX, e.clientY);
        }}
      >
        {/* Centered content area showing the bounds */}
        <div
          className="absolute"
          style={{
            left: (MM_W - innerW) / 2,
            top: (MM_H - innerH) / 2,
            width: innerW,
            height: innerH,
          }}
        >
          {/* Task dots */}
          {tasks.map((t) => {
            const p = positions[t.id];
            if (!p) return null;
            const { x, y } = toMM(p.x + TASK_W / 2, p.y + TASK_H / 2);
            const adjX = x - (MM_W - innerW) / 2;
            const adjY = y - (MM_H - innerH) / 2;
            return (
              <span
                key={t.id}
                className="absolute h-1.5 w-1.5 rounded-full"
                style={{
                  left: adjX - 3,
                  top: adjY - 3,
                  backgroundColor: statusColor(t.status),
                }}
              />
            );
          })}
          {/* Note dots */}
          {notes.map((n) => {
            const { x, y } = toMM(n.x, n.y);
            const adjX = x - (MM_W - innerW) / 2;
            const adjY = y - (MM_H - innerH) / 2;
            return (
              <span
                key={n.id}
                className="absolute h-1.5 w-1.5 rounded-sm bg-amber-400/80"
                style={{ left: adjX, top: adjY }}
              />
            );
          })}
          {/* Viewport indicator */}
          <div
            className="pointer-events-none absolute rounded-sm border border-primary bg-primary/10"
            style={{
              left: vpMM.x,
              top: vpMM.y,
              width: Math.max(6, vp.w * scale),
              height: Math.max(6, vp.h * scale),
            }}
          />
        </div>
      </div>
      <p className="mt-1 px-1 text-[9px] leading-tight text-muted-foreground">
        Click or drag to navigate
      </p>
    </div>
  );
}
