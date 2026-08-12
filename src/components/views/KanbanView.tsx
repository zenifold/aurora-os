import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task, ViewConfig } from "@/lib/types";
import type { PresenceUser } from "@/hooks/use-presence";
import { PRIORITY_OPTIONS } from "@/lib/types";
import { getTaskTypeMeta } from "@/lib/task-types";
import { useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { useProjectRelationIndicators } from "@/hooks/use-task-relations";
import {
  useProjectWorkflow,
  useProjectTransitions,
  useProjectDwellTimes,
  DEFAULT_WORKFLOW,
} from "@/hooks/use-project-workflow";
import { useTransitionGuard } from "@/hooks/use-transition-guard";
import { runTransitionActions } from "@/lib/transition-actions";
import { findTransition } from "@/lib/workflow-engine";
import { supabase } from "@/integrations/supabase/client";
import { colorForTask } from "@/lib/view-config";
import { Plus, Calendar as CalendarIcon, ArrowLeftCircle, ArrowRightCircle, ChevronLeft, ChevronRight, Flag, Trash2, Copy, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { AssigneeAvatars } from "@/components/tasks/AssigneeAvatars";
import { BulkActionBar } from "@/components/views/BulkActionBar";
import { TaskTypeChip } from "@/components/tasks/TaskTypeChip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";

interface Props {
  projectId: string;
  tasks: Task[];
  viewConfig?: ViewConfig;
  onTaskClick: (id: string) => void;
  presenceUsers?: PresenceUser[];
}

export function KanbanView({ projectId, tasks, viewConfig = {}, onTaskClick, presenceUsers = [] }: Props) {
  const update = useUpdateTask(projectId);
  const create = useCreateTask(projectId);
  const { data: indicators } = useProjectRelationIndicators(projectId);
  const { data: workflow = DEFAULT_WORKFLOW } = useProjectWorkflow(projectId);
  const { data: transitions = [] } = useProjectTransitions(projectId);
  const { data: dwellTimes } = useProjectDwellTimes(projectId);
  const guard = useTransitionGuard();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );
  const cardFields = viewConfig.cardFields ?? ["priority", "due_date"];
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeCol, setActiveCol] = useState(0);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth;
      if (!w) return;
      setActiveCol(Math.round(el.scrollLeft / w));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  const jumpToCol = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string, mode: "single" | "additive") => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === "additive") {
        if (next.has(id)) next.delete(id); else next.add(id);
      } else {
        if (next.size === 1 && next.has(id)) next.clear();
        else { next.clear(); next.add(id); }
      }
      return next;
    });
  };
  const statusColorMap = useMemo(() => new Map(workflow.map((s) => [s.id, s.color])), [workflow]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(`kanban:collapsed:${projectId}`) ?? "[]"));
    } catch { return new Set(); }
  });
  useEffect(() => {
    try { localStorage.setItem(`kanban:collapsed:${projectId}`, JSON.stringify([...collapsed])); } catch {/* noop */}
  }, [collapsed, projectId]);
  const toggleCollapsed = (id: string) => setCollapsed((p) => {
    const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const [nudgeColId, setNudgeColId] = useState<string | null>(null);
  // Resolve task.status (which may be a name or id) to a workflow status row
  const findStatusForTask = (t: Task) =>
    workflow.find((s) => s.id === t.status) ??
    workflow.find((s) => s.name.toLowerCase() === String(t.status).toLowerCase());

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const s of workflow) map.set(s.id, []);
    for (const t of tasks) {
      const matched =
        workflow.find((s) => s.id === t.status) ??
        workflow.find((s) => s.name.toLowerCase() === String(t.status).toLowerCase());
      const key = matched?.id ?? workflow[0]?.id ?? "todo";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks, workflow]);

  const viewersByTask = useMemo(() => {
    const m = new Map<string, PresenceUser[]>();
    for (const u of presenceUsers) {
      if (u.viewing_task_id) {
        const arr = m.get(u.viewing_task_id) ?? [];
        arr.push(u);
        m.set(u.viewing_task_id, arr);
      }
    }
    return m;
  }, [presenceUsers]);

  const handleDragEnd = async (e: DragEndEvent) => {
    const taskId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId) return;
    const target = workflow.find((s) => `col-${s.id}` === overId);
    if (!target) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const fromStatus = findStatusForTask(task);
    if (fromStatus?.id === target.id) return;
    const destinationCount = (grouped.get(target.id) ?? []).length;
    if (target.wip_limit != null && destinationCount >= target.wip_limit) {
      setNudgeColId(target.id);
      window.setTimeout(() => setNudgeColId(null), 400);
      toast.warning(`${target.name} is at WIP limit (${target.wip_limit})`, {
        description: "Finish or move a task out before adding more.",
      });
    }
    const result = await guard({
      task,
      toStatus: target,
      fromStatus,
      workflow,
      transitions,
      destinationCount,
    });
    if (!result.allowed) return;
    update.mutate(
      { id: taskId, status: target.id, workflow_status_id: target.id },
      {
        onSuccess: async () => {
          const transition = fromStatus
            ? findTransition(transitions, fromStatus.id, target.id)
            : undefined;
          if (!transition?.actions?.length) return;
          const { data: u } = await supabase.auth.getUser();
          await runTransitionActions(transition.actions, {
            task,
            fromStatus,
            toStatus: target,
            transition,
            actorId: u.user?.id ?? null,
          });
        },
      },
    );
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-full flex-col">
        <div
          ref={scrollerRef}
          className="flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden p-3 lg:snap-none lg:p-4"
        >
          {workflow.map((s) => {
            const list = grouped.get(s.id) ?? [];
            const overLimit = s.wip_limit != null && list.length > s.wip_limit;
            return (
              <Column
                key={s.id}
                id={`col-${s.id}`}
                projectId={projectId}
                statusId={s.id}
                title={s.name}
                color={s.color}
                wipLimit={s.wip_limit}
                overLimit={overLimit}
                isCollapsed={collapsed.has(s.id)}
                onToggleCollapsed={() => toggleCollapsed(s.id)}
                shake={nudgeColId === s.id}
                entryCriteria={s.entry_criteria}
                tasks={list}
                indicators={indicators}
                cardFields={cardFields}
                slaHours={s.sla_hours}
                dwellTimes={dwellTimes}
                colorFor={(t) => colorForTask(t, viewConfig, statusColorMap)}
                onAdd={(title) => create.mutate({ title, status: s.id })}
                onTaskClick={(id, e) => {
                  if (e && (e.metaKey || e.ctrlKey || e.shiftKey)) {
                    toggleSelect(id, "additive");
                  } else if (selected.size > 0) {
                    toggleSelect(id, "additive");
                  } else {
                    onTaskClick(id);
                  }
                }}
                selected={selected}
                viewersByTask={viewersByTask}
              />
            );
          })}
        </div>
        {workflow.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 border-t border-border/60 bg-background/80 py-2 backdrop-blur lg:hidden">
            {workflow.map((s, i) => (
              <button
                key={s.id}
                onClick={() => jumpToCol(i)}
                aria-label={`Go to ${s.name}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeCol ? "w-6" : "w-1.5 opacity-50"
                }`}
                style={{ background: i === activeCol ? s.color : "currentColor" }}
              />
            ))}
          </div>
        )}
      </div>
      <BulkActionBar projectId={projectId} selected={selected} onClear={() => setSelected(new Set())} />
    </DndContext>
  );
}

function Column({
  id,
  projectId,
  statusId,
  title,
  color,
  wipLimit,
  overLimit,
  isCollapsed,
  onToggleCollapsed,
  shake,
  entryCriteria,
  tasks,
  indicators,
  cardFields,
  slaHours,
  dwellTimes,
  colorFor,
  onAdd,
  onTaskClick,
  selected,
  viewersByTask,
}: {
  id: string;
  projectId: string;
  statusId: string;
  title: string;
  color: string;
  wipLimit: number | null;
  overLimit: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  shake: boolean;
  entryCriteria?: Array<{ type: string; message?: string; field?: string }>;
  tasks: Task[];
  indicators?: Map<string, { blockedBy: number; blocking: number }> | Record<string, { blockedBy: number; blocking: number }>;
  cardFields: Array<"priority" | "due_date" | "assignees" | "tags">;
  slaHours: number | null;
  dwellTimes?: Map<string, number>;
  colorFor: (t: Task) => string | null;
  onAdd: (title: string) => void;
  onTaskClick: (id: string, e?: React.MouseEvent) => void;
  selected: Set<string>;
  viewersByTask: Map<string, PresenceUser[]>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");

  const submit = () => {
    if (val.trim()) onAdd(val.trim());
    setVal("");
    setAdding(false);
  };

  const wipPct = wipLimit && wipLimit > 0 ? Math.min(1, tasks.length / wipLimit) : 0;

  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        className={`hidden lg:flex w-10 shrink-0 flex-col items-center gap-2 rounded-lg border bg-muted/20 py-2 transition-colors ${
          isOver ? "border-primary/60 bg-muted/50" : "border-border"
        }`}
      >
        <button
          onClick={onToggleCollapsed}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={`Expand ${title}`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <div
          className="flex flex-1 items-center justify-center"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          <span className="whitespace-nowrap text-xs font-medium">
            {title} · {tasks.length}{wipLimit != null ? `/${wipLimit}` : ""}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[calc(100vw-2rem)] max-w-sm shrink-0 snap-center flex-col rounded-lg border bg-muted/30 transition-colors lg:w-72 ${
        overLimit ? "border-destructive/60" : isOver ? "border-primary/50 bg-muted/60" : "border-border"
      } ${shake ? "animate-shake" : ""}`}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <button
          onClick={onToggleCollapsed}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-label={`Collapse ${title}`}
        >
          <ChevronLeft className="hidden h-3 w-3 text-muted-foreground lg:block" />
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
          <span className="truncate text-sm font-medium">{title}</span>
          <span className={`text-xs ${overLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {tasks.length}{wipLimit != null ? `/${wipLimit}` : ""}
          </span>
        </button>
        <button
          onClick={() => setAdding(true)}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Add task"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {wipLimit != null && (
        <div className="h-0.5 w-full bg-border/40">
          <div
            className={`h-full transition-all ${overLimit ? "bg-destructive" : wipPct >= 0.8 ? "bg-amber-500" : "bg-primary/60"}`}
            style={{ width: `${Math.max(4, wipPct * 100)}%` }}
          />
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {tasks.map((t) => {
          const dwell = dwellTimes instanceof Map
            ? dwellTimes.get(t.id)
            : (dwellTimes as Record<string, number> | undefined)?.[t.id];
          const slaPct = slaHours != null && dwell != null ? dwell / slaHours : null;
          return (
            <Card
              key={t.id}
              task={t}
              projectId={projectId}
              statusId={statusId}
              cardFields={cardFields}
              accent={colorFor(t)}
              slaPct={slaPct}
              isSelected={selected.has(t.id)}
              onClick={(e) => onTaskClick(t.id, e)}
              indicator={indicators ? (typeof (indicators as { get?: unknown }).get === "function" ? (indicators as Map<string, { blockedBy: number; blocking: number }>).get(t.id) : (indicators as unknown as Record<string, { blockedBy: number; blocking: number }>)[t.id]) : undefined}
              viewers={viewersByTask.get(t.id) ?? []}
            />
          );
        })}
        {adding && (
          <Input
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") {
                setAdding(false);
                setVal("");
              }
            }}
            placeholder="Task title"
            className="h-8 text-sm"
          />
        )}
        {!adding && tasks.length === 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border/60 py-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> New task
            </button>
            {entryCriteria && entryCriteria.length > 0 && (
              <div className="rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
                <div className="mb-1 font-medium uppercase tracking-wide opacity-70">Entry criteria</div>
                <ul className="space-y-0.5">
                  {entryCriteria.slice(0, 3).map((g, i) => (
                    <li key={i} className="flex gap-1">
                      <span className="opacity-50">·</span>
                      <span className="truncate">{g.message ?? humanizeGate(g)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function humanizeGate(g: { type: string; field?: string }): string {
  switch (g.type) {
    case "field_required": return `${g.field ?? "Field"} required`;
    case "approval_required": return "Approval required";
    case "all_blockers_resolved":
    case "no_open_blockers": return "No open blockers";
    case "subtasks_status": return "Subtasks must be complete";
    case "child_tasks_status": return "Child tasks must be complete";
    case "checklist_min": return "Checklist progress required";
    case "time_logged": return "Time must be logged";
    case "custom_field": return "Custom field condition";
    default: return g.type;
  }
}

function Card({
  task,
  projectId,
  statusId: _statusId,
  cardFields,
  accent,
  slaPct,
  onClick,
  indicator,
  isSelected = false,
  viewers = [],
}: {
  task: Task;
  projectId: string;
  statusId: string;
  cardFields: Array<"priority" | "due_date" | "assignees" | "tags">;
  accent: string | null;
  slaPct: number | null;
  onClick: (e: React.MouseEvent) => void;
  indicator?: { blockedBy: number; blocking: number };
  isSelected?: boolean;
  viewers?: PresenceUser[];
}) {
  const update = useUpdateTask(projectId);
  const create = useCreateTask(projectId);
  const del = useDeleteTask(projectId);
  const [dueOpen, setDueOpen] = useState(false);
  const { setNodeRef, transform, listeners, attributes, isDragging } = useDraggable({ id: task.id });
  const priority = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
  const isBlocked = (indicator?.blockedBy ?? 0) > 0;
  const isBlocking = (indicator?.blocking ?? 0) > 0;
  const showPriority = cardFields.includes("priority") && priority;
  const showDue = cardFields.includes("due_date") && task.due_date;
  const showAssignees = cardFields.includes("assignees") && task.assignee_ids.length > 0;
  const showTags = cardFields.includes("tags") && task.tags.length > 0;
  const hasFooter = showPriority || showDue || showAssignees || showTags;

  const typeMeta = getTaskTypeMeta(task.task_type);
  const isInitiative = typeMeta.type === "initiative";
  const isEpic = typeMeta.type === "epic";
  const isSubtask = typeMeta.type === "subtask";
  const childCount = task.child_count ?? 0;
  const completedCount = task.completed_child_count ?? 0;
  // SLA aging: green <60%, amber 60-100%, red >100% of allotted time in this status
  const slaTone =
    slaPct == null
      ? null
      : slaPct >= 1
        ? "hsl(var(--destructive))"
        : slaPct >= 0.6
          ? "hsl(38 92% 50%)"
          : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        borderLeft: `${isInitiative ? 4 : isEpic ? 3 : 2}px solid ${accent ?? typeMeta.color}`,
      }}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onClick(e);
        }
      }}
      className={`relative cursor-grab overflow-hidden rounded-md border bg-card text-left shadow-sm transition hover:shadow-md active:cursor-grabbing ${
        isSelected ? "border-primary ring-2 ring-primary/40" : "border-border"
      } ${isInitiative ? "p-3 ring-1 ring-inset" : isSubtask ? "p-2" : "p-2.5"}`}
    >
      {/* SLA aging top bar */}
      {slaTone && (
        <span
          aria-hidden
          className="absolute left-0 right-0 top-0 h-[2px]"
          style={{ background: slaTone }}
          title={`SLA dwell: ${(slaPct! * 100).toFixed(0)}% of budget`}
        />
      )}
      {/* Right-edge dependency strip */}
      {(isBlocked || isBlocking) && (
        <span
          aria-hidden
          className="absolute right-0 top-0 h-full w-[3px]"
          style={{
            background:
              isBlocked && isBlocking
                ? "repeating-linear-gradient(45deg, hsl(var(--destructive)) 0 4px, hsl(var(--primary)) 4px 8px)"
                : isBlocked
                  ? "hsl(var(--destructive))"
                  : "hsl(var(--primary))",
          }}
        />
      )}

      <div className="flex items-start gap-1.5">
        <TaskTypeChip
          value={task.task_type}
          onChange={(next) =>
            update.mutate({ id: task.id, task_type: next } as Partial<Task> & { id: string })
          }
          iconOnly
          size={isInitiative ? 16 : 14}
          hasChildren={(task.child_count ?? 0) > 0}
        />
        {isBlocked && (
          <ArrowLeftCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
            aria-label={`Blocked by ${indicator?.blockedBy} task(s)`}
          />
        )}
        {isBlocking && !isBlocked && (
          <ArrowRightCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
            aria-label={`Blocking ${indicator?.blocking} task(s)`}
          />
        )}
        <p className={`line-clamp-2 flex-1 ${isInitiative ? "text-sm font-bold" : isSubtask ? "text-xs" : "text-sm font-medium"} ${isSubtask && task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        {(isInitiative || isEpic) && childCount > 0 && (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
            style={{ background: typeMeta.tint, color: typeMeta.color }}
            title={`${completedCount} of ${childCount} complete`}
          >
            {completedCount}/{childCount}
          </span>
        )}
        {viewers.length > 0 && (
          <div
            className="ml-auto flex items-center -space-x-1"
            title={viewers.map((v) => v.display_name).join(", ") + " viewing"}
          >
            {viewers.slice(0, 3).map((v) => (
              <span
                key={v.user_id}
                className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-card"
                style={{ background: v.color }}
              />
            ))}
          </div>
        )}
      </div>

      {hasFooter && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {showPriority && priority && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: `${priority.color}22`, color: priority.color }}
            >
              {priority.label}
            </span>
          )}
          {showDue && task.due_date && (() => {
            const days = differenceInCalendarDays(parseISO(task.due_date), new Date());
            const tone = days < 0
              ? "bg-destructive/15 text-destructive"
              : days <= 1
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-muted text-muted-foreground";
            return (
              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${tone}`}>
                <CalendarIcon className="h-3 w-3" />
                {format(parseISO(task.due_date), "MMM d")}
              </span>
            );
          })()}
          {showTags && task.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-accent/60 px-1.5 py-0.5 text-[10px] text-accent-foreground">
              #{t}
            </span>
          ))}
          {showTags && task.tags.length > 3 && (
            <span className="text-[10px]">+{task.tags.length - 3}</span>
          )}
          <div className="ml-auto">
            {showAssignees && <AssigneeAvatars ids={task.assignee_ids} max={3} size={20} />}
          </div>
        </div>
      )}
      </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={(e) => { e.preventDefault(); onClick({ stopPropagation() {}, preventDefault() {} } as unknown as React.MouseEvent); }}>
          Open task
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Flag className="mr-2 h-3.5 w-3.5" /> Priority
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {PRIORITY_OPTIONS.map((p) => (
              <ContextMenuItem
                key={p.value}
                onSelect={() => update.mutate({ id: task.id, priority: p.value })}
              >
                <span className="mr-2 h-2 w-2 rounded-full" style={{ background: p.color }} />
                {p.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <Popover open={dueOpen} onOpenChange={setDueOpen}>
          <PopoverTrigger asChild>
            <ContextMenuItem onSelect={(e) => { e.preventDefault(); setDueOpen(true); }}>
              <CalendarIcon className="mr-2 h-3.5 w-3.5" /> Set due date
              {task.due_date && (
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {format(parseISO(task.due_date), "MMM d")}
                </span>
              )}
            </ContextMenuItem>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={task.due_date ? parseISO(task.due_date) : undefined}
              onSelect={(d) => {
                update.mutate({ id: task.id, due_date: d ? format(d, "yyyy-MM-dd") : null });
                setDueOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {task.due_date && (
          <ContextMenuItem onSelect={() => update.mutate({ id: task.id, due_date: null })}>
            <X className="mr-2 h-3.5 w-3.5" /> Clear due date
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            create.mutate({
              title: `${task.title} (copy)`,
              status: task.status,
              task_type: task.task_type,
            });
            toast.success("Task duplicated");
          }}
        >
          <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
        </ContextMenuItem>
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => del.mutate(task.id)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
