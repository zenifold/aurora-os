import type { Project, Task } from "@/lib/types";

/**
 * Jira-style ticket ID, e.g. "AURA-42".
 * Falls back gracefully if either piece is missing.
 */
export function formatTaskRef(task: Pick<Task, "task_number"> | null | undefined, project: Pick<Project, "key" | "name"> | null | undefined): string | null {
  if (!task?.task_number) return null;
  const key = project?.key?.trim();
  if (key && key.length > 0) return `${key.toUpperCase()}-${task.task_number}`;
  // No key yet — fall back to "#42"
  return `#${task.task_number}`;
}

/**
 * Try to detect a `KEY-123` ref anywhere in a string. Returns matches.
 */
export function detectTaskRefs(text: string): { key: string; number: number }[] {
  const out: { key: string; number: number }[] = [];
  const re = /\b([A-Z][A-Z0-9]{1,9})-(\d{1,6})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ key: m[1], number: Number(m[2]) });
  }
  return out;
}
