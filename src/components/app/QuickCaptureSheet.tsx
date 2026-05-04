import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUIStore } from "@/stores/ui-store";
import { useProjects } from "@/hooks/use-projects";
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
} from "lucide-react";
import { addDays, format } from "date-fns";
import { haptic } from "@/lib/haptics";
import { TASK_TYPES, TASK_TYPE_META, PARENT_OF, type TaskType } from "@/lib/task-types";

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

  const [text, setText] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [overrideDate, setOverrideDate] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<TaskType>("task");
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Default to "Personal" project, else first project.
  useEffect(() => {
    if (!open) return;
    if (selectedProjectId) return;
    const personal = projects.find((p) => p.name.toLowerCase() === "personal");
    const fallback = personal ?? projects[0];
    if (fallback) setSelectedProjectId(fallback.id);
  }, [open, projects, selectedProjectId]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    } else {
      setText("");
      setOverrideDate(null);
      setTaskType("task");
      setParentTaskId(null);
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

      const { error } = await supabase.from("tasks").insert({
        workspace_id: ws!.id,
        project_id: effectiveProject.id,
        title: parsed.title,
        status: "todo",
        position: nextPos,
        created_by: user!.id,
        tags: parsed.tags,
        due_date: effectiveDate,
        task_type: taskType,
        parent_task_id: parentTaskId,
      } as never);
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
      toast.error(e instanceof Error ? e.message : "Failed to add task");
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
          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Buy milk tomorrow @personal #errands"
            className="h-12 text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate(false);
            }}
          />

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

          {/* Recent projects rail */}
          {!parsed.projectName && projects.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Project</p>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {projects.slice(0, 8).map((p) => {
                  const active = selectedProjectId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        haptic("tap");
                        setSelectedProjectId(p.id);
                      }}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                        active
                          ? "border-primary bg-aura-gradient-subtle text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <span
                        className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle"
                        style={{ backgroundColor: p.color }}
                      />
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
