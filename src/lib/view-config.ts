import type { Task, ViewConfig } from "@/lib/types";
import { differenceInCalendarDays, parseISO } from "date-fns";

const PRIORITY_COLORS: Record<string, string> = {
  low: "oklch(0.7 0.05 240)",
  medium: "oklch(0.7 0.12 80)",
  high: "oklch(0.65 0.18 30)",
  urgent: "oklch(0.6 0.22 25)",
};

/**
 * Returns a color string (or null) for a task given the view's colorBy setting.
 * Used to render a colored left border on rows / cards.
 */
export function colorForTask(task: Task, config: ViewConfig, statusColors?: Map<string, string>): string | null {
  switch (config.colorBy) {
    case "priority":
      return PRIORITY_COLORS[task.priority] ?? null;
    case "status":
      return statusColors?.get(task.status as string) ?? null;
    case "due_date": {
      if (!task.due_date) return null;
      const days = differenceInCalendarDays(parseISO(task.due_date), new Date());
      if (days < 0) return "hsl(var(--destructive))";
      if (days <= 1) return "oklch(0.7 0.18 50)"; // amber
      if (days <= 7) return "oklch(0.7 0.12 200)"; // blue
      return "oklch(0.6 0.05 240)";
    }
    default:
      return null;
  }
}

export function isColumnVisible(config: ViewConfig, key: string): boolean {
  const c = (config.columns ?? []).find((c) => c.key === key);
  return c?.visible !== false;
}
