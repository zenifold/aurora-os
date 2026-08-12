import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  FolderPlus,
  Briefcase,
  FileText,
  Palette,
  Calendar,
  Sparkles,
  Loader2,
  Wand2,
  Bot,
  Zap,
} from "lucide-react";
import { useCreateFolder } from "@/hooks/use-folders";
import { useCreateProject } from "@/hooks/use-projects";
import { useCreatePage } from "@/hooks/use-pages";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { CANVAS_TEMPLATES } from "@/lib/canvas-templates";
import { EMPTY_PLAN } from "@/lib/plan-types";
import { generateArtifact } from "@/lib/ai-create.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Kind = "folder" | "project" | "page" | "canvas" | "plan";
type AIKind = Kind | "auto";
type AIMode = "one_shot" | "agentic";

const META: Record<
  Kind,
  { label: string; icon: typeof FolderPlus; description: string; placeholder: string }
> = {
  folder: {
    label: "Folder",
    icon: FolderPlus,
    description: "A container for organizing more folders, projects, and pages.",
    placeholder: "e.g. 2026 Initiatives",
  },
  project: {
    label: "Project",
    icon: Briefcase,
    description: "A workstream with tasks, sprints, and milestones.",
    placeholder: "e.g. Mobile app redesign",
  },
  page: {
    label: "Page",
    icon: FileText,
    description: "A rich text doc — PRD, runbook, decision log, or notes.",
    placeholder: "e.g. Architecture overview",
  },
  canvas: {
    label: "Canvas",
    icon: Palette,
    description: "A visual whiteboard for wireframes, flowcharts, and diagrams.",
    placeholder: "e.g. User journey flow",
  },
  plan: {
    label: "Plan",
    icon: Calendar,
    description: "A timeline / Gantt with lanes, milestones, and dependencies.",
    placeholder: "e.g. Q3 launch plan",
  },
};

interface Props {
  /** The folder being created inside, or null for division-root. */
  folderId: string | null;
  divisionId: string;
  /** If provided, scope items to this project (sub-project, project pages, etc). */
  projectId?: string | null;
  triggerLabel?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  /** If provided, render only an icon button. */
  iconOnly?: boolean;
}

export function UniversalCreateMenu({
  folderId,
  divisionId,
  projectId = null,
  triggerLabel = "New",
  variant = "default",
  size = "sm",
  className,
  iconOnly,
}: Props) {
  const navigate = useNavigate();
  const ws = useWorkspaceStore((s) => s.current);
  const createFolder = useCreateFolder();
  const createProject = useCreateProject();
  const createPage = useCreatePage();
  const aiGenerate = useServerFn(generateArtifact);

  const [manualKind, setManualKind] = useState<Kind | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // Project-specific extras
  const [projDescription, setProjDescription] = useState("");
  const [projColor, setProjColor] = useState("#8b5cf6");
  const [projClient, setProjClient] = useState("");
  const [projIsClient, setProjIsClient] = useState(false);
  const [projStart, setProjStart] = useState("");
  const [projTargetEnd, setProjTargetEnd] = useState("");
  const resetExtras = () => {
    setProjDescription("");
    setProjColor("#8b5cf6");
    setProjClient("");
    setProjIsClient(false);
    setProjStart("");
    setProjTargetEnd("");
  };

  const [aiOpen, setAiOpen] = useState(false);
  const [aiKind, setAiKind] = useState<AIKind>("auto");
  const [aiMode, setAiMode] = useState<AIMode>("one_shot");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const pageScope: "workspace" | "folder" | "project" = projectId
    ? "project"
    : folderId
    ? "folder"
    : "workspace";
  const pageScopeId = projectId ?? folderId ?? null;

  const submitManual = async () => {
    if (!manualKind || !name.trim()) return;
    setBusy(true);
    try {
      if (manualKind === "folder") {
        const f = await createFolder.mutateAsync({
          parent_id: folderId,
          name: name.trim(),
        });
        navigate({ to: "/app/f/$folderId", params: { folderId: f.id } });
      } else if (manualKind === "project") {
        const p = await createProject.mutateAsync({
          name: name.trim(),
          folder_id: folderId,
          parent_id: projectId,
          description: projDescription.trim() || null,
          color: projColor,
          client_name: projClient.trim() || null,
          is_client_project: projIsClient,
          start_date: projStart || null,
          target_end_date: projTargetEnd || null,
        });
        resetExtras();
        navigate({ to: "/app/p/$projectId", params: { projectId: p.id } });
      } else if (manualKind === "page") {
        await createPage.mutateAsync({
          title: name.trim(),
          scope: pageScope,
          scope_id: pageScopeId,
          page_type: "doc",
        });
        toast.success("Page created");
      } else if (manualKind === "canvas") {
        const tmpl = CANVAS_TEMPLATES[0];
        const elements = tmpl?.build ? tmpl.build() : [];
        await createPage.mutateAsync({
          title: name.trim(),
          scope: pageScope,
          scope_id: pageScopeId,
          page_type: "canvas",
          content: { type: "excalidraw", elements, appState: {} },
        });
        toast.success("Canvas created");
      } else if (manualKind === "plan") {
        await createPage.mutateAsync({
          title: name.trim(),
          scope: pageScope,
          scope_id: pageScopeId,
          page_type: "plan",
          content: EMPTY_PLAN,
        });
        toast.success("Plan created");
      }
      setManualKind(null);
      setName("");
    } finally {
      setBusy(false);
    }
  };

  const submitAI = async () => {
    if (!ws || !aiPrompt.trim()) return;
    setAiBusy(true);
    try {
      const res = await aiGenerate({
        data: {
          workspace_id: ws.id,
          folder_id: folderId,
          kind: aiKind,
          mode: aiMode,
          prompt: aiPrompt.trim(),
        },
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if ("ok" in res && res.ok) {
        toast.success(res.summary ?? "Done");
        setAiOpen(false);
        setAiPrompt("");
        // Navigate to the first created artifact if it has a route
        const first = res.created?.find((c) => c.path);
        if (first?.path) {
          window.location.assign(first.path);
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const meta = manualKind ? META[manualKind] : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={iconOnly ? "icon" : size} className={className}>
            <Plus className={iconOnly ? "h-3.5 w-3.5" : "mr-1.5 h-3.5 w-3.5"} />
            {!iconOnly && triggerLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            Create
          </DropdownMenuLabel>
          {(["page", "canvas", "plan", "project"] as Kind[]).map((k) => {
            const m = META[k];
            const Icon = m.icon;
            return (
              <DropdownMenuItem key={k} onClick={() => setManualKind(k)}>
                <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="text-[11px] text-muted-foreground">{m.description}</div>
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setAiKind("auto");
              setAiMode("one_shot");
              setAiOpen(true);
            }}
          >
            <Wand2 className="mr-2 h-4 w-4 text-primary" />
            <div className="flex-1">
              <div className="text-sm font-medium">Generate with AI…</div>
              <div className="text-[11px] text-muted-foreground">
                Describe it; AI builds folders, pages, plans, and more.
              </div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Manual create dialog */}
      <Dialog open={!!manualKind} onOpenChange={(o) => !o && setManualKind(null)}>
        <DialogContent className="sm:max-w-md">
          {meta && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <meta.icon className="h-4 w-4" />
                  New {meta.label.toLowerCase()}
                </DialogTitle>
                <DialogDescription>{meta.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="qc-name">Name</Label>
                <Input
                  id="qc-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={meta.placeholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim() && !busy) submitManual();
                  }}
                />
              </div>
              {manualKind === "project" && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="qc-desc" className="text-xs">Description (optional)</Label>
                    <Input
                      id="qc-desc"
                      value={projDescription}
                      onChange={(e) => setProjDescription(e.target.value)}
                      placeholder="What is this project about?"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="qc-color" className="text-xs">Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          id="qc-color"
                          type="color"
                          value={projColor}
                          onChange={(e) => setProjColor(e.target.value)}
                          className="h-8 w-10 cursor-pointer rounded border border-border bg-background"
                        />
                        <Input value={projColor} onChange={(e) => setProjColor(e.target.value)} className="h-8 flex-1 font-mono text-xs" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="qc-client-name" className="text-xs">Client (optional)</Label>
                      <Input
                        id="qc-client-name"
                        value={projClient}
                        onChange={(e) => {
                          setProjClient(e.target.value);
                          if (e.target.value.trim()) setProjIsClient(true);
                        }}
                        placeholder="Acme Inc."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="qc-start" className="text-xs">Start date</Label>
                      <Input id="qc-start" type="date" value={projStart} onChange={(e) => setProjStart(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="qc-end" className="text-xs">Target end</Label>
                      <Input id="qc-end" type="date" value={projTargetEnd} onChange={(e) => setProjTargetEnd(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setManualKind(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  disabled={!name.trim() || busy}
                  onClick={() => {
                    if (!manualKind) return;
                    setAiKind(manualKind);
                    setAiPrompt(name.trim());
                    setManualKind(null);
                    setAiOpen(true);
                  }}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" /> Use AI
                </Button>
                <Button
                  onClick={submitManual}
                  disabled={!name.trim() || busy}
                  className="bg-aura-gradient text-primary-foreground hover:opacity-90"
                >
                  {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Create
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* AI generate dialog */}
      <Dialog open={aiOpen} onOpenChange={(o) => !aiBusy && setAiOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              Generate with AI
            </DialogTitle>
            <DialogDescription>
              Describe what you want; AI will create it inside this folder.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Kind chips */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                What to create
              </Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(["auto", "page", "canvas", "plan", "project"] as AIKind[]).map((k) => {
                  const label = k === "auto" ? "Auto (anything)" : META[k as Kind].label;
                  const active = aiKind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setAiKind(k);
                        if (k === "auto") setAiMode("agentic");
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        active
                          ? "border-transparent bg-aura-gradient text-primary-foreground"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <Label htmlFor="ai-prompt" className="text-xs uppercase tracking-wider text-muted-foreground">
                Prompt
              </Label>
              <Textarea
                id="ai-prompt"
                autoFocus
                rows={4}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Set up the workspace for our new SaaS launch — PRD, GTM plan, architecture canvas, and a 12-week roadmap."
                className="mt-1.5"
              />
            </div>

            {/* Mode toggle */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mode</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAiMode("one_shot")}
                  disabled={aiKind === "auto"}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors disabled:opacity-50",
                    aiMode === "one_shot"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground",
                  )}
                >
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Zap className="h-3.5 w-3.5" /> One-shot
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Fast, single artifact, deterministic.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAiMode("agentic")}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    aiMode === "agentic"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground",
                  )}
                >
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Bot className="h-3.5 w-3.5" /> Agentic
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Plans + creates multiple artifacts to fulfill the goal.
                  </div>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiOpen(false)} disabled={aiBusy}>
              Cancel
            </Button>
            <Button
              onClick={submitAI}
              disabled={!aiPrompt.trim() || aiBusy}
              className="bg-aura-gradient text-primary-foreground hover:opacity-90"
            >
              {aiBusy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" />
              )}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
