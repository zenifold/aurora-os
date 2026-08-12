import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { improveCanvas } from "@/server/canvas-ai.functions";
import { CANVAS_TEMPLATES, type CanvasTemplateId } from "@/lib/canvas-templates";

// Excalidraw is client-only — must be lazy-loaded.
const Excalidraw = lazy(() =>
  import("@excalidraw/excalidraw").then((m) => ({ default: m.Excalidraw })),
);

import "@excalidraw/excalidraw/index.css";

export interface CanvasScene {
  type?: "excalidraw";
  elements?: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export interface ExcalidrawAPI {
  getSceneElements: () => unknown[];
  getAppState: () => Record<string, unknown> & { selectedElementIds?: Record<string, boolean>; scrollX?: number; scrollY?: number; zoom?: { value: number } };
  updateScene: (s: { elements?: unknown[]; appState?: Record<string, unknown> }) => void;
}

interface Props {
  pageId: string;
  initial: CanvasScene | null;
  onChange: (scene: CanvasScene) => void;
  onApiReady?: (api: ExcalidrawAPI) => void;
  topRightExtras?: ReactNode;
  overlay?: ReactNode;
}

export function CanvasEditor({ pageId, initial, onChange, onApiReady, topRightExtras, overlay }: Props) {
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  // Gates the Excalidraw render to the client; see the comment at its usage.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [aiOpen, setAiOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const improveFn = useServerFn(improveCanvas);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const isEmpty = !initial?.elements || (initial.elements as unknown[]).length === 0;

  const handleSceneChange = useCallback(
    (elements: readonly unknown[], appState: Record<string, unknown> & { selectedElementIds?: Record<string, boolean> }) => {
      const sel = appState.selectedElementIds ?? {};
      setHasSelection(Object.values(sel).some(Boolean));
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const slim: Record<string, unknown> = {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        };
        onChange({ type: "excalidraw", elements: [...elements], appState: slim, files: {} });
      }, 600);
    },
    [onChange],
  );

  const getSelectedIds = (): string[] => {
    const st = apiRef.current?.getAppState();
    const sel = st?.selectedElementIds ?? {};
    return Object.entries(sel).filter(([, v]) => v).map(([k]) => k);
  };

  const runAi = async () => {
    if (!prompt.trim()) return;
    setRunning(true);
    try {
      const elements = apiRef.current?.getSceneElements() ?? [];
      const selected_ids = getSelectedIds();
      const r = (await improveFn({
        data: { page_id: pageId, instruction: prompt, elements: elements as never, selected_ids },
      })) as { ok?: boolean; elements?: unknown[]; error?: string };
      if (r.error) {
        toast.error(r.error);
      } else if (r.elements) {
        apiRef.current?.updateScene({ elements: r.elements });
        toast.success(selected_ids.length ? `Updated ${selected_ids.length} selected element(s)` : "Canvas updated");
        setAiOpen(false);
        setPrompt("");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const exportAs = async (format: "png" | "svg") => {
    try {
      const mod = await import("@excalidraw/excalidraw");
      const elements = apiRef.current?.getSceneElements() ?? [];
      if (!elements.length) {
        toast.error("Canvas is empty");
        return;
      }
      const appState = apiRef.current?.getAppState() ?? {};
      if (format === "png") {
        const blob = await mod.exportToBlob({
          elements: elements as never,
          appState: { ...(appState as object), exportBackground: true } as never,
          files: null,
          mimeType: "image/png",
        });
        triggerDownload(blob, `canvas-${pageId.slice(0, 8)}.png`);
      } else {
        const svg = await mod.exportToSvg({
          elements: elements as never,
          appState: appState as never,
          files: null,
        });
        const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
        triggerDownload(blob, `canvas-${pageId.slice(0, 8)}.svg`);
      }
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const insertTemplate = (id: CanvasTemplateId) => {
    const tpl = CANVAS_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    const elements = tpl.build();
    apiRef.current?.updateScene({ elements });
    onChange({ type: "excalidraw", elements, appState: {}, files: {} });
    toast.success(`Inserted ${tpl.label}`);
  };

  return (
    <div className="relative h-[calc(100vh-220px)] min-h-[480px] w-full overflow-hidden rounded-lg border border-border">
      <div className="absolute right-3 top-3 z-20 flex gap-2">
        {topRightExtras}
        {isEmpty && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="shadow-md">Templates</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CANVAS_TEMPLATES.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => insertTemplate(t.id)}>
                  <span className="mr-2">{t.icon}</span>
                  <div className="flex flex-col">
                    <span className="text-sm">{t.label}</span>
                    <span className="text-xs text-muted-foreground">{t.description}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="shadow-md gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportAs("png")}>PNG</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAs("svg")}>SVG</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={aiOpen} onOpenChange={setAiOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 shadow-md">
              <Sparkles className="h-3.5 w-3.5" />
              {hasSelection ? "Improve selection" : "Improve with AI"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-primary" />
                {hasSelection ? "Improve selected shapes" : "Improve canvas"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {hasSelection
                  ? "AI will focus changes on your selected shapes and leave the rest alone."
                  : "Describe what to add, change, or fix. The AI sees the current canvas."}
              </p>
              <Input
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Add a login step before the dashboard"
                onKeyDown={(e) => e.key === "Enter" && runAi()}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAiOpen(false)} disabled={running}>
                Cancel
              </Button>
              <Button onClick={runAi} disabled={running || !prompt.trim()}>
                {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/*
        Rendered only after hydration. React.lazy would otherwise execute the
        import during SSR, pulling Excalidraw's transitive graph (mermaid,
        cytoscape, katex) into the worker bundle — 2.4 MiB gzipped against
        Cloudflare's 3 MiB limit. vite.config.ts stubs those modules out of the
        server build, so rendering this server-side would now throw.
      */}
      {!mounted ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading canvas…
        </div>
      ) : (
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading canvas…
          </div>
        }
      >
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api as unknown as ExcalidrawAPI;
            onApiReady?.(apiRef.current);
          }}
          initialData={
            initial
              ? {
                  elements: (initial.elements ?? []) as never,
                  appState: (initial.appState ?? {}) as never,
                  files: (initial.files ?? {}) as never,
                }
              : undefined
          }
          onChange={handleSceneChange as never}
        />
      </Suspense>
      )}
      {overlay}
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
