import type { Task } from "@/lib/types";
import type { Milestone } from "@/lib/milestone-types";

const STATUS_COLORS: Record<string, string> = {
  upcoming: "#94a3b8",
  at_risk: "#f59e0b",
  completed: "#22c55e",
  missed: "#ef4444",
  cancelled: "#9ca3af",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "#94a3b8",
  in_progress: "#3b82f6",
  review: "#eab308",
  done: "#22c55e",
  cancelled: "#ef4444",
};

const COL_WIDTH = 260;
const COL_GAP = 40;
const HEADER_H = 90;
const CHIP_H = 64;
const CHIP_GAP = 12;
const TOP = 80;

const MATCH_WINDOW_DAYS = 14;

interface Skeleton {
  type: "rectangle" | "text" | "arrow";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: "solid" | "hachure";
  strokeWidth?: number;
  roughness?: number;
  roundness?: { type: 3 } | null;
  customData?: Record<string, unknown>;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function dayDiff(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.abs(da - db) / (1000 * 60 * 60 * 24);
}

/**
 * Generate Excalidraw skeleton elements organising a project's tasks under
 * its milestones. Each milestone becomes a column header; tasks whose
 * due_date falls within ±MATCH_WINDOW_DAYS of the milestone target date are
 * placed beneath it as live task chips. Remaining tasks land under
 * "Unscheduled".
 */
export function buildMilestoneCanvasSkeleton(
  milestones: Milestone[],
  tasks: Task[],
): Skeleton[] {
  const sortedMs = [...milestones].sort(
    (a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime(),
  );

  const used = new Set<string>();
  const buckets: { key: string; title: string; subtitle: string; color: string; tasks: Task[] }[] = [];

  for (const m of sortedMs) {
    const bucketTasks: Task[] = [];
    for (const t of tasks) {
      if (used.has(t.id)) continue;
      if (!t.due_date) continue;
      if (dayDiff(t.due_date, m.target_date) <= MATCH_WINDOW_DAYS) {
        bucketTasks.push(t);
        used.add(t.id);
      }
    }
    buckets.push({
      key: m.id,
      title: m.name,
      subtitle: fmtDate(m.target_date),
      color: STATUS_COLORS[m.status] ?? "#94a3b8",
      tasks: bucketTasks,
    });
  }

  const unscheduled = tasks.filter((t) => !used.has(t.id));
  if (unscheduled.length > 0) {
    buckets.push({
      key: "__unscheduled__",
      title: "Unscheduled",
      subtitle: `${unscheduled.length} task${unscheduled.length === 1 ? "" : "s"}`,
      color: "#cbd5e1",
      tasks: unscheduled,
    });
  }

  if (buckets.length === 0) {
    return [
      {
        type: "text",
        x: 80,
        y: 80,
        text: "No milestones or tasks yet — add some, then regenerate.",
        fontSize: 20,
        strokeColor: "#64748b",
      },
    ];
  }

  const els: Skeleton[] = [];
  // Title
  els.push({
    type: "text",
    x: 60,
    y: 20,
    text: "Phase plan — milestones",
    fontSize: 28,
    strokeColor: "#0f172a",
  });

  buckets.forEach((b, i) => {
    const x = 60 + i * (COL_WIDTH + COL_GAP);
    // Header background
    els.push({
      type: "rectangle",
      x,
      y: TOP,
      width: COL_WIDTH,
      height: HEADER_H,
      strokeColor: b.color,
      backgroundColor: b.color + "20",
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      roundness: { type: 3 },
    });
    els.push({
      type: "text",
      x: x + 14,
      y: TOP + 14,
      text: b.title,
      fontSize: 18,
      strokeColor: "#0f172a",
    });
    els.push({
      type: "text",
      x: x + 14,
      y: TOP + 48,
      text: b.subtitle,
      fontSize: 14,
      strokeColor: "#475569",
    });

    // Task chips
    let cy = TOP + HEADER_H + 24;
    b.tasks.forEach((t) => {
      els.push({
        type: "rectangle",
        x,
        y: cy,
        width: COL_WIDTH,
        height: CHIP_H,
        strokeColor: TASK_STATUS_COLORS[t.status] ?? "#94a3b8",
        backgroundColor: "#ffffff",
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 0,
        roundness: { type: 3 },
        customData: { taskId: t.id },
      });
      cy += CHIP_H + CHIP_GAP;
    });
  });

  return els;
}
