import { useEffect, useState } from "react";
import { confirmDialog } from "@/lib/dialogs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CustomFieldDef, Task } from "@/lib/types";
import { PRIORITY_OPTIONS } from "@/lib/types";
import { useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { useProject } from "@/hooks/use-projects";
import { TaskRefBadge } from "./TaskRefBadge";
import { useProjectWorkflow } from "@/hooks/use-project-workflow";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import {
  Trash2,
  Calendar as CalendarIcon,
  Maximize2,
  PanelRightOpen,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { RichEditor } from "./RichEditor";
import { RecurrencePicker } from "./RecurrencePicker";
import { CommentsThread } from "./CommentsThread";
import { SubtasksList } from "./SubtasksList";
import { ActivityFeed } from "./ActivityFeed";
import { TaskAiPanel } from "./TaskAiPanel";
import { TaskRelationsSection } from "./TaskRelationsSection";
import { TaskLinkedItemsSection } from "./TaskLinkedItemsSection";
import { EntityLinksPanel } from "@/components/entity-links/EntityLinksPanel";
import { EntityBacklinksPanel } from "@/components/entity-links/EntityBacklinksPanel";
import { ApprovalsPanel } from "./ApprovalsPanel";
import { StatusHistoryTimeline } from "./StatusHistoryTimeline";
import { TaskTimeSection } from "./TaskTimeSection";
import { ClientDeliverableSection } from "./ClientDeliverableSection";
import { AssigneePicker } from "./AssigneePicker";
import { TagsEditor } from "./TagsEditor";
import { CustomFieldsSection } from "./CustomFieldsSection";
import { Sparkles, Users, Tag as TagIcon, Flag, Clock, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PresenceStack } from "@/components/app/PresenceStack";
import { usePresence, type PresenceUser } from "@/hooks/use-presence";
import { useAuth } from "@/lib/auth-context";
import { useIsMobile } from "@/hooks/use-mobile-breakpoint";
import { AttachmentsList } from "@/components/app/AttachmentsList";
import { TaskTypeChip } from "./TaskTypeChip";
import type { TaskType } from "@/lib/task-types";
import { getTaskTypeMeta } from "@/lib/task-types";
import { Flag as FlagIcon, CheckCircle2 } from "lucide-react";

type PresentationMode = "drawer" | "modal";
export type TaskViewKind = "table" | "kanban" | "canvas" | "calendar" | "timeline" | "sprint" | "mobile";

// Per-view default presentation. Boards / canvases feel better as a focused
// modal; list/timeline/calendar/sprint default to a side drawer so the
// underlying row stays in context. Persisted per view kind.
const DEFAULT_MODE_BY_VIEW: Record<TaskViewKind, PresentationMode> = {
  table: "drawer",
  timeline: "drawer",
  calendar: "drawer",
  sprint: "drawer",
  kanban: "modal",
  canvas: "modal",
  mobile: "drawer",
};

const prefKey = (view: TaskViewKind) => `aurora.taskDetail.presentation.${view}`;

function getInitialMode(view: TaskViewKind): PresentationMode {
  if (typeof window === "undefined") return DEFAULT_MODE_BY_VIEW[view];
  const v = window.localStorage.getItem(prefKey(view));
  return v === "modal" || v === "drawer" ? v : DEFAULT_MODE_BY_VIEW[view];
}

export function TaskDetailPanel({
  projectId,
  taskId,
  onClose,
  fields,
  viewKind = "table",
  orderedTaskIds,
  onSelectTask,
}: {
  projectId: string;
  taskId: string | null;
  onClose: () => void;
  fields: CustomFieldDef[];
  viewKind?: TaskViewKind;
  orderedTaskIds?: string[];
  onSelectTask?: (id: string) => void;
}) {
  const update = useUpdateTask(projectId);
  const remove = useDeleteTask(projectId);
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const effectiveView: TaskViewKind = isMobile ? "mobile" : viewKind;
  const { data: workflow = [] } = useProjectWorkflow(projectId);
  const { data: project } = useProject(projectId);
  const { users: viewers } = usePresence(taskId ? `presence:task:${taskId}` : null, {
    display_name: user?.email?.split("@")[0],
  });

  const [mode, setMode] = useState<PresentationMode>(() => getInitialMode(effectiveView));
  // When the underlying view changes, switch to that view's saved/default mode.
  useEffect(() => {
    setMode(getInitialMode(effectiveView));
  }, [effectiveView]);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(prefKey(effectiveView), mode);
  }, [mode, effectiveView]);

  // Prev / next navigation within the current ordered task list.
  const currentIndex = taskId && orderedTaskIds ? orderedTaskIds.indexOf(taskId) : -1;
  const prevId = currentIndex > 0 ? orderedTaskIds![currentIndex - 1] : null;
  const nextId = orderedTaskIds && currentIndex >= 0 && currentIndex < orderedTaskIds.length - 1
    ? orderedTaskIds[currentIndex + 1]
    : null;

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("id", taskId!).single();
      if (error) throw error;
      return data as Task;
    },
  });

  const [title, setTitle] = useState("");

  useEffect(() => {
    if (task) setTitle(task.title);
  }, [task]);

  // Build status options from project workflow (custom statuses live in workflow_statuses).
  const statusOptions = workflow.length > 0
    ? workflow.map((s) => ({ value: s.id, label: s.name, color: s.color, isTerminal: !!s.is_terminal }))
    : [];

  const status = task
    ? statusOptions.find(
        (s) =>
          s.value === (task as { workflow_status_id?: string }).workflow_status_id ||
          s.value === task.status ||
          s.label.toLowerCase() === String(task.status ?? "").toLowerCase(),
      )
    : undefined;
  const priority = task ? PRIORITY_OPTIONS.find((p) => p.value === task.priority) : undefined;

  const useModal = !isMobile && mode === "modal";

  const body = task ? (
    <TaskBody
      task={task}
      project={project ?? null}
      title={title}
      setTitle={setTitle}
      status={status}
      priority={priority}
      statusOptions={statusOptions}
      fields={fields}
      isMobile={isMobile}
      mode={useModal ? "modal" : "drawer"}
      onChangeMode={setMode}
      viewers={viewers}
      onPrev={prevId && onSelectTask ? () => onSelectTask(prevId) : undefined}
      onNext={nextId && onSelectTask ? () => onSelectTask(nextId) : undefined}
      positionLabel={
        orderedTaskIds && currentIndex >= 0
          ? `${currentIndex + 1} of ${orderedTaskIds.length}`
          : undefined
      }
      onUpdate={(patch) => update.mutate({ id: task.id, ...patch } as never)}
      onDelete={async () => {
        const ok = await confirmDialog({
          title: "Delete this task?",
          description: "This will also remove its subtasks, comments and attachments.",
          confirmLabel: "Delete",
          tone: "destructive",
        });
        if (ok) { remove.mutate(task.id); onClose(); }
      }}
    />
  ) : (
    <div className="p-6 text-sm text-muted-foreground">Loading task…</div>
  );

  // Modal (desktop only) — wider centered popup.
  if (useModal) {
    return (
      <Dialog open={!!taskId} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="flex h-[90vh] max-h-[920px] w-[min(1100px,95vw)] max-w-[95vw] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Task details</DialogTitle>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  // Drawer (default + always on mobile)
  return (
    <Sheet open={!!taskId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "flex h-[92vh] w-full max-w-full flex-col overflow-hidden p-0 pt-safe"
            : "flex w-full flex-col overflow-hidden p-0 sm:max-w-2xl"
        }
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Task details</SheetTitle>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}

interface StatusOpt { value: string; label: string; color: string; isTerminal?: boolean }

function TaskBody({
  task,
  project,
  title,
  setTitle,
  status,
  priority,
  statusOptions,
  fields,
  isMobile,
  mode,
  onChangeMode,
  viewers,
  onPrev,
  onNext,
  positionLabel,
  onUpdate,
  onDelete,
}: {
  task: Task;
  project: import("@/lib/types").Project | null;
  title: string;
  setTitle: (s: string) => void;
  status: StatusOpt | undefined;
  priority: { value: string; label: string; color: string } | undefined;
  statusOptions: StatusOpt[];
  fields: CustomFieldDef[];
  isMobile: boolean;
  mode: PresentationMode;
  onChangeMode: (m: PresentationMode) => void;
  viewers: PresenceUser[];
  onPrev?: () => void;
  onNext?: () => void;
  positionLabel?: string;
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div
        className={`space-y-3 border-b border-border px-6 py-4 pr-12 ${
          isMobile ? "sticky top-0 z-20 bg-background/95 backdrop-blur" : ""
        }`}
        style={{
          background: status?.color
            ? `linear-gradient(180deg, color-mix(in oklab, ${status.color} 10%, transparent) 0%, transparent 100%)`
            : undefined,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {status ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: `color-mix(in oklab, ${status.color} 18%, transparent)`,
                  color: status.color,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                {status.label}
              </span>
            ) : (
              <Badge variant="outline" className="text-[10px]">No status</Badge>
            )}
            {priority && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: `color-mix(in oklab, ${priority.color} 18%, transparent)`,
                  color: priority.color,
                }}
              >
                <Flag className="h-3 w-3" />
                {priority.label}
              </span>
            )}
            <TaskTypeChip
              value={task.task_type}
              onChange={(t: TaskType) => onUpdate({ task_type: t } as Partial<Task>)}
            />
            {typeof task.child_count === "number" && task.child_count > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
                title={`${task.completed_child_count ?? 0} of ${task.child_count} children complete`}
              >
                {(task.completed_child_count ?? 0)}/{task.child_count}
                {typeof task.rollup_progress === "number" && (
                  <span className="text-muted-foreground/70">· {task.rollup_progress}%</span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {(onPrev || onNext) && !isMobile && (
              <div className="mr-1 flex items-center gap-0.5 rounded-md border border-border/60 bg-background/60">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md text-muted-foreground disabled:opacity-30"
                  onClick={onPrev}
                  disabled={!onPrev}
                  aria-label="Previous task"
                  title="Previous task"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md text-muted-foreground disabled:opacity-30"
                  onClick={onNext}
                  disabled={!onNext}
                  aria-label="Next task"
                  title="Next task"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                {positionLabel && (
                  <span className="px-1.5 text-[10px] tabular-nums text-muted-foreground">
                    {positionLabel}
                  </span>
                )}
              </div>
            )}
            {viewers.length > 0 && (
              <>
                <span className="hidden text-[10px] text-muted-foreground sm:inline">
                  {viewers.length === 1 ? "1 viewer" : `${viewers.length} viewers`}
                </span>
                <PresenceStack users={viewers} max={3} />
              </>
            )}
            {!isMobile && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => onChangeMode(mode === "modal" ? "drawer" : "modal")}
                      aria-label={mode === "modal" ? "Switch to drawer" : "Switch to modal"}
                    >
                      {mode === "modal" ? <PanelRightOpen className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {mode === "modal" ? "Switch to side drawer" : "Open as full popup"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TaskRefBadge task={task} project={project} size="sm" />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (title !== task.title) onUpdate({ title }); }}
            className="border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <MilestoneReadyBanner
        task={task}
        status={status}
        statusOptions={statusOptions}
        onUpdate={onUpdate}
      />

      {/* Single scroll container so mobile + desktop scroll smoothly without nested scrollers */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="space-y-4 border-b border-border bg-muted/20 px-6 py-4">
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <FieldRow label="Status" icon={<span className="h-2 w-2 rounded-full" style={{ background: status?.color }} />}>
              <Select value={status?.value ?? ""} onValueChange={(v) => onUpdate({ status: v, workflow_status_id: v } as never)}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Set status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No statuses configured</div>
                  )}
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Priority" icon={<Flag className="h-3 w-3" style={{ color: priority?.color }} />}>
              <Select value={task.priority} onValueChange={(v) => onUpdate({ priority: v as Task["priority"] })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Start date" icon={<CalendarIcon className="h-3 w-3" />}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-full justify-start font-normal">
                    {task.start_date ? format(parseISO(task.start_date), "MMM d, yyyy") : <span className="text-muted-foreground">Set date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={task.start_date ? parseISO(task.start_date) : undefined}
                    onSelect={(d) => onUpdate({ start_date: d ? format(d, "yyyy-MM-dd") : null })}
                  />
                </PopoverContent>
              </Popover>
            </FieldRow>
            <FieldRow label="Due date" icon={<CalendarIcon className="h-3 w-3" />}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-full justify-start font-normal">
                    {task.due_date ? format(parseISO(task.due_date), "MMM d, yyyy") : <span className="text-muted-foreground">Set date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={task.due_date ? parseISO(task.due_date) : undefined}
                    onSelect={(d) => onUpdate({ due_date: d ? format(d, "yyyy-MM-dd") : null })}
                  />
                </PopoverContent>
              </Popover>
            </FieldRow>
            <FieldRow label="Repeat" icon={<Clock className="h-3 w-3" />}>
              <RecurrencePicker
                value={task.recurrence ?? null}
                onChange={(rule) => onUpdate({ recurrence: rule as never })}
              />
            </FieldRow>
            <FieldRow label="Created" icon={<Hash className="h-3 w-3" />}>
              <div className="flex h-8 items-center text-xs text-muted-foreground">
                {format(parseISO(task.created_at), "MMM d, yyyy")}
              </div>
            </FieldRow>
          </div>

          <div className="space-y-3">
            <FieldRow label="Assignees" icon={<Users className="h-3 w-3" />}>
              <AssigneePicker
                value={task.assignee_ids ?? []}
                onChange={(ids) => onUpdate({ assignee_ids: ids as never })}
                taskId={task.id}
              />
            </FieldRow>
            <FieldRow label="Tags" icon={<TagIcon className="h-3 w-3" />}>
              <TagsEditor
                value={task.tags ?? []}
                onChange={(tags) => onUpdate({ tags: tags as never })}
              />
            </FieldRow>
          </div>
        </div>

        <Tabs defaultValue="description" className="flex flex-col">
          <TabsList className="mx-6 mt-3 w-fit overflow-x-auto">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="ai"><Sparkles className="mr-1 h-3 w-3" />AI</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="time"><Clock className="mr-1 h-3 w-3" />Time</TabsTrigger>
            <TabsTrigger value="related">Related</TabsTrigger>
          </TabsList>

          <div className="px-6 py-4 pb-24">
            <TabsContent value="description" className="mt-0 space-y-5">
              <RichEditor
                content={task.description}
                placeholder="Add more details…"
                onBlur={(json) => onUpdate({ description: json as never })}
              />

              <CustomFieldsSection task={task} fields={fields} />

              <ApprovalsPanel task={task} />
              <ClientDeliverableSection task={task} />
              <TaskRelationsSection task={task} />
              <TaskLinkedItemsSection taskId={task.id} />
              <AttachmentsList entityType="task" entityId={task.id} />
            </TabsContent>

            <TabsContent value="subtasks" className="mt-0">
              <SubtasksList parent={task} />
            </TabsContent>

            <TabsContent value="comments" className="mt-0">
              <CommentsThread taskId={task.id} />
            </TabsContent>

            <TabsContent value="ai" className="mt-0">
              <TaskAiPanel task={task} />
            </TabsContent>

            <TabsContent value="activity" className="mt-0 space-y-6">
              <StatusHistoryTimeline taskId={task.id} />
              <ActivityFeed taskId={task.id} />
            </TabsContent>

            <TabsContent value="time" className="mt-0">
              <TaskTimeSection task={task} />
            </TabsContent>

            <TabsContent value="related" className="mt-0 space-y-4">
              <EntityLinksPanel kind="task" id={task.id} title="Related items" />
              <EntityBacklinksPanel kind="task" id={task.id} hideWhenEmpty />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <div
        className={`flex items-center justify-between gap-2 border-t border-border px-6 py-3 ${
          isMobile ? "sticky bottom-0 z-20 bg-background/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur" : ""
        }`}
      >
        {isMobile ? (
          <>
            <Select value={status?.value ?? ""} onValueChange={(v) => onUpdate({ status: v, workflow_status_id: v } as never)}>
              <SelectTrigger className="h-9 flex-1">
                <SelectValue placeholder="Set status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 shrink-0">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="ml-1.5 text-xs">
                    {task.due_date ? format(parseISO(task.due_date), "MMM d") : "Date"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={task.due_date ? parseISO(task.due_date) : undefined}
                  onSelect={(d) => onUpdate({ due_date: d ? format(d, "yyyy-MM-dd") : null })}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-destructive"
              aria-label="Delete task"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <span className="font-mono text-xs text-muted-foreground">{task.id.slice(0, 8)}</span>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete task
            </Button>
          </>
        )}
      </div>
    </>
  );
}

function FieldRow({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <Label className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/**
 * Milestone helper banner. When this task is a milestone, has children, every
 * child is in a terminal status (i.e. `completed_child_count === child_count`),
 * and the milestone itself is NOT yet in a terminal status, we suggest closing
 * it. The user still has to click — we never flip status automatically.
 */
function MilestoneReadyBanner({
  task,
  status,
  statusOptions,
  onUpdate,
}: {
  task: Task;
  status: StatusOpt | undefined;
  statusOptions: StatusOpt[];
  onUpdate: (patch: Partial<Task>) => void;
}) {
  if (task.task_type !== "milestone") return null;
  const total = task.child_count ?? 0;
  const done = task.completed_child_count ?? 0;
  if (total === 0 || done < total) return null;
  if (status?.isTerminal) return null;
  const terminal = statusOptions.find((s) => s.isTerminal);
  const meta = getTaskTypeMeta("milestone");
  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-border px-6 py-2.5 text-sm"
      style={{ background: meta.tint }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <FlagIcon className="h-4 w-4 shrink-0" style={{ color: meta.color }} />
        <span className="truncate">
          All <strong>{total}</strong>{" "}
          {total === 1 ? "item" : "items"} under this milestone are complete.
        </span>
      </div>
      {terminal && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 shrink-0 gap-1.5 border-border bg-background"
          onClick={() => onUpdate({ status: terminal.value, workflow_status_id: terminal.value } as Partial<Task>)}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Mark milestone {terminal.label.toLowerCase()}
        </Button>
      )}
    </div>
  );
}
