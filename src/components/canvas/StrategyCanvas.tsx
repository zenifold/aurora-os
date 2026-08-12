import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, FileBox, Check, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CanvasEditor, type CanvasScene, type ExcalidrawAPI } from "@/components/pages/CanvasEditor";
import {
  useProjectCanvases,
  useCreateProjectCanvas,
  useUpdateProjectCanvas,
  useDeleteProjectCanvas,
  type ProjectCanvas,
} from "@/hooks/use-project-canvases";
import { STRATEGY_TEMPLATES } from "@/lib/strategy-canvas-templates";
import { buildMilestoneCanvasSkeleton } from "@/lib/milestone-canvas";
import { useMilestones } from "@/hooks/use-milestones";
import { useTasks } from "@/hooks/use-tasks";
import { TaskChipPicker } from "@/components/canvas/TaskChipPicker";
import { TaskChipOverlay } from "@/components/canvas/TaskChipLayer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  projectId: string;
}

export function StrategyCanvas({ projectId }: Props) {
  const { data: canvases = [], isLoading } = useProjectCanvases(projectId);
  const { data: milestones = [] } = useMilestones(projectId);
  const { data: tasks = [] } = useTasks(projectId);
  const create = useCreateProjectCanvas();
  const update = useUpdateProjectCanvas();
  const del = useDeleteProjectCanvas();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [api, setApi] = useState<ExcalidrawAPI | null>(null);

  // Pick first canvas by default; auto-create one if the project has none.
  useEffect(() => {
    if (isLoading) return;
    if (canvases.length === 0) return;
    if (!activeId || !canvases.find((c) => c.id === activeId)) {
      setActiveId(canvases[0].id);
    }
  }, [canvases, activeId, isLoading]);

  const active = useMemo(
    () => canvases.find((c) => c.id === activeId) ?? null,
    [canvases, activeId],
  );

  // Debounced scene autosave per active canvas.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<string>("");
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const handleSceneChange = useCallback(
    (scene: CanvasScene) => {
      if (!active) return;
      const sig = JSON.stringify(scene.elements ?? []);
      if (sig === lastSentRef.current) return;
      lastSentRef.current = sig;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        update.mutate({
          id: active.id,
          projectId,
          patch: { scene },
        });
      }, 800);
    },
    [active, update, projectId],
  );

  const handleNew = async (opts?: {
    title?: string;
    scene?: CanvasScene;
  }) => {
    const row = await create.mutateAsync({
      projectId,
      title: opts?.title ?? "Untitled canvas",
      scene: opts?.scene,
    });
    setActiveId(row.id);
    toast.success("Canvas created");
  };

  const handleTemplate = async (templateId: string) => {
    const tpl = STRATEGY_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    await handleNew({
      title: tpl.label,
      scene: {
        type: "excalidraw",
        elements: tpl.build(),
        appState: {},
        files: {},
      },
    });
  };

  const handleGenerateFromMilestones = async () => {
    if (milestones.length === 0 && tasks.length === 0) {
      toast.error("Add milestones or tasks first.");
      return;
    }
    const skeleton = buildMilestoneCanvasSkeleton(milestones, tasks);
    const mod = await import("@excalidraw/excalidraw");
    const elements = mod.convertToExcalidrawElements(skeleton as never);
    await handleNew({
      title: "Milestone plan",
      scene: {
        type: "excalidraw",
        elements: elements as unknown[],
        appState: {},
        files: {},
      },
    });
  };


  const handleRename = (id: string, title: string) => {
    update.mutate({ id, projectId, patch: { title: title.trim() || "Untitled canvas" } });
    setEditingTitle(null);
  };

  const handleDelete = async (canvas: ProjectCanvas) => {
    await del.mutateAsync({ id: canvas.id, projectId });
    if (activeId === canvas.id) setActiveId(null);
    toast.success("Canvas deleted");
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading canvases…
      </div>
    );
  }

  if (canvases.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="rounded-full bg-muted/50 p-6">
          <FileBox className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-xl font-semibold">Start a Strategy Canvas</h2>
          <p className="text-sm text-muted-foreground">
            A free-form space for thinking — mind maps, phase plans, RACI, risk
            grids, dependency sketches. Tasks live in Table and Kanban. This is
            where you reason about the project.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => handleNew()}>
            <Plus className="mr-1.5 h-4 w-4" /> Blank canvas
          </Button>
          <Button variant="secondary" onClick={handleGenerateFromMilestones}>
            <Sparkles className="mr-1.5 h-4 w-4" /> Generate from milestones
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Start from template</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Strategy templates</DropdownMenuLabel>
              {STRATEGY_TEMPLATES.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => handleTemplate(t.id)}
                  className="items-start gap-2"
                >
                  <span className="text-base leading-none">{t.icon}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.description}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border bg-muted/20 px-2 py-1.5 overflow-x-auto">
        {canvases.map((c) => {
          const isActive = c.id === activeId;
          const isEditing = editingTitle === c.id;
          return (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1 text-sm transition",
                isActive
                  ? "bg-card shadow-sm ring-1 ring-border"
                  : "hover:bg-muted/50",
              )}
            >
              {isEditing ? (
                <Input
                  autoFocus
                  defaultValue={c.title}
                  className="h-6 w-40 px-1 py-0 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRename(c.id, (e.target as HTMLInputElement).value);
                    } else if (e.key === "Escape") {
                      setEditingTitle(null);
                    }
                  }}
                  onBlur={(e) => handleRename(c.id, e.currentTarget.value)}
                />
              ) : (
                <button
                  type="button"
                  className="max-w-[180px] truncate font-medium"
                  onClick={() => setActiveId(c.id)}
                  onDoubleClick={() => setEditingTitle(c.id)}
                  title={c.title}
                >
                  {c.title}
                </button>
              )}
              {isActive && !isEditing && (
                <>
                  <button
                    type="button"
                    aria-label="Rename"
                    onClick={() => setEditingTitle(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        aria-label="Delete canvas"
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this canvas?</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{c.title}" will be permanently removed. This can't be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(c)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 h-7 gap-1 px-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuItem onClick={() => handleNew()}>
              <Plus className="mr-2 h-3.5 w-3.5" /> Blank canvas
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleGenerateFromMilestones}>
              <Sparkles className="mr-2 h-3.5 w-3.5" /> Generate from milestones
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>From template</DropdownMenuLabel>
            {STRATEGY_TEMPLATES.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => handleTemplate(t.id)}
                className="items-start gap-2"
              >
                <span className="text-base leading-none">{t.icon}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.description}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {update.isPending && (
          <span className="ml-auto flex items-center gap-1 px-2 text-[10px] text-muted-foreground">
            Saving…
          </span>
        )}
        {!update.isPending && active && (
          <span className="ml-auto flex items-center gap-1 px-2 text-[10px] text-muted-foreground">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden p-3">
        {active ? (
          <CanvasEditor
            key={active.id}
            pageId={active.id}
            initial={active.scene}
            onChange={handleSceneChange}
            onApiReady={setApi}
            topRightExtras={<TaskChipPicker projectId={projectId} api={api} />}
            overlay={<TaskChipOverlay projectId={projectId} api={api} />}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a canvas above or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}
