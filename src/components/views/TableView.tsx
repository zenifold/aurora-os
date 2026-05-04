import { useEffect, useRef, useState } from "react";
import type { CustomFieldDef, Task } from "@/lib/types";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/types";
import { useCreateTask, useUpdateTask, useDeleteTask, useBulkUpdateTasks } from "@/hooks/use-tasks";
import { useProjectRelationIndicators } from "@/hooks/use-task-relations";
import { groupTasks } from "@/lib/filtering";
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
import { Plus, Trash2, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateCustomField } from "@/hooks/use-custom-fields";
import type { FieldType } from "@/lib/types";

interface Props {
  projectId: string;
  tasks: Task[];
  fields: CustomFieldDef[];
  groupBy: string | null;
  onTaskClick: (id: string) => void;
}

export function TableView({ projectId, tasks, fields, groupBy, onTaskClick }: Props) {
  const create = useCreateTask(projectId);
  const update = useUpdateTask(projectId);
  const remove = useDeleteTask(projectId);
  const bulk = useBulkUpdateTasks(projectId);
  const createField = useCreateCustomField();

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
  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const addField = async (type: FieldType) => {
    const name = prompt(`New ${type} field name:`);
    if (!name) return;
    const opts = type === "select" || type === "multi_select"
      ? [{ id: "o1", label: "Option 1", color: "#8b5cf6" }, { id: "o2", label: "Option 2", color: "#ec4899" }]
      : undefined;
    await createField.mutateAsync({ name, field_type: type, options: opts });
  };

  return (
    <div className="min-w-max">
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-aura-gradient-subtle px-4 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex-1" />
          <Select onValueChange={(v) => bulk.mutate({ ids: Array.from(selected), patch: { status: v } })}>
            <SelectTrigger className="h-7 w-32"><SelectValue placeholder="Set status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => {
              if (confirm(`Delete ${selected.size} tasks?`)) {
                Array.from(selected).forEach((id) => remove.mutate(id));
                setSelected(new Set());
              }
            }}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(new Set())}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <table className="border-collapse text-sm" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
        <colgroup>
          <col style={{ width: widths.select }} />
          <col style={{ width: widths.title }} />
          <col style={{ width: widths.status }} />
          <col style={{ width: widths.priority }} />
          <col style={{ width: widths.due }} />
          {fields.map((f) => <col key={f.id} style={{ width: widths[`f:${f.id}`] ?? 160 }} />)}
          <col style={{ width: widths.add }} />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b border-border">
            <th className="px-3 py-2">
              <Checkbox
                checked={tasks.length > 0 && selected.size === tasks.length}
                onCheckedChange={(c) => toggleAll(!!c)}
              />
            </th>
            <ResizableTh colKey="title" widths={widths} setWidths={setWidths}>Title</ResizableTh>
            <ResizableTh colKey="status" widths={widths} setWidths={setWidths}>Status</ResizableTh>
            <ResizableTh colKey="priority" widths={widths} setWidths={setWidths}>Priority</ResizableTh>
            <ResizableTh colKey="due" widths={widths} setWidths={setWidths}>Due</ResizableTh>
            {fields.map((f) => (
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
          {Array.from(groups.entries()).map(([key, list]) => (
            <>
              {groupBy && (
                <tr key={`g-${key}`}>
                  <td colSpan={5 + fields.length + 1} className="bg-muted/30 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                  fields={fields}
                  selected={selected.has(t.id)}
                  onToggleSelect={(c) => toggleOne(t.id, c)}
                  onUpdate={(patch) => update.mutate({ id: t.id, ...patch })}
                  onClickRow={() => onTaskClick(t.id)}
                  onDelete={() => remove.mutate(t.id)}
                />
              ))}
            </>
          ))}

          {/* Add row */}
          <tr className="border-b border-border">
            <td />
            <td className="px-3 py-1.5">
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
            <td colSpan={3 + fields.length + 1} />
          </tr>
        </tbody>
      </table>
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
    <th className="relative px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
    </th>
  );
}

function TaskRow({
  task,
  fields,
  selected,
  onToggleSelect,
  onUpdate,
  onClickRow,
  onDelete,
}: {
  task: Task;
  fields: CustomFieldDef[];
  selected: boolean;
  onToggleSelect: (c: boolean) => void;
  onUpdate: (patch: Partial<Task>) => void;
  onClickRow: () => void;
  onDelete: () => void;
}) {
  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  const status = STATUS_OPTIONS.find((s) => s.value === task.status);
  const priority = PRIORITY_OPTIONS.find((p) => p.value === task.priority);

  return (
    <tr className="group border-b border-border hover:bg-accent/30">
      <td className="px-3 py-1.5">
        <Checkbox checked={selected} onCheckedChange={(c) => onToggleSelect(!!c)} />
      </td>
      <td className="px-3 py-1.5">
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
          <div className="flex items-center gap-2">
            <button onClick={onClickRow} className="flex-1 truncate text-left hover:text-aura-gradient">
              {task.title}
            </button>
            <button
              onClick={() => setTitleEdit(task.title)}
              className="opacity-0 transition-opacity group-hover:opacity-100"
            >
              <span className="text-xs text-muted-foreground">edit</span>
            </button>
            <button
              onClick={onDelete}
              className="opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        )}
      </td>
      <td className="px-3 py-1.5">
        <Select value={task.status} onValueChange={(v) => onUpdate({ status: v })}>
          <SelectTrigger className="h-7 border-none bg-transparent px-2 hover:bg-accent">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status?.color }} />
              <span className="text-xs">{status?.label ?? task.status}</span>
            </span>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-1.5">
        <Select value={task.priority} onValueChange={(v) => onUpdate({ priority: v as Task["priority"] })}>
          <SelectTrigger className="h-7 border-none bg-transparent px-2 hover:bg-accent">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: priority?.color }} />
              <span className="text-xs">{priority?.label}</span>
            </span>
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
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
    default:
      return <span className="text-xs text-muted-foreground">—</span>;
  }
}
