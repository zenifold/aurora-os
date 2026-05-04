import type { Task } from "./types";
import { getTaskTypeMeta, type TaskType } from "./task-types";

export interface TreeNode {
  task: Task;
  depth: number; // 0 root, 1 child, etc.
  type: TaskType;
  children: TreeNode[];
}

/** Build parent->children index and return root nodes (no parent or parent not in list). */
export function buildTaskTree(tasks: Task[]): TreeNode[] {
  const byParent = new Map<string | null, Task[]>();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const t of tasks) {
    const key = t.parent_task_id && byId.has(t.parent_task_id) ? t.parent_task_id : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  }

  const make = (t: Task, depth: number): TreeNode => ({
    task: t,
    depth,
    type: (t.task_type ?? "task") as TaskType,
    children: (byParent.get(t.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((c) => make(c, depth + 1)),
  });

  return (byParent.get(null) ?? [])
    .sort((a, b) => a.position - b.position)
    .map((t) => make(t, 0));
}

/** Flatten the tree honouring per-id collapsed state. */
export function flattenTree(
  nodes: TreeNode[],
  collapsed: Set<string>,
): TreeNode[] {
  const out: TreeNode[] = [];
  const visit = (n: TreeNode) => {
    out.push(n);
    if (!collapsed.has(n.task.id)) {
      for (const c of n.children) visit(c);
    }
  };
  for (const n of nodes) visit(n);
  return out;
}

export function rollupFraction(node: TreeNode): { done: number; total: number } {
  // prefer DB-maintained counts when present
  const t = node.task;
  if (typeof t.child_count === "number" && t.child_count > 0) {
    return { done: t.completed_child_count ?? 0, total: t.child_count };
  }
  // fallback: count direct children from tree
  if (node.children.length === 0) return { done: 0, total: 0 };
  const done = node.children.filter((c) => c.task.status === "done").length;
  return { done, total: node.children.length };
}

export function rollupPercent(node: TreeNode): number | null {
  const t = node.task;
  if (typeof t.rollup_progress === "number") return t.rollup_progress;
  const { done, total } = rollupFraction(node);
  if (total === 0) return null;
  return Math.round((done / total) * 100);
}

export function metaFor(type: string | null | undefined) {
  return getTaskTypeMeta(type);
}
