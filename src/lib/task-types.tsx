import { Target, Zap, Square, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TaskType = "initiative" | "epic" | "task" | "subtask";

export const TASK_TYPES: TaskType[] = ["initiative", "epic", "task", "subtask"];

export interface TaskTypeMeta {
  type: TaskType;
  label: string;
  icon: LucideIcon;
  /** oklch color used for borders/icons/fills */
  color: string;
  /** soft tint for backgrounds (oklab mix) */
  tint: string;
  /** indent in pixels per level in tree views */
  indent: number;
  /** table row height in px */
  rowHeight: number;
  /** canvas node size */
  canvasW: number;
  canvasH: number;
  /** timeline bar height */
  barHeight: number;
}

export const TASK_TYPE_META: Record<TaskType, TaskTypeMeta> = {
  initiative: {
    type: "initiative",
    label: "Initiative",
    icon: Target,
    color: "oklch(0.55 0.18 274)", // indigo-600
    tint: "color-mix(in oklab, oklch(0.55 0.18 274) 14%, transparent)",
    indent: 0,
    rowHeight: 56,
    canvasW: 320,
    canvasH: 180,
    barHeight: 32,
  },
  epic: {
    type: "epic",
    label: "Epic",
    icon: Zap,
    color: "oklch(0.6 0.2 296)", // violet-500
    tint: "color-mix(in oklab, oklch(0.6 0.2 296) 14%, transparent)",
    indent: 24,
    rowHeight: 48,
    canvasW: 280,
    canvasH: 140,
    barHeight: 26,
  },
  task: {
    type: "task",
    label: "Task",
    icon: Square,
    color: "oklch(0.55 0.04 250)", // slate-500
    tint: "color-mix(in oklab, oklch(0.55 0.04 250) 14%, transparent)",
    indent: 48,
    rowHeight: 44,
    canvasW: 240,
    canvasH: 120,
    barHeight: 22,
  },
  subtask: {
    type: "subtask",
    label: "Subtask",
    icon: ChevronRight,
    color: "oklch(0.65 0.02 250)", // gray-400
    tint: "color-mix(in oklab, oklch(0.65 0.02 250) 12%, transparent)",
    indent: 72,
    rowHeight: 36,
    canvasW: 200,
    canvasH: 56,
    barHeight: 16,
  },
};

/** Allowed parent type for a given child type. null = top-level only. */
export const PARENT_OF: Record<TaskType, TaskType | null> = {
  initiative: null,
  epic: "initiative",
  task: "epic",
  subtask: "task",
};

export function getTaskTypeMeta(type: string | null | undefined): TaskTypeMeta {
  return TASK_TYPE_META[(type ?? "task") as TaskType] ?? TASK_TYPE_META.task;
}

/** Inline icon + label badge. */
export function TypeBadge({
  type,
  showLabel = false,
  size = 14,
}: {
  type: string | null | undefined;
  showLabel?: boolean;
  size?: number;
}) {
  const meta = getTaskTypeMeta(type);
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color: meta.color, background: showLabel ? meta.tint : "transparent" }}
      title={meta.label}
    >
      <Icon style={{ width: size, height: size }} />
      {showLabel && meta.label}
    </span>
  );
}
