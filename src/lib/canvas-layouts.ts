import type { Task } from "./types";
import { buildTaskTree, type TreeNode } from "./task-tree";
import { getTaskTypeMeta } from "./task-types";
import { STATUS_OPTIONS } from "./types";

export type Pos = { x: number; y: number };
export type Positions = Record<string, Pos>;
export type CanvasLayoutMode = "grid" | "mindmap" | "by_status" | "by_type";

export interface CanvasFrame {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Tailwind / CSS color hint — used for subtle background tint. */
  tint?: string;
}

const CARD_W = 220;
const CARD_H = 120;
const GAP_X = 32;
const GAP_Y = 32;
const COLS = 4;

/** Original grid auto-layout, kept for reference. */
export function gridLayout(tasks: Task[]): Positions {
  const next: Positions = {};
  tasks.forEach((t, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    next[t.id] = { x: 60 + col * (CARD_W + GAP_X), y: 60 + row * (CARD_H + GAP_Y) };
  });
  return next;
}

/**
 * Mind-map / hierarchy layout.
 * - Roots (initiatives / top-level tasks) are placed in a vertical spine on the left.
 * - Each level fans out to the right, with siblings stacked vertically.
 * - Compact spacing so 100+ tasks remain legible.
 */
export function mindmapLayout(tasks: Task[]): Positions {
  const roots = buildTaskTree(tasks);
  const positions: Positions = {};

  const COL_W = 240;
  const ROW_H = 56;
  let cursorY = 60;

  const place = (node: TreeNode, depth: number): number => {
    const x = 60 + depth * COL_W;
    if (node.children.length === 0) {
      const y = cursorY;
      positions[node.task.id] = { x, y };
      cursorY += ROW_H;
      return y;
    }
    const childYs = node.children.map((c) => place(c, depth + 1));
    const y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    positions[node.task.id] = { x, y };
    return y;
  };

  if (roots.length === 0) return gridLayout(tasks);
  roots.forEach((r) => {
    place(r, 0);
    cursorY += ROW_H / 2; // breathing room between trees
  });

  return positions;
}

/**
 * Kanban-on-canvas — columns by status.
 */
export function byStatusLayout(tasks: Task[]): Positions {
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = String(t.status ?? "todo");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const positions: Positions = {};
  let colIdx = 0;
  const ORDER = ["todo", "in_progress", "review", "done", "cancelled"];
  const keys = Array.from(groups.keys()).sort(
    (a, b) => (ORDER.indexOf(a) === -1 ? 99 : ORDER.indexOf(a)) - (ORDER.indexOf(b) === -1 ? 99 : ORDER.indexOf(b)),
  );
  for (const key of keys) {
    const list = groups.get(key)!;
    list.forEach((t, i) => {
      positions[t.id] = {
        x: 60 + colIdx * (CARD_W + GAP_X),
        y: 90 + i * (CARD_H + GAP_Y),
      };
    });
    colIdx++;
  }
  return positions;
}

/**
 * Group by task type — initiative / epic / story / task / subtask / bug columns.
 */
export function byTypeLayout(tasks: Task[]): Positions {
  const ORDER = ["initiative", "epic", "story", "task", "subtask", "bug"];
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = String(t.task_type ?? "task");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const keys = Array.from(groups.keys()).sort(
    (a, b) =>
      (ORDER.indexOf(a) === -1 ? 99 : ORDER.indexOf(a)) -
      (ORDER.indexOf(b) === -1 ? 99 : ORDER.indexOf(b)),
  );
  const positions: Positions = {};
  let colIdx = 0;
  for (const key of keys) {
    groups.get(key)!.forEach((t, i) => {
      positions[t.id] = {
        x: 60 + colIdx * (CARD_W + GAP_X),
        y: 90 + i * (CARD_H + GAP_Y),
      };
    });
    colIdx++;
  }
  return positions;
}

export function applyLayout(mode: CanvasLayoutMode, tasks: Task[]): Positions {
  switch (mode) {
    case "mindmap":
      return mindmapLayout(tasks);
    case "by_status":
      return byStatusLayout(tasks);
    case "by_type":
      return byTypeLayout(tasks);
    default:
      return gridLayout(tasks);
  }
}

/**
 * Compute background "frame" rectangles for grouped layouts so the user can
 * see clusters at a glance. Returns [] for ungrouped layouts.
 *
 * Frames are derived from the current positions, so they stay accurate even
 * after the user nudges individual cards within a group.
 */
export function computeFrames(
  mode: CanvasLayoutMode,
  tasks: Task[],
  positions: Positions,
): CanvasFrame[] {
  if (mode !== "by_status" && mode !== "by_type") return [];

  const groupKey = (t: Task) =>
    mode === "by_status" ? String(t.status ?? "todo") : String(t.task_type ?? "task");

  const labelFor = (key: string) => {
    if (mode === "by_status") {
      const opt = STATUS_OPTIONS.find((o) => o.value === key);
      return opt?.label ?? key;
    }
    return getTaskTypeMeta(key).label;
  };

  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const k = groupKey(t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }

  const frames: CanvasFrame[] = [];
  const PAD = 20;
  const HEADER = 28;

  for (const [key, list] of groups) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let any = false;
    for (const t of list) {
      const p = positions[t.id];
      if (!p) continue;
      any = true;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + CARD_W);
      maxY = Math.max(maxY, p.y + CARD_H);
    }
    if (!any) continue;
    frames.push({
      id: `frame-${mode}-${key}`,
      label: labelFor(key),
      x: minX - PAD,
      y: minY - PAD - HEADER,
      w: maxX - minX + PAD * 2,
      h: maxY - minY + PAD * 2 + HEADER,
    });
  }
  return frames;
}
