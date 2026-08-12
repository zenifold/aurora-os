import { useMemo, useState } from "react";
import { confirmDialog } from "@/lib/dialogs";
import {
  useSubtasks,
  useCreateSubtask,
  useToggleSubtask,
  useUpdateSubtask,
  useReparentSubtask,
  useReorderSubtask,
  useDeleteSubtask,
} from "@/hooks/use-subtasks";
import type { Task } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CornerDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TreeNode {
  task: Task;
  children: TreeNode[];
}

function buildTree(tasks: Task[], rootId: string): TreeNode[] {
  const byParent = new Map<string, Task[]>();
  for (const t of tasks) {
    const k = t.parent_task_id ?? "";
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(t);
  }
  const make = (t: Task): TreeNode => ({
    task: t,
    children: (byParent.get(t.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map(make),
  });
  return (byParent.get(rootId) ?? [])
    .sort((a, b) => a.position - b.position)
    .map(make);
}

export function SubtasksList({ parent }: { parent: Task }) {
  const { data: descendants = [], isLoading } = useSubtasks(parent.id);
  const create = useCreateSubtask(parent);
  const toggle = useToggleSubtask(parent.id);
  const update = useUpdateSubtask(parent.id);
  const reparent = useReparentSubtask(parent.id);
  const reorder = useReorderSubtask(parent.id);
  const remove = useDeleteSubtask(parent.id);

  const tree = useMemo(() => buildTree(descendants, parent.id), [descendants, parent.id]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const flatCount = descendants.length;
  const doneCount = descendants.filter((t) => t.status === "done").length;

  const toggleCollapse = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submitRoot = () => {
    if (newTitle.trim()) create.mutate(newTitle.trim());
    setNewTitle("");
    setAdding(false);
  };

  // Sibling lookup helpers
  const siblingsOf = (taskId: string): Task[] => {
    const t = descendants.find((x) => x.id === taskId);
    if (!t) return [];
    const pid = t.parent_task_id ?? parent.id;
    return descendants
      .filter((x) => (x.parent_task_id ?? parent.id) === pid)
      .sort((a, b) => a.position - b.position);
  };

  const indent = (taskId: string) => {
    const sibs = siblingsOf(taskId);
    const idx = sibs.findIndex((x) => x.id === taskId);
    if (idx <= 0) return; // need a previous sibling
    const newParent = sibs[idx - 1];
    reparent.mutate({ id: taskId, new_parent_id: newParent.id });
  };

  const outdent = (taskId: string) => {
    const t = descendants.find((x) => x.id === taskId);
    if (!t || !t.parent_task_id || t.parent_task_id === parent.id) return;
    const grandparent = descendants.find((x) => x.id === t.parent_task_id);
    const newParentId = grandparent?.parent_task_id ?? parent.id;
    reparent.mutate({ id: taskId, new_parent_id: newParentId });
  };

  const moveUp = (taskId: string) => {
    const sibs = siblingsOf(taskId);
    const idx = sibs.findIndex((x) => x.id === taskId);
    if (idx <= 0) return;
    const prev = sibs[idx - 1];
    const before = sibs[idx - 2];
    const newPos = before ? (before.position + prev.position) / 2 : prev.position - 1000;
    reorder.mutate({ id: taskId, position: newPos });
  };

  const moveDown = (taskId: string) => {
    const sibs = siblingsOf(taskId);
    const idx = sibs.findIndex((x) => x.id === taskId);
    if (idx < 0 || idx >= sibs.length - 1) return;
    const next = sibs[idx + 1];
    const after = sibs[idx + 2];
    const newPos = after ? (next.position + after.position) / 2 : next.position + 1000;
    reorder.mutate({ id: taskId, position: newPos });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {flatCount > 0
            ? `${doneCount} of ${flatCount} complete · click ▸ to expand`
            : "No subtasks yet"}
        </span>
        <Button variant="ghost" size="sm" className="h-7" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add subtask
        </Button>
      </div>

      {adding && (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRoot();
              if (e.key === "Escape") {
                setAdding(false);
                setNewTitle("");
              }
            }}
            placeholder="Subtask title…"
            className="h-8"
          />
          <Button size="sm" onClick={submitRoot}>
            Add
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tree.length === 0 && !adding ? null : (
        <ul className="space-y-0.5">
          {tree.map((node) => (
            <SubtaskRow
              key={node.task.id}
              node={node}
              depth={0}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
              onToggleDone={(id, done) => toggle.mutate({ id, done })}
              onRename={(id, title) => update.mutate({ id, title })}
              onAddChild={(parentId, title) =>
                create.mutate({ title, parent_task_id: parentId })
              }
              onIndent={indent}
              onOutdent={outdent}
              onMoveUp={moveUp}
              onMoveDown={moveDown}
              onDelete={async (id) => {
                const ok = await confirmDialog({
                  title: "Delete subtask?",
                  description: "All nested subtasks under it will also be deleted.",
                  confirmLabel: "Delete",
                  tone: "destructive",
                });
                if (ok) remove.mutate(id);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SubtaskRow({
  node,
  depth,
  collapsed,
  onToggleCollapse,
  onToggleDone,
  onRename,
  onAddChild,
  onIndent,
  onOutdent,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  onToggleDone: (id: string, done: boolean) => void;
  onRename: (id: string, title: string) => void;
  onAddChild: (parentId: string, title: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { task, children } = node;
  const hasChildren = children.length > 0;
  const isCollapsed = collapsed.has(task.id);
  const isDone = task.status === "done";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [addingChild, setAddingChild] = useState(false);
  const [childDraft, setChildDraft] = useState("");

  const childDone = task.completed_child_count ?? 0;
  const childTotal = task.child_count ?? children.length;

  return (
    <li>
      <div
        className="group flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 16 + 6}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleCollapse(task.id)}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="inline-block h-4 w-4 shrink-0" />
        )}

        <Checkbox
          checked={isDone}
          onCheckedChange={(c) => onToggleDone(task.id, !!c)}
          className="shrink-0"
        />

        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft.trim() && draft !== task.title) onRename(task.id, draft.trim());
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (draft.trim() && draft !== task.title) onRename(task.id, draft.trim());
                setEditing(false);
              }
              if (e.key === "Escape") {
                setDraft(task.title);
                setEditing(false);
              }
            }}
            className="h-6 flex-1 text-sm"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditing(true)}
            onClick={() => setEditing(true)}
            className={cn(
              "flex-1 truncate text-left text-sm",
              isDone && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </button>
        )}

        {hasChildren && childTotal > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {childDone}/{childTotal}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <IconBtn label="Add subtask" onClick={() => setAddingChild(true)}>
            <CornerDownRight className="h-3 w-3" />
          </IconBtn>
          <IconBtn label="Move up" onClick={() => onMoveUp(task.id)}>
            <ArrowUp className="h-3 w-3" />
          </IconBtn>
          <IconBtn label="Move down" onClick={() => onMoveDown(task.id)}>
            <ArrowDown className="h-3 w-3" />
          </IconBtn>
          <IconBtn label="Outdent" onClick={() => onOutdent(task.id)}>
            <ArrowLeft className="h-3 w-3" />
          </IconBtn>
          <IconBtn label="Indent" onClick={() => onIndent(task.id)}>
            <ArrowRight className="h-3 w-3" />
          </IconBtn>
          <IconBtn label="Delete" onClick={() => onDelete(task.id)} danger>
            <Trash2 className="h-3 w-3" />
          </IconBtn>
        </div>
      </div>

      {addingChild && (
        <div
          className="flex gap-1.5 py-1"
          style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
        >
          <Input
            autoFocus
            value={childDraft}
            onChange={(e) => setChildDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (childDraft.trim()) {
                  onAddChild(task.id, childDraft.trim());
                }
                setChildDraft("");
                setAddingChild(false);
              }
              if (e.key === "Escape") {
                setChildDraft("");
                setAddingChild(false);
              }
            }}
            onBlur={() => {
              if (childDraft.trim()) onAddChild(task.id, childDraft.trim());
              setChildDraft("");
              setAddingChild(false);
            }}
            placeholder="Nested subtask…"
            className="h-7 text-sm"
          />
        </div>
      )}

      {hasChildren && !isCollapsed && (
        <ul className="space-y-0.5">
          {children.map((c) => (
            <SubtaskRow
              key={c.task.id}
              node={c}
              depth={depth + 1}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              onToggleDone={onToggleDone}
              onRename={onRename}
              onAddChild={onAddChild}
              onIndent={onIndent}
              onOutdent={onOutdent}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent",
        danger ? "hover:text-destructive" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
