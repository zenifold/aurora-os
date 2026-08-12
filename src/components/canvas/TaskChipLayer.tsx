import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { useUIStore } from "@/stores/ui-store";
import type { ExcalidrawAPI } from "@/components/pages/CanvasEditor";
import type { Task } from "@/lib/types";

interface Props {
  projectId: string;
  api: ExcalidrawAPI | null;
}

interface ChipPos {
  taskId: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

const STATUS_COLORS: Record<string, string> = {
  todo: "#94a3b8",
  in_progress: "#3b82f6",
  review: "#eab308",
  done: "#22c55e",
  cancelled: "#ef4444",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
  cancelled: "Cancelled",
};

/**
 * Reads element positions from the Excalidraw API every frame and renders a
 * live overlay on top of any rectangle with customData.taskId. The underlying
 * rectangle stays draggable in Excalidraw; the overlay shows live task data.
 */
export function TaskChipOverlay({ projectId, api }: Props) {
  const { data: tasks = [] } = useTasks(projectId);
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);
  const [chips, setChips] = useState<ChipPos[]>([]);
  const rafRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!api) return;

    const tick = () => {
      const els = api.getSceneElements() as Array<{
        id: string;
        type: string;
        x: number;
        y: number;
        width: number;
        height: number;
        isDeleted?: boolean;
        customData?: { taskId?: string };
      }>;
      const appState = api.getAppState();
      const zoom = appState.zoom?.value ?? 1;
      const scrollX = (appState.scrollX as number | undefined) ?? 0;
      const scrollY = (appState.scrollY as number | undefined) ?? 0;
      const rect = containerRef.current?.getBoundingClientRect();
      const offX = rect?.left ?? 0;
      const offY = rect?.top ?? 0;

      const next: ChipPos[] = [];
      for (const el of els) {
        if (el.isDeleted) continue;
        const tid = el.customData?.taskId;
        if (!tid) continue;
        const left = (el.x + scrollX) * zoom;
        const top = (el.y + scrollY) * zoom;
        next.push({
          taskId: tid,
          left,
          top,
          width: el.width * zoom,
          height: el.height * zoom,
        });
        void offX;
        void offY;
      }
      setChips((prev) => {
        if (prev.length !== next.length) return next;
        for (let i = 0; i < next.length; i++) {
          const a = prev[i];
          const b = next[i];
          if (
            a.taskId !== b.taskId ||
            Math.abs(a.left - b.left) > 0.5 ||
            Math.abs(a.top - b.top) > 0.5 ||
            Math.abs(a.width - b.width) > 0.5 ||
            Math.abs(a.height - b.height) > 0.5
          ) {
            return next;
          }
        }
        return prev;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [api]);

  const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]));

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      {chips.map((c) => {
        const task = taskMap.get(c.taskId);
        if (!task) {
          return (
            <div
              key={c.taskId}
              style={{
                position: "absolute",
                left: c.left,
                top: c.top,
                width: c.width,
                height: c.height,
              }}
              className="pointer-events-auto flex items-center justify-center rounded-md border border-dashed border-destructive/50 bg-destructive/5 px-2 text-[10px] text-destructive"
            >
              Task removed
            </div>
          );
        }
        const color = STATUS_COLORS[task.status] ?? "#94a3b8";
        return (
          <div
            key={c.taskId}
            style={{
              position: "absolute",
              left: c.left,
              top: c.top,
              width: c.width,
              height: c.height,
            }}
            className="pointer-events-none relative flex flex-col justify-between rounded-md border-l-4 bg-card/95 px-2.5 py-1.5 shadow-sm ring-1 ring-border/60 backdrop-blur"
          >
            <span
              className="absolute inset-y-0 left-0 w-1 rounded-l-md"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <div className="flex items-start gap-1.5 pr-5">
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span className="line-clamp-2 text-xs font-medium leading-tight text-foreground">
                {task.title}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{STATUS_LABEL[task.status] ?? task.status}</span>
              {task.assignee_ids.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5">
                  {task.assignee_ids.length}{" "}
                  {task.assignee_ids.length === 1 ? "assignee" : "assignees"}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTaskId(task.id);
              }}
              title="Open task"
              aria-label={`Open ${task.title}`}
              className="pointer-events-auto absolute right-1 top-1 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
