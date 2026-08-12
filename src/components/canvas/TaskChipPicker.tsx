import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTasks } from "@/hooks/use-tasks";
import type { ExcalidrawAPI } from "@/components/pages/CanvasEditor";
import type { Task } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  projectId: string;
  api: ExcalidrawAPI | null;
}

const STATUS_COLORS: Record<string, string> = {
  todo: "#94a3b8",
  in_progress: "#3b82f6",
  review: "#eab308",
  done: "#22c55e",
  cancelled: "#ef4444",
};

export function TaskChipPicker({ projectId, api }: Props) {
  const { data: tasks = [] } = useTasks(projectId);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const existingTaskIds = useMemo(() => {
    if (!api) return new Set<string>();
    const els = api.getSceneElements() as Array<{
      customData?: { taskId?: string };
      isDeleted?: boolean;
    }>;
    return new Set(
      els
        .filter((e) => !e.isDeleted && e.customData?.taskId)
        .map((e) => e.customData!.taskId!),
    );
  }, [api, open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .slice(0, 50);
  }, [tasks, query]);

  const insertChip = async (task: Task) => {
    if (!api) return;
    const mod = await import("@excalidraw/excalidraw");
    const appState = api.getAppState();
    const zoom = appState.zoom?.value ?? 1;
    const scrollX = (appState.scrollX as number | undefined) ?? 0;
    const scrollY = (appState.scrollY as number | undefined) ?? 0;
    // Place near viewport center, with a little jitter so they don't stack.
    const cx = -scrollX + (window.innerWidth / 2) / zoom + (Math.random() - 0.5) * 80;
    const cy = -scrollY + 200 / zoom + (Math.random() - 0.5) * 80;
    const skeleton = [
      {
        type: "rectangle" as const,
        x: cx - 110,
        y: cy - 32,
        width: 220,
        height: 64,
        strokeColor: STATUS_COLORS[task.status] ?? "#94a3b8",
        backgroundColor: "#ffffff",
        fillStyle: "solid" as const,
        strokeWidth: 1,
        roughness: 0,
        roundness: { type: 3 as const },
        customData: { taskId: task.id },
      },
    ];
    const newEls = mod.convertToExcalidrawElements(skeleton as never);
    const current = api.getSceneElements();
    api.updateScene({ elements: [...(current as unknown[]), ...newEls] });
    toast.success(`Added "${task.title}"`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="shadow-md gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Task chip
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
              className="h-8 pl-7 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="h-72">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No tasks match.
            </div>
          ) : (
            <ul className="p-1">
              {filtered.map((t) => {
                const exists = existingTaskIds.has(t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={exists}
                      onClick={() => {
                        insertChip(t);
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            STATUS_COLORS[t.status] ?? "#94a3b8",
                        }}
                      />
                      <span className="flex-1 truncate">{t.title}</span>
                      {exists && (
                        <span className="text-[10px] text-muted-foreground">
                          on canvas
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
