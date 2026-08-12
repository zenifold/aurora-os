import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUIStore } from "@/stores/ui-store";
import { useProjects } from "@/hooks/use-projects";
import { useSidebarFavorites } from "@/hooks/use-sidebar-favorites";
import { useTasks } from "@/hooks/use-tasks";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarPlus,
  Tag,
  Folder,
  Clock,
  Sparkles,
  Loader2,
  X,
  Star,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { haptic } from "@/lib/haptics";
import { TASK_TYPES, TASK_TYPE_META, PARENT_OF, type TaskType } from "@/lib/task-types";
import { AssigneePicker } from "@/components/tasks/AssigneePicker";

type ParsedTask = {
  title: string;
  due_date: string | null;
  tags: string[];
  projectName: string | null;
};

const QUICK_DATES = [
  { label: "Today", value: () => new Date() },
  { label: "Tomorrow", value: () => addDays(new Date(), 1) },
  { label: "Next week", value: () => addDays(new Date(), 7) },
];

/** Naive natural-language parser: today/tomorrow, @project, #tag */
function parseInput(raw: string, projects: { name: string }[]): ParsedTask {
  let title = raw;
  let due: Date | null = null;
  const tags: string[] = [];
  let projectName: string | null = null;

  const lower = raw.toLowerCase();
  if (/\btoday\b/.test(lower)) {
    due = new Date();
    title = title.replace(/\btoday\b/i, "").trim();
  } else if (/\btomorrow\b/.test(lower)) {
    due = addDays(new Date(), 1);
    title = title.replace(/\btomorrow\b/i, "").trim();
  } else if (/\bnext week\b/.test(lower)) {
    due = addDays(new Date(), 7);
    title = title.replace(/\bnext week\b/i, "").trim();
  }

  // Tags
  const tagMatches = [...title.matchAll(/#([\w-]+)/g)];
  for (const m of tagMatches) tags.push(m[1]);
  title = title.replace(/#[\w-]+/g, "").trim();

  // Project @name (first match against known projects, case-insensitive prefix)
  const atMatch = title.match(/@([\w-]+)/);
  if (atMatch) {
    const candidate = atMatch[1].toLowerCase();
    const found = projects.find((p) => p.name.toLowerCase().startsWith(candidate));
    if (found) projectName = found.name;
    title = title.replace(/@[\w-]+/, "").trim();
  }

  return {
    title: title.replace(/\s{2,}/g, " ").trim(),
    due_date: due ? due.toISOString().slice(0, 10) : null,
    tags,
    projectName,
  };
}

export function QuickCaptureSheet() {
  const open = useUIStore((s) => s.quickCaptureOpen);
  const setOpen = useUIStore((s) => s.setQuickCaptureOpen);
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: favorites = [] } = useSidebarFavorites();

  const favProjectIds = useMemo(
    () =>
      new Set(
        favorites.filter((f) => f.item_type === "project").map((f) => f.item_id),
      ),
    [favorites],
  );

  // Order: favorites first (in their pinned order), then the rest.
  const orderedProjects = useMemo(() => {
    const favOrder = favorites
      .filter((f) => f.item_type === "project")
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((f) => f.item_id);
    const favList = favOrder
      .map((id) => projects.find((p) => p.id === id))
      .filter((p): p is (typeof projects)[number] => !!p);
    const rest = projects.filter((p) => !favProjectIds.has(p.id));
    return [...favList, ...rest];
  }, [projects, favorites, favProjectIds]);

  const [text, setText] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [overrideDate, setOverrideDate] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<TaskType>("task");
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Default: first favorite project, then "Personal", then first project.
  useEffect(() => {
    if (!open) return;
    if (selectedProjectId) return;
    const firstFav = orderedProjects.find((p) => favProjectIds.has(p.id));
    const personal = projects.find((p) => p.name.toLowerCase() === "personal");
    const fallback = firstFav ?? personal ?? projects[0];
    if (fallback) setSelectedProjectId(fallback.id);
  }, [open, orderedProjects, projects, selectedProjectId, favProjectIds]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    } else {
      setText("");
      setOverrideDate(null);
      setTaskType("task");
      setParentTaskId(null);
      setAssigneeIds([]);
    }
  }, [open]);

  // Reset parent when type changes (parent must match new type's required parent)
  useEffect(() => {
    setParentTaskId(null);
  }, [taskType, selectedProjectId]);

  const parsed = useMemo(
    () => parseInput(text, projects.map((p) => ({ name: p.name }))),
    [text, projects]
  );

  const effectiveDate = overrideDate ?? parsed.due_date;
  const effectiveProject =
    parsed.projectName != null
      ? projects.find((p) => p.name === parsed.projectName) ?? null
      : selectedProjectId
        ? projects.find((p) => p.id === selectedProjectId) ?? null
        : null;

  // Tasks in selected project, used for the parent picker
  const { data: projectTasks = [] } = useTasks(effectiveProject?.id);
  const requiredParentType = PARENT_OF[taskType];
  const validParents = useMemo(
    () => (requiredParentType
      ? projectTasks.filter((t) => (t.task_type ?? "task") === requiredParentType)
      : []),
    [projectTasks, requiredParentType]
  );

  const needsParent = requiredParentType !== null;
  const canCreate =
    parsed.title.length > 0 &&
    !!effectiveProject &&
    !!ws &&
    !!user &&
    (!needsParent || !!parentTaskId);

  const handleCreate = async (keepOpen = false) => {
    if (!canCreate || !effectiveProject) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("tasks")
        .select("position")
        .eq("project_id", effectiveProject.id)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos =
        existing && existing.length > 0 ? Number(existing[0].position) + 1000 : 0;

      const payload = {
        workspace_id: ws!.id,
        project_id: effectiveProject.id,
        title: parsed.title,
        status: "todo" as const,
        position: nextPos,
        created_by: user!.id,
        tags: parsed.tags,
        due_date: effectiveDate,
        task_type: taskType,
        parent_task_id: parentTaskId,
        assignee_ids: assigneeIds,
      };

      // Offline path: queue and bail
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const { enqueueTask } = await import("@/lib/offline-queue");
        await enqueueTask(payload);
        haptic("success");
        toast.success("Saved offline — will sync when reconnected");
        setText("");
        setOverrideDate(null);
        if (!keepOpen) setOpen(false);
        else setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }

      const { error } = await supabase.from("tasks").insert(payload as never);
      if (error) throw error;
      haptic("success");
      toast.success(`${TASK_TYPE_META[taskType].label} added`);
      qc.invalidateQueries({ queryKey: ["tasks", effectiveProject.id] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      setText("");
      setOverrideDate(null);
      if (!keepOpen) setOpen(false);
      else setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e) {
      // Network failure → queue
      const msg = e instanceof Error ? e.message : "Failed to add task";
      if (/network|fetch|failed to fetch/i.test(msg)) {
        try {
          const { enqueueTask } = await import("@/lib/offline-queue");
          const { data: existing } = await supabase
            .from("tasks")
            .select("position")
            .eq("project_id", effectiveProject.id)
            .order("position", { ascending: false })
            .limit(1)
            .throwOnError();
          await enqueueTask({
            workspace_id: ws!.id,
            project_id: effectiveProject.id,
            title: parsed.title,
            status: "todo",
            position: existing && existing.length > 0 ? Number(existing[0].position) + 1000 : 0,
            created_by: user!.id,
            tags: parsed.tags,
            due_date: effectiveDate,
            task_type: taskType,
            parent_task_id: parentTaskId,
            assignee_ids: assigneeIds,
          });
          toast.success("Saved offline — will sync when reconnected");
          setText("");
          if (!keepOpen) setOpen(false);
          return;
        } catch {
          // fall through
        }
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="max-h-[80vh] pb-safe">
        <DrawerHeader className="px-4 pb-2 pt-1">
          <DrawerTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Quick capture
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </DrawerTitle>
        </DrawerHeader>

        <div className="space-y-3 px-4">
          {/* Type segmented selector */}
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5">
            {TASK_TYPES.map((t) => {
              const meta = TASK_TYPE_META[t];
              const Icon = meta.icon;
              const active = taskType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTaskType(t)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition ${
                    active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={active ? { color: meta.color } : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{meta.label}</span>
                </button>
              );
            })}
          </div>

          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              taskType === "initiative" ? "Launch Q3 product line" :
              taskType === "epic" ? "Build checkout v2" :
              taskType === "subtask" ? "Set up webhook endpoints" :
              "Buy milk tomorrow @personal #errands"
            }
            className="h-12 text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate(false);
            }}
          />

          {/* Parent picker (required for epic/task/subtask) */}
          {needsParent && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Parent {TASK_TYPE_META[requiredParentType!].label.toLowerCase()}
                {!parentTaskId && <span className="text-destructive"> *</span>}
              </p>
              <Select
                value={parentTaskId ?? ""}
                onValueChange={(v) => setParentTaskId(v || null)}
                disabled={validParents.length === 0}
              >
                <SelectTrigger className="h-9">
                  <SelectValue
                    placeholder={
                      validParents.length === 0
                        ? `No ${TASK_TYPE_META[requiredParentType!].label.toLowerCase()} in this project yet`
                        : `Pick a ${TASK_TYPE_META[requiredParentType!].label.toLowerCase()}`
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {validParents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Assignees */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Assignees</p>
            <AssigneePicker value={assigneeIds} onChange={setAssigneeIds} />
          </div>

          {/* Parsed chips */}
          {(effectiveDate || parsed.tags.length > 0 || parsed.projectName) && (
            <div className="flex flex-wrap gap-1.5">
              {effectiveDate && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <CalendarPlus className="h-3 w-3" />
                  {format(new Date(effectiveDate), "EEE, MMM d")}
                </Badge>
              )}
              {parsed.projectName && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Folder className="h-3 w-3" />
                  {parsed.projectName}
                </Badge>
              )}
              {parsed.tags.map((t) => (
                <Badge key={t} variant="outline" className="gap-1 text-xs">
                  <Tag className="h-3 w-3" />
                  {t}
                </Badge>
              ))}
            </div>
          )}

          {/* Quick date pills */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_DATES.map((d) => (
              <button
                key={d.label}
                onClick={() => {
                  haptic("tap");
                  setOverrideDate(d.value().toISOString().slice(0, 10));
                }}
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/50 hover:bg-accent"
              >
                <Clock className="mr-1 inline h-3 w-3" />
                {d.label}
              </button>
            ))}
            {effectiveDate && (
              <button
                onClick={() => setOverrideDate(null)}
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
              >
                <X className="mr-1 inline h-3 w-3" />
                Clear date
              </button>
            )}
          </div>

          {/* Project rail — pinned/favorite projects first */}
          {!parsed.projectName && orderedProjects.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Project {favProjectIds.size > 0 && <span className="opacity-60">· starred shown first</span>}
                </p>
                {favProjectIds.size === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Star projects in the sidebar to pin them here
                  </p>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {orderedProjects.slice(0, 12).map((p) => {
                  const active = selectedProjectId === p.id;
                  const fav = favProjectIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        haptic("tap");
                        setSelectedProjectId(p.id);
                      }}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                        active
                          ? "border-primary bg-aura-gradient-subtle text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {fav ? (
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ) : (
                        <span
                          className="inline-block h-2 w-2 rounded-sm"
                          style={{ backgroundColor: p.color }}
                        />
                      )}
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2 px-4">
          <Button
            className="h-12 w-full bg-aura-gradient text-base text-primary-foreground hover:opacity-90"
            disabled={!canCreate || saving}
            onClick={() => handleCreate(false)}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Add task
            {effectiveProject && (
              <span className="ml-1 opacity-80">to {effectiveProject.name}</span>
            )}
          </Button>
          <Button
            variant="ghost"
            className="h-9 w-full text-xs text-muted-foreground"
            disabled={!canCreate || saving}
            onClick={() => handleCreate(true)}
          >
            Add &amp; create another
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
