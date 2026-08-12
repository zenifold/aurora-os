import { useEffect, useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  CheckSquare,
  FileText,
  Palette,
  Calendar,
  Briefcase,
  FolderPlus,
  Sparkles,
  Loader2,
  Wand2,
  DollarSign,
  UserRound,
} from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { useCreateFolder } from "@/hooks/use-folders";
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { useContainers, useMyPersonalContainer, useInternalContainer } from "@/hooks/use-containers";
import { useCreatePage } from "@/hooks/use-pages";
import { useDealStages, useCreateDeal, useCreateContact } from "@/hooks/use-crm";
import { supabase } from "@/integrations/supabase/client";
import { CANVAS_TEMPLATES } from "@/lib/canvas-templates";
import { EMPTY_PLAN } from "@/lib/plan-types";
import { generateArtifact } from "@/lib/ai-create.functions";
import { listProjectTemplates } from "@/lib/templates.functions";
import { applyPhaseTemplateToProject } from "@/lib/phases.functions";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type Kind = "task" | "page" | "canvas" | "plan" | "project" | "folder" | "deal" | "contact";

const KINDS: { kind: Kind; label: string; icon: typeof Plus; hint: string }[] = [
  { kind: "task", label: "Task", icon: CheckSquare, hint: "T" },
  { kind: "project", label: "Project", icon: Briefcase, hint: "P" },
  { kind: "deal", label: "Deal", icon: DollarSign, hint: "D" },
  { kind: "contact", label: "Contact", icon: UserRound, hint: "N" },
  { kind: "page", label: "Page", icon: FileText, hint: "G" },
  { kind: "canvas", label: "Canvas", icon: Palette, hint: "C" },
  { kind: "plan", label: "Plan", icon: Calendar, hint: "L" },
];


function defaultKindForRoute(path: string): Kind {
  if (path.startsWith("/app/p/")) return "task";
  if (path.startsWith("/app/my-tasks")) return "task";
  if (path.startsWith("/app/pages")) return "page";
  if (path.startsWith("/app/notes")) return "page";
  if (path.startsWith("/app/f/")) return "project";
  if (path.startsWith("/app/d/")) return "project";
  if (path.startsWith("/app/clients")) return "deal";
  return "task";
}

function currentProjectIdFromPath(path: string): string | null {
  const m = path.match(/^\/app\/p\/([^/]+)/);
  return m?.[1] ?? null;
}

export function QuickCreate() {
  const open = useUIStore((s) => s.quickCreateOpen);
  const setOpen = useUIStore((s) => s.setQuickCreateOpen);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const ws = useWorkspaceStore((s) => s.current);
  const divisions: Array<{ id: string; name: string; color?: string }> = [];
  const { data: containers = [] } = useContainers();
  const personal = useMyPersonalContainer();
  const internal = useInternalContainer();
  const { data: projects = [] } = useProjects();
  const createFolder = useCreateFolder();
  const createProject = useCreateProject();
  const createPage = useCreatePage();
  const { data: dealStages = [] } = useDealStages();
  const createDeal = useCreateDeal();
  const createContact = useCreateContact();
  const ai = useServerFn(generateArtifact);
  const listTemplatesFn = useServerFn(listProjectTemplates);
  const applyTemplateFn = useServerFn(applyPhaseTemplateToProject);
  const { data: orgTemplates = [] } = useQuery({
    queryKey: ["project-templates", ws?.id],
    queryFn: () => listTemplatesFn({ data: { workspace_id: ws!.id } }),
    enabled: !!ws?.id && open,
  });

  const [kind, setKind] = useState<Kind>(() => defaultKindForRoute(path));
  const [name, setName] = useState("");
  const [aiMode, setAiMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const contextProjectId = useMemo(() => currentProjectIdFromPath(path), [path]);
  const [projectId, setProjectId] = useState<string>("");
  const [divisionId, setDivisionId] = useState<string>("");
  const [containerId, setContainerId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");

  const defaultContainerId = useMemo(() => {
    const mode = ws?.workspace_mode ?? "client_services";
    if (mode === "solo") return personal?.id ?? "";
    if (mode === "internal_team") return internal?.id ?? personal?.id ?? "";
    return personal?.id ?? internal?.id ?? containers.find((c) => c.kind === "client")?.id ?? "";
  }, [ws?.workspace_mode, personal, internal, containers]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    const k = defaultKindForRoute(path);
    setKind(k);
    setName("");
    setAiMode(false);
    setProjectId(contextProjectId ?? "");
    setDivisionId(divisions[0]?.id ?? "");
    setContainerId(defaultContainerId);
    setTemplateId("");
  }, [open, path, contextProjectId, divisions, defaultContainerId]);

  // Tab to cycle kinds
  const cycleKind = (dir: 1 | -1) => {
    const i = KINDS.findIndex((k) => k.kind === kind);
    const next = (i + dir + KINDS.length) % KINDS.length;
    setKind(KINDS[next].kind);
  };

  const close = () => setOpen(false);

  const submit = async () => {
    if (!name.trim() || !ws || !user) return;
    setBusy(true);
    try {
      if (aiMode) {
        const aiKind: "folder" | "page" | "canvas" | "plan" | "project" | "auto" =
          kind === "task" || kind === "folder" || kind === "deal" || kind === "contact"
            ? "auto"
            : kind;
        const res = await ai({
          data: {
            workspace_id: ws.id,
            division_id: divisionId || divisions[0]?.id || "",
            folder_id: null,
            kind: aiKind,
            mode: "agentic",
            prompt: name.trim(),
          },
        });
        if ("error" in res && res.error) throw new Error(res.error);
        if ("ok" in res && res.ok) {
          toast.success(res.summary ?? "Created");
          const first = res.created?.find((c) => c.path);
          if (first?.path) navigate({ to: first.path as never });
        }
      } else if (kind === "task") {
        if (!projectId) {
          toast.error("Choose a project");
          setBusy(false);
          return;
        }
        const { error } = await supabase.from("tasks").insert({
          workspace_id: ws.id,
          project_id: projectId,
          title: name.trim(),
          status: "todo",
          created_by: user.id,
          task_type: "task",
        } as never);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["tasks", projectId] });
        toast.success("Task created");
        if (!contextProjectId) navigate({ to: "/app/p/$projectId", params: { projectId } });
      } else if (kind === "folder") {
        toast.error("Folders have been replaced by Clients");
        return;

      } else if (kind === "project") {
        const p = await createProject.mutateAsync({
          name: name.trim(),
          client_account_id: containerId || undefined,
        });
        if (templateId) {
          try {
            const res = await applyTemplateFn({
              data: { project_id: p.id, template_id: templateId, replace: false },
            });
            if (res?.applied) toast.success(`Applied template · ${res.applied} phases`);
          } catch (err) {
            toast.error(`Template not applied: ${(err as Error).message}`);
          }
        }
        navigate({ to: "/app/p/$projectId", params: { projectId: p.id } });
      } else if (kind === "deal") {
        const firstStage = dealStages[0];
        if (!firstStage) {
          toast.error("No deal stages set up yet");
          setBusy(false);
          return;
        }
        await createDeal.mutateAsync({ title: name.trim(), stage_id: firstStage.id });
        navigate({ to: "/app/clients" });
      } else if (kind === "contact") {
        await createContact.mutateAsync({ name: name.trim() });
        navigate({ to: "/app/clients" });
      } else {
        const scope: "workspace" | "project" = projectId ? "project" : "workspace";
        const content =
          kind === "canvas"
            ? { type: "excalidraw", elements: CANVAS_TEMPLATES[0]?.build?.() ?? [], appState: {} }
            : kind === "plan"
            ? EMPTY_PLAN
            : undefined;
        await createPage.mutateAsync({
          title: name.trim(),
          scope,
          scope_id: projectId || null,
          page_type: kind === "page" ? "doc" : (kind as "canvas" | "plan" | "doc"),
          content,
        });
        toast.success("Created");
      }
      close();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const needsProject = kind === "task" && !contextProjectId;
  const needsDivision = kind === "folder" && divisions.length > 1;
  const needsContainer = kind === "project" && containers.length > 1;
  const showTemplatePicker = kind === "project" && !aiMode && orgTemplates.length > 0;

  const containerLabel = (c: typeof containers[number]) => {
    if (c.kind === "personal") return "My space";
    if (c.kind === "internal") return "Internal";
    return c.name;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogContent className="gap-3 p-0 sm:max-w-xl">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" /> Quick create
            {contextProjectId && (
              <Badge variant="outline" className="ml-1 text-[10px]">in this project</Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Type what you want to create. Tab to switch type, Enter to create. ⌘↵ to create &amp; open.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5">
          <div className="relative">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  cycleKind(e.shiftKey ? -1 : 1);
                } else if (e.key === "Enter" && name.trim() && !busy) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={
                aiMode
                  ? `Describe a ${kind}… AI will draft it`
                  : `New ${KINDS.find((k) => k.kind === kind)?.label.toLowerCase()}…`
              }
              className="h-11 pr-10 text-base"
            />
            <button
              type="button"
              onClick={() => setAiMode((v) => !v)}
              aria-label="Toggle AI assist"
              title="AI assist"
              className={cn(
                "absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground",
                aiMode && "bg-aura-gradient text-primary-foreground hover:text-primary-foreground"
              )}
            >
              {aiMode ? <Wand2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 px-5">
          {KINDS.map((k) => {
            const Icon = k.icon;
            const selected = k.kind === kind;
            return (
              <button
                key={k.kind}
                onClick={() => setKind(k.kind)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  selected
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {k.label}
              </button>
            );
          })}
        </div>

        {(needsProject || needsDivision || needsContainer || showTemplatePicker) && !aiMode && (
          <div className="grid grid-cols-1 gap-2 px-5 sm:grid-cols-2">
            {needsProject && (
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={projects.length ? "Pick a project" : "No projects yet"} />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-72">
                  {projects.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Create a project first
                    </div>
                  ) : (
                    projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
                          {p.name}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
            {needsDivision && (
              <Select value={divisionId} onValueChange={setDivisionId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-72">
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {needsContainer && (
              <Select value={containerId} onValueChange={setContainerId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Where?" />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-72">
                  {personal && (
                    <SelectItem value={personal.id}>My space</SelectItem>
                  )}
                  {internal && (
                    <SelectItem value={internal.id}>Internal</SelectItem>
                  )}
                  {containers
                    .filter((c) => c.kind === "client")
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{containerLabel(c)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            {showTemplatePicker && (
              <Select value={templateId || "none"} onValueChange={(v) => setTemplateId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm sm:col-span-2">
                  <SelectValue placeholder="Start from template (optional)" />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-72">
                  <SelectItem value="none">
                    <span className="text-muted-foreground">No template — blank project</span>
                  </SelectItem>
                  {orgTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="inline-flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-primary" />
                        {t.name}
                        <span className="text-[10px] text-muted-foreground">· {t.category}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-5 py-3">
          <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">Tab</kbd> switch type
            <kbd className="ml-2 rounded border bg-background px-1.5 py-0.5 font-mono">Enter</kbd> create
            <kbd className="ml-2 rounded border bg-background px-1.5 py-0.5 font-mono">Esc</kbd> close
          </div>
          <Button
            onClick={submit}
            disabled={!name.trim() || busy || (kind === "task" && !projectId && !aiMode)}
            className="bg-aura-gradient text-primary-foreground hover:opacity-90"
          >
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            {aiMode ? "Generate" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
