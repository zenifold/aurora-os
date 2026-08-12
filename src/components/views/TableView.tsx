import { useEffect, useMemo, useRef, useState } from "react";
import type { CustomFieldDef, Project, Task, ViewConfig } from "@/lib/types";
import { PRIORITY_OPTIONS } from "@/lib/types";
import { useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { useProjectRelationIndicators } from "@/hooks/use-task-relations";
import { useProjectWorkflow, DEFAULT_WORKFLOW, type WorkflowStatus } from "@/hooks/use-project-workflow";
import { groupTasks } from "@/lib/filtering";
import { colorForTask, isColumnVisible } from "@/lib/view-config";
import { buildTaskTree, flattenTree, rollupFraction, rollupPercent } from "@/lib/task-tree";
import { getTaskTypeMeta } from "@/lib/task-types";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, X, ArrowLeftCircle, ArrowRightCircle, ChevronRight as ChevronRightIcon, Maximize2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateCustomField } from "@/hooks/use-custom-fields";
import type { FieldType } from "@/lib/types";
import { AssigneeAvatars } from "@/components/tasks/AssigneeAvatars";
import { AssigneePicker } from "@/components/tasks/AssigneePicker";
import { BulkActionBar } from "@/components/views/BulkActionBar";
import { TaskRefBadge } from "@/components/tasks/TaskRefBadge";
import { TaskTypeChip } from "@/components/tasks/TaskTypeChip";
import { useProject } from "@/hooks/use-projects";
import { OptionCell } from "@/components/views/OptionCell";
import { useProjectTimeTotals } from "@/hooks/use-project-time-totals";

interface Props {
  projectId: string;
  tasks: Task[];
  fields: CustomFieldDef[];
  groupBy: string | null;
  viewConfig?: ViewConfig;
  onTaskClick: (id: string) => void;
}

export function TableView({ projectId, tasks, fields, groupBy, viewConfig = {}, onTaskClick }: Props) {
  const create = useCreateTask(projectId);
  const update = useUpdateTask(projectId);
  const remove = useDeleteTask(projectId);
  const { data: project } = useProject(projectId);
  
  const createField = useCreateCustomField();
  const { data: indicators } = useProjectRelationIndicators(projectId);
  const getIndicator = (id: string) => {
    if (!indicators) return undefined;
    if (typeof (indicators as { get?: unknown }).get === "function") {
      return (indicators as Map<string, { blockedBy: number; blocking: number }>).get(id);
    }
    return (indicators as unknown as Record<string, { blockedBy: number; blocking: number }>)[id];
  };
  const { data: workflow = DEFAULT_WORKFLOW } = useProjectWorkflow(projectId);
  const STATUS_OPTIONS = workflow.map((s) => ({ value: s.id, label: s.name, color: s.color }));
  const statusColorMap = useMemo(() => new Map(workflow.map((s) => [s.id, s.color])), [workflow]);

  const showStatus = isColumnVisible(viewConfig, "status");
  const showPriority = isColumnVisible(viewConfig, "priority");
  const showDue = isColumnVisible(viewConfig, "due");
  const showAssignees = isColumnVisible(viewConfig, "assignees");
  const showTags = isColumnVisible(viewConfig, "tags");
  // Time tracking columns are off by default — opt in via View options.
  const isOptIn = (key: string) => (viewConfig.columns ?? []).some((c) => c.key === key && c.visible === true);
  const showEstimate = isOptIn("estimate");
  const showLogged = isOptIn("logged");
  const visibleFields = fields.filter((f) => isColumnVisible(viewConfig, `f:${f.id}`));
  const visibleColCount =
    1 +
    (showStatus ? 1 : 0) +
    (showPriority ? 1 : 0) +
    (showDue ? 1 : 0) +
    (showAssignees ? 1 : 0) +
    (showTags ? 1 : 0) +
    (showEstimate ? 1 : 0) +
    (showLogged ? 1 : 0) +
    visibleFields.length +
    1;

  const { data: timeTotals } = useProjectTimeTotals(showLogged ? projectId : undefined);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  // Resizable column widths (px). Persist per-project in localStorage.
  const storageKey = `aura-table-widths-${projectId}`;
  const defaultWidths: Record<string, number> = {
    select: 40,
    title: 360,
    status: 144,
    priority: 128,
    due: 128,
    assignees: 120,
    tags: 180,
    estimate: 96,
    logged: 112,
    add: 40,
  };
  fields.forEach((f) => { defaultWidths[`f:${f.id}`] = 160; });

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return defaultWidths;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      return { ...defaultWidths, ...stored };
    } catch {
      return defaultWidths;
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(widths));
    }
  }, [widths, storageKey]);

  // Ensure new custom field columns get default widths
  useEffect(() => {
    setWidths((w) => {
      const next = { ...w };
      let changed = false;
      fields.forEach((f) => {
        if (next[`f:${f.id}`] === undefined) { next[`f:${f.id}`] = 160; changed = true; }
      });
      return changed ? next : w;
    });
  }, [fields]);

  const groups = groupTasks(tasks, groupBy);

  // Hierarchy tree (only used when not grouping — grouping breaks parent/child semantics)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const tree = useMemo(() => buildTaskTree(tasks), [tasks]);
  const flat = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed]);
  const useTree = !groupBy;
  const toggleCollapse = (id: string) => {
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleAdd = async (status?: string) => {
    if (!newTitle.trim()) {
      setAdding(false);
      return;
    }
    await create.mutateAsync({ title: newTitle.trim(), status });
    setNewTitle("");
    setAdding(false);
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(tasks.map((t) => t.id)) : new Set());
  };
  const lastSelectedRef = useRef<string | null>(null);
  const toggleOne = (id: string, opts?: { range?: boolean; additive?: boolean }) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (opts?.range && lastSelectedRef.current) {
        const flatIds = (useTree ? flat.map((n) => n.task.id) : tasks.map((t) => t.id));
        const a = flatIds.indexOf(lastSelectedRef.current);
        const b = flatIds.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(flatIds[i]);
          return next;
        }
      }
      if (!opts?.additive && !opts?.range) {
        // single-toggle
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      lastSelectedRef.current = id;
      return next;
    });
  };

  const addField = async (type: FieldType) => {
    const name = prompt(`New ${type} field name:`);
    if (!name) return;
    const opts = type === "select" || type === "multi_select"
      ? [{ id: "o1", label: "Option 1", color: "#8b5cf6" }, { id: "o2", label: "Option 2", color: "#ec4899" }]
      : undefined;
    await createField.mutateAsync({ name, field_type: type, options: opts });
  };

  const allSelected = tasks.length > 0 && selected.size === tasks.length;

  return (
    <div className="min-w-max [&_.sticky-col]:sticky [&_.sticky-col]:left-0 [&_.sticky-col]:z-[5] [&_.sticky-col]:bg-background">
      <table className="border-collapse text-sm" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
        <colgroup>
          <col style={{ width: widths.title }} />
          {showStatus && <col style={{ width: widths.status }} />}
          {showPriority && <col style={{ width: widths.priority }} />}
          {showDue && <col style={{ width: widths.due }} />}
          {showAssignees && <col style={{ width: widths.assignees }} />}
          {showTags && <col style={{ width: widths.tags }} />}
          {showEstimate && <col style={{ width: widths.estimate }} />}
          {showLogged && <col style={{ width: widths.logged }} />}
          {visibleFields.map((f) => <col key={f.id} style={{ width: widths[`f:${f.id}`] ?? 160 }} />)}
          <col style={{ width: widths.add }} />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b border-border">
            <th
              className="sticky-col border-r border-border/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              style={{ left: 0 }}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleAll(!allSelected)}
                  aria-label={allSelected ? "Deselect all" : "Select all"}
                  aria-pressed={allSelected}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                    allSelected
                      ? "border-primary bg-primary"
                      : selected.size > 0
                      ? "border-primary bg-primary/30"
                      : "border-border opacity-40 hover:opacity-100 hover:border-primary"
                  }`}
                >
                  {allSelected && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                  {!allSelected && selected.size > 0 && <span className="h-0.5 w-2 rounded-full bg-primary-foreground" />}
                </button>
                <ResizableThInner colKey="title" widths={widths} setWidths={setWidths}>Title</ResizableThInner>
              </div>
            </th>
            {showStatus && <ResizableTh colKey="status" widths={widths} setWidths={setWidths}>Status</ResizableTh>}
            {showPriority && <ResizableTh colKey="priority" widths={widths} setWidths={setWidths}>Priority</ResizableTh>}
            {showDue && <ResizableTh colKey="due" widths={widths} setWidths={setWidths}>Due</ResizableTh>}
            {showAssignees && <ResizableTh colKey="assignees" widths={widths} setWidths={setWidths}>Assignees</ResizableTh>}
            {showTags && <ResizableTh colKey="tags" widths={widths} setWidths={setWidths}>Tags</ResizableTh>}
            {showEstimate && <ResizableTh colKey="estimate" widths={widths} setWidths={setWidths}>Est. (h)</ResizableTh>}
            {showLogged && <ResizableTh colKey="logged" widths={widths} setWidths={setWidths}>Logged (h)</ResizableTh>}
            {visibleFields.map((f) => (
              <ResizableTh key={f.id} colKey={`f:${f.id}`} widths={widths} setWidths={setWidths}>
                {f.name}
              </ResizableTh>
            ))}
            <th className="px-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(["text", "number", "date", "select", "checkbox", "url", "email"] as FieldType[]).map((t) => (
                    <DropdownMenuItem key={t} onClick={() => addField(t)}>
                      {t}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </th>
          </tr>
        </thead>

        <tbody>
          {useTree ? (
            flat.map((node) => {
              const t = node.task;
              const hasChildren = node.children.length > 0;
              return (
                <TaskRow
                  key={t.id}
                  task={t}
                  project={project}
                  fields={visibleFields}
                  workflow={workflow}
                  selected={selected.has(t.id)}
                  indicator={getIndicator(t.id)}
                  showStatus={showStatus}
                  showPriority={showPriority}
                  showDue={showDue}
                  showAssignees={showAssignees}
                  showTags={showTags}
                  showEstimate={showEstimate}
                  showLogged={showLogged}
                  loggedHours={timeTotals?.totals.get(t.id)}
                  rowColor={colorForTask(t, viewConfig, statusColorMap)}
                  titleStickyLeft={widths.select}
                  depth={node.depth}
                  hasChildren={hasChildren}
                  isCollapsed={collapsed.has(t.id)}
                  rollup={hasChildren ? rollupFraction(node) : null}
                  rollupPercent={hasChildren ? rollupPercent(node) : null}
                  onToggleCollapse={() => toggleCollapse(t.id)}
                  onToggleSelect={(e) => toggleOne(t.id, { additive: e?.metaKey || e?.ctrlKey, range: e?.shiftKey })}
                  onUpdate={(patch) => update.mutate({ id: t.id, ...patch })}
                  onClickRow={() => onTaskClick(t.id)}
                />
              );
            })
          ) : (
            Array.from(groups.entries()).map(([key, list]) => (
              <>
                {groupBy && (
                  <tr key={`g-${key}`}>
                    <td colSpan={visibleColCount} className="bg-muted/30 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {groupBy === "status"
                        ? STATUS_OPTIONS.find((s) => s.value === key)?.label ?? key
                        : key === "__none__" ? "Empty" : key} · {list.length}
                    </td>
                  </tr>
                )}
                {list.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    project={project}
                    fields={visibleFields}
                    workflow={workflow}
                    selected={selected.has(t.id)}
                    indicator={getIndicator(t.id)}
                    showStatus={showStatus}
                    showPriority={showPriority}
                    showDue={showDue}
                    showAssignees={showAssignees}
                    showTags={showTags}
                    showEstimate={showEstimate}
                    showLogged={showLogged}
                    loggedHours={timeTotals?.totals.get(t.id)}
                    rowColor={colorForTask(t, viewConfig, statusColorMap)}
                    titleStickyLeft={widths.select}
                    onToggleSelect={(e) => toggleOne(t.id, { additive: e?.metaKey || e?.ctrlKey, range: e?.shiftKey })}
                    onUpdate={(patch) => update.mutate({ id: t.id, ...patch })}
                    onClickRow={() => onTaskClick(t.id)}
                  />
                ))}
              </>
            ))
          )}

          {/* Add row */}
          <tr className="border-b border-border">
            <td className="sticky-col border-r border-border/60 px-3 py-1.5" style={{ left: 0 }}>
              {adding ? (
                <Input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onBlur={() => handleAdd()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") { setAdding(false); setNewTitle(""); }
                  }}
                  placeholder="Task title…"
                  className="h-7 text-sm"
                />
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> New task
                </button>
              )}
            </td>
            <td colSpan={visibleColCount - 1} />
          </tr>
        </tbody>
      </table>
      <BulkActionBar projectId={projectId} selected={selected} onClear={() => setSelected(new Set())} />
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground ${className}`}>
      {children}
    </th>
  );
}

function ResizableTh({
  colKey,
  widths,
  setWidths,
  children,
}: {
  colKey: string;
  widths: Record<string, number>;
  setWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  children: React.ReactNode;
}) {
  return (
    <th className="relative px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <ResizableThInner colKey={colKey} widths={widths} setWidths={setWidths}>{children}</ResizableThInner>
    </th>
  );
}

function ResizableThInner({
  colKey,
  widths,
  setWidths,
  children,
}: {
  colKey: string;
  widths: Record<string, number>;
  setWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  children: React.ReactNode;
}) {
  const startRef = useRef<{ x: number; w: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, w: widths[colKey] ?? 160 };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    const delta = e.clientX - startRef.current.x;
    const next = Math.max(60, startRef.current.w + delta);
    setWidths((w) => ({ ...w, [colKey]: next }));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    startRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  return (
    <>
      <div className="truncate pr-2">{children}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-primary/40"
      />
    </>
  );
}

function TaskRow({
  task,
  project,
  fields,
  workflow,
  selected,
  indicator,
  showStatus = true,
  showPriority = true,
  showDue = true,
  showAssignees = false,
  showTags = false,
  showEstimate = false,
  showLogged = false,
  loggedHours,
  rowColor = null,
  titleStickyLeft = 40,
  depth = 0,
  hasChildren = false,
  isCollapsed = false,
  rollup = null,
  rollupPercent: rollupPct = null,
  onToggleCollapse,
  onToggleSelect,
  onUpdate,
  onClickRow,
}: {
  task: Task;
  project?: Project | null;
  fields: CustomFieldDef[];
  workflow: WorkflowStatus[];
  selected: boolean;
  indicator?: { blockedBy: number; blocking: number };
  showStatus?: boolean;
  showPriority?: boolean;
  showDue?: boolean;
  showAssignees?: boolean;
  showTags?: boolean;
  showEstimate?: boolean;
  showLogged?: boolean;
  loggedHours?: number;
  rowColor?: string | null;
  titleStickyLeft?: number;
  depth?: number;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  rollup?: { done: number; total: number } | null;
  rollupPercent?: number | null;
  onToggleCollapse?: () => void;
  onToggleSelect: (e?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean }) => void;
  onUpdate: (patch: Partial<Task>) => void;
  onClickRow: () => void;
}) {
  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  const STATUS_OPTIONS = workflow.map((s) => ({ value: s.id, label: s.name, color: s.color }));
  const status = STATUS_OPTIONS.find((s) => s.value === task.status);
  const priority = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
  const isBlocked = (indicator?.blockedBy ?? 0) > 0;
  const isBlocking = (indicator?.blocking ?? 0) > 0;

  const typeMeta = getTaskTypeMeta(task.task_type);
  // Indent based on actual tree depth (not task type), so top-level rows sit flush left.
  const indent = depth * 16;
  // Type color takes precedence over rule-based row color so hierarchy is always visible.
  const borderColor = typeMeta.color;
  const borderWidth =
    typeMeta.type === "initiative" ? 4 :
    typeMeta.type === "epic" ? 3 :
    typeMeta.type === "subtask" ? 1 : 2;
  const rowMinH = typeMeta.rowHeight;
  const isInitiative = typeMeta.type === "initiative";
  const isSubtask = typeMeta.type === "subtask";

  return (
    <tr
      className={`group border-b border-border transition-colors ${
        selected
          ? "bg-primary/10 [&_.sticky-col]:!bg-primary/10 hover:bg-primary/15 [&:hover_.sticky-col]:!bg-primary/15"
          : "hover:bg-accent/30 [&:hover_.sticky-col]:bg-accent/30"
      } ${isInitiative ? "font-semibold" : ""}`}
      style={{
        borderLeft: `${borderWidth}px solid ${borderColor}`,
        height: rowMinH,
        background: !selected && rowColor ? `color-mix(in oklab, ${rowColor} 6%, transparent)` : undefined,
        boxShadow: selected ? `inset 3px 0 0 0 hsl(var(--primary))` : undefined,
      }}
    >
      <td className="sticky-col border-r border-border/60 px-3 py-1.5" style={{ left: 0 }}>
        {titleEdit !== null ? (
          <Input
            autoFocus
            value={titleEdit}
            onChange={(e) => setTitleEdit(e.target.value)}
            onBlur={() => {
              if (titleEdit && titleEdit !== task.title) onUpdate({ title: titleEdit });
              setTitleEdit(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (titleEdit && titleEdit !== task.title) onUpdate({ title: titleEdit });
                setTitleEdit(null);
              }
              if (e.key === "Escape") setTitleEdit(null);
            }}
            className="h-7 text-sm"
          />
        ) : (
          <div className="flex flex-col gap-0.5" style={{ paddingLeft: indent }}>
            <div className="flex items-center gap-1.5">
              {/* Selection handle (replaces checkbox column) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect({ metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey });
                }}
                aria-label={selected ? "Deselect row" : "Select row (shift-click for range, ⌘/ctrl-click to add)"}
                aria-pressed={selected}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                  selected
                    ? "border-primary bg-primary"
                    : "border-border/70 opacity-0 group-hover:opacity-100 hover:border-primary hover:bg-primary/10"
                }`}
              >
                {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
              </button>
              {/* Expand/collapse chevron */}
              {hasChildren ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleCollapse?.(); }}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={isCollapsed ? "Expand" : "Collapse"}
                >
                  <ChevronRightIcon
                    className="h-3.5 w-3.5 transition-transform"
                    style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)" }}
                  />
                </button>
              ) : (
                <span className="inline-block h-4 w-4 shrink-0" />
              )}
              {/* Type icon — click to change */}
              <TaskTypeChip
                value={task.task_type}
                onChange={(next) => onUpdate({ task_type: next } as Partial<Task>)}
                iconOnly
                size={14}
                hasChildren={(task.child_count ?? 0) > 0}
              />
              {isBlocked && (
                <ArrowLeftCircle
                  className="h-3.5 w-3.5 shrink-0 text-destructive"
                  aria-label={`Blocked by ${indicator?.blockedBy} task(s)`}
                />
              )}
              {isBlocking && (
                <ArrowRightCircle
                  className="h-3.5 w-3.5 shrink-0 text-primary"
                  aria-label={`Blocking ${indicator?.blocking} task(s)`}
                />
              )}
              <button
                onClick={onClickRow}
                className={`flex-1 truncate text-left hover:text-aura-gradient ${isSubtask && task.status === "done" ? "line-through text-muted-foreground" : ""}`}
              >
                {task.title}
              </button>
              {hasChildren && rollup && rollup.total > 0 && (
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {rollup.done}/{rollup.total}
                </span>
              )}
              <TaskRefBadge
                task={task}
                project={project}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              />
              <button
                onClick={(e) => { e.stopPropagation(); setTitleEdit(task.title); }}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Rename"
              >
                <span className="text-xs text-muted-foreground">edit</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onClickRow(); }}
                className="rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                aria-label="Open task details"
                title="Open task"
              >
                <Maximize2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            {/* Roll-up progress bar (parents only) */}
            {hasChildren && rollupPct !== null && (
              <div className="ml-[22px] mr-2 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${rollupPct}%`, background: typeMeta.color }}
                />
              </div>
            )}
          </div>
        )}
      </td>
      {showStatus && (
        <td className="px-2 py-1.5">
          <OptionCell
            value={(task as Task & { workflow_status_id?: string }).workflow_status_id ?? STATUS_OPTIONS.find((s) => s.label.toLowerCase() === String(task.status ?? "").toLowerCase())?.value ?? ""}
            options={STATUS_OPTIONS}
            onChange={(v) => onUpdate({ status: v, workflow_status_id: v } as Partial<Task>)}
            placeholder="Set status"
            ariaLabel="Status"
            variant="pill"
          />
        </td>
      )}
      {showPriority && (
        <td className="px-2 py-1.5">
          <OptionCell
            value={task.priority}
            options={PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label, color: p.color }))}
            onChange={(v) => onUpdate({ priority: v as Task["priority"] })}
            placeholder="Set priority"
            ariaLabel="Priority"
            variant="pill"
          />
        </td>
      )}
      {showDue && (
        <td className="px-3 py-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-7 w-full items-center rounded px-2 text-left text-xs hover:bg-accent">
                {task.due_date ? format(parseISO(task.due_date), "MMM d, yyyy") : <span className="text-muted-foreground">Set date</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={task.due_date ? parseISO(task.due_date) : undefined}
                onSelect={(d) => onUpdate({ due_date: d ? format(d, "yyyy-MM-dd") : null })}
              />
              {task.due_date && (
                <div className="border-t border-border p-2">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => onUpdate({ due_date: null })}>
                    Clear
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </td>
      )}
      {showAssignees && (
        <td className="px-3 py-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-7 w-full items-center rounded px-2 text-left hover:bg-accent">
                {task.assignee_ids.length > 0 ? (
                  <AssigneeAvatars ids={task.assignee_ids} max={3} size={22} />
                ) : (
                  <span className="text-xs text-muted-foreground">Assign…</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
              <AssigneePicker
                value={task.assignee_ids}
                onChange={(next) => onUpdate({ assignee_ids: next })}
                taskId={task.id}
              />
            </PopoverContent>
          </Popover>
        </td>
      )}
      {showTags && (
        <td className="px-3 py-1.5">
          <div className="flex flex-wrap gap-1">
            {task.tags.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
            {task.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-accent/60 px-1.5 py-0.5 text-[10px] text-accent-foreground">
                #{t}
              </span>
            ))}
            {task.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{task.tags.length - 3}</span>}
          </div>
        </td>
      )}
      {showEstimate && (
        <td className="px-2 py-1.5">
          <Input
            type="number"
            min={0}
            step={0.25}
            defaultValue={
              (task as unknown as { estimated_hours?: number | null }).estimated_hours ?? ""
            }
            onBlur={(e) => {
              const raw = e.target.value;
              const next = raw === "" ? null : Number(raw);
              onUpdate({ estimated_hours: next } as never);
            }}
            placeholder="—"
            className="h-7 border-none bg-transparent px-2 text-xs tabular-nums hover:bg-accent"
          />
        </td>
      )}
      {showLogged && (
        <td className="px-3 py-1.5">
          {(() => {
            const est = Number(
              (task as unknown as { estimated_hours?: number | null }).estimated_hours ?? 0,
            );
            const logged = Number(loggedHours ?? 0);
            const over = est > 0 && logged > est;
            return (
              <span
                className={`text-xs tabular-nums ${
                  logged === 0
                    ? "text-muted-foreground"
                    : over
                    ? "font-medium text-destructive"
                    : "text-foreground"
                }`}
                title={est > 0 ? `${logged.toFixed(2)}h / ${est}h estimate` : `${logged.toFixed(2)}h logged`}
              >
                {logged > 0 ? `${logged.toFixed(2)}h` : "—"}
                {est > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">/ {est}h</span>
                )}
              </span>
            );
          })()}
        </td>
      )}
      {fields.map((f) => (
        <td key={f.id} className="px-3 py-1.5">
          <CustomFieldCell
            field={f}
            value={task.custom_values?.[f.id]}
            onChange={(val) =>
              onUpdate({ custom_values: { ...task.custom_values, [f.id]: val } as Record<string, unknown> })
            }
          />
        </td>
      ))}
      <td />
    </tr>
  );
}

function CustomFieldCell({ field, value, onChange }: { field: CustomFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  switch (field.field_type) {
    case "text":
    case "url":
    case "email":
      return (
        <Input
          defaultValue={(value as string) ?? ""}
          onBlur={(e) => onChange(e.target.value || null)}
          className="h-7 border-none bg-transparent text-xs hover:bg-accent"
          type={field.field_type === "email" ? "email" : field.field_type === "url" ? "url" : "text"}
        />
      );
    case "number":
      return (
        <Input
          defaultValue={(value as number) ?? ""}
          onBlur={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          type="number"
          className="h-7 border-none bg-transparent text-xs hover:bg-accent"
        />
      );
    case "checkbox":
      return <Checkbox checked={!!value} onCheckedChange={(c) => onChange(!!c)} />;
    case "date":
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex h-7 w-full items-center rounded px-2 text-left text-xs hover:bg-accent">
              {value ? format(parseISO(String(value)), "MMM d, yyyy") : <span className="text-muted-foreground">—</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={value ? parseISO(String(value)) : undefined}
              onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : null)}
            />
          </PopoverContent>
        </Popover>
      );
    case "select": {
      const opts = field.options ?? [];
      return (
        <Select value={(value as string) ?? ""} onValueChange={onChange}>
          <SelectTrigger className="h-7 border-none bg-transparent text-xs hover:bg-accent"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {opts.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />
                  {o.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "multi_select": {
      const opts = field.options ?? [];
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1">
          {arr.map((id) => {
            const o = opts.find((x) => x.id === id);
            if (!o) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full px-1.5 text-[10px]"
                style={{ backgroundColor: `${o.color}33`, color: o.color }}
              >
                {o.label}
                <button onClick={() => onChange(arr.filter((x) => x !== id))}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })}
          <Select value="" onValueChange={(v) => { if (!arr.includes(v)) onChange([...arr, v]); }}>
            <SelectTrigger className="h-5 w-5 border-none bg-transparent p-0">
              <Plus className="h-3 w-3" />
            </SelectTrigger>
            <SelectContent>
              {opts.filter((o) => !arr.includes(o.id)).map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    case "effort": {
      const v = (value && typeof value === "object" ? value : null) as { amount?: number; unit?: string } | null;
      const amount = v?.amount ?? "";
      const unit = (v?.unit ?? "days") as "hours" | "days" | "points";
      const update = (next: { amount?: number | ""; unit?: string }) => {
        const merged = { amount: next.amount ?? amount, unit: next.unit ?? unit };
        if (merged.amount === "" || merged.amount === null) onChange(null);
        else onChange({ amount: Number(merged.amount), unit: merged.unit });
      };
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min="0"
            step="0.5"
            defaultValue={amount === "" ? "" : String(amount)}
            onBlur={(e) => update({ amount: e.target.value === "" ? "" : Number(e.target.value) })}
            className="h-7 w-16 border-none bg-transparent text-xs hover:bg-accent"
          />
          <Select value={unit} onValueChange={(u) => update({ unit: u })}>
            <SelectTrigger className="h-7 w-[70px] border-none bg-transparent text-[11px] hover:bg-accent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">hrs</SelectItem>
              <SelectItem value="days">days</SelectItem>
              <SelectItem value="points">pts</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }
    default:
      return <span className="text-xs text-muted-foreground">—</span>;
  }
}
