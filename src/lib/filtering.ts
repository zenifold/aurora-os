import type { Filter, Sort, Task } from "./types";

function getFieldValue(task: Task, field: string): unknown {
  if (field === "title") return task.title;
  if (field === "status") return task.status;
  if (field === "priority") return task.priority;
  if (field === "due_date") return task.due_date;
  if (field === "assignee_ids") return task.assignee_ids;
  if (field === "tags") return task.tags;
  if (field.startsWith("cf:")) return task.custom_values?.[field.slice(3)];
  return undefined;
}

export function applyFiltersAndSorts(tasks: Task[], filters: Filter[], sorts: Sort[]): Task[] {
  let out = tasks;
  if (filters && filters.length > 0) {
    out = out.filter((t) =>
      filters.every((f) => {
        const v = getFieldValue(t, f.field);
        switch (f.operator) {
          case "is":
            if (Array.isArray(v)) return v.includes(f.value as string);
            return v === f.value;
          case "is_not":
            if (Array.isArray(v)) return !v.includes(f.value as string);
            return v !== f.value;
          case "contains":
            return typeof v === "string" && v.toLowerCase().includes(String(f.value ?? "").toLowerCase());
          case "before":
            return typeof v === "string" && v < String(f.value ?? "");
          case "after":
            return typeof v === "string" && v > String(f.value ?? "");
          case "is_empty":
            return v == null || v === "" || (Array.isArray(v) && v.length === 0);
          case "is_not_empty":
            return !(v == null || v === "" || (Array.isArray(v) && v.length === 0));
          default:
            return true;
        }
      })
    );
  }
  if (sorts && sorts.length > 0) {
    out = [...out].sort((a, b) => {
      for (const s of sorts) {
        const av = getFieldValue(a, s.field);
        const bv = getFieldValue(b, s.field);
        const cmp = compare(av, bv);
        if (cmp !== 0) return s.direction === "asc" ? cmp : -cmp;
      }
      return a.position - b.position;
    });
  }
  return out;
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function groupTasks(tasks: Task[], groupBy: string | null): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  if (!groupBy) {
    map.set("__all__", tasks);
    return map;
  }
  for (const t of tasks) {
    const key = String(getFieldValue(t, groupBy) ?? "__none__");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return map;
}
