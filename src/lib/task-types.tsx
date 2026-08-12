import { Target, Zap, Square, ChevronRight, Flag } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TaskType = "initiative" | "epic" | "task" | "subtask" | "milestone";

export const TASK_TYPES: TaskType[] = ["initiative", "epic", "milestone", "task", "subtask"];

export interface TaskTypeMeta {
  type: TaskType;
  label: string;
  icon: LucideIcon;
  color: string;
  tint: string;
  indent: number;
  rowHeight: number;
  canvasW: number;
  canvasH: number;
  barHeight: number;
  description?: string;
}

export const TASK_TYPE_META: Record<TaskType, TaskTypeMeta> = {
  initiative: {
    type: "initiative",
    label: "Initiative",
    icon: Target,
    color: "oklch(0.55 0.18 274)",
    tint: "color-mix(in oklab, oklch(0.55 0.18 274) 14%, transparent)",
    indent: 0,
    rowHeight: 56,
    canvasW: 320,
    canvasH: 180,
    barHeight: 32,
    description: "A multi-quarter goal. Top of the tree.",
  },
  epic: {
    type: "epic",
    label: "Epic",
    icon: Zap,
    color: "oklch(0.6 0.2 296)",
    tint: "color-mix(in oklab, oklch(0.6 0.2 296) 14%, transparent)",
    indent: 24,
    rowHeight: 48,
    canvasW: 280,
    canvasH: 140,
    barHeight: 26,
    description: "A meaningful chunk of work inside an initiative.",
  },
  milestone: {
    type: "milestone",
    label: "Milestone",
    icon: Flag,
    color: "oklch(0.68 0.17 55)",
    tint: "color-mix(in oklab, oklch(0.68 0.17 55) 16%, transparent)",
    indent: 24,
    rowHeight: 44,
    canvasW: 260,
    canvasH: 110,
    barHeight: 24,
    description: "A checkpoint. Nest tasks (or other milestones) underneath to track % done.",
  },
  task: {
    type: "task",
    label: "Task",
    icon: Square,
    color: "oklch(0.55 0.04 250)",
    tint: "color-mix(in oklab, oklch(0.55 0.04 250) 14%, transparent)",
    indent: 48,
    rowHeight: 44,
    canvasW: 240,
    canvasH: 120,
    barHeight: 22,
    description: "A unit of work somebody can finish.",
  },
  subtask: {
    type: "subtask",
    label: "Subtask",
    icon: ChevronRight,
    color: "oklch(0.65 0.02 250)",
    tint: "color-mix(in oklab, oklch(0.65 0.02 250) 12%, transparent)",
    indent: 72,
    rowHeight: 36,
    canvasW: 200,
    canvasH: 56,
    barHeight: 16,
    description: "A step inside a task.",
  },
};

/** Allowed parent type for a given child type. null = may live at the top level. */
export const PARENT_OF: Record<TaskType, TaskType | null> = {
  initiative: null,
  epic: "initiative",
  milestone: null,
  task: null,
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
