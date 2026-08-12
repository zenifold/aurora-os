import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Condition = {
  field: string;
  op: "eq" | "neq" | "contains" | "in" | "is_empty" | "is_not_empty" | "changed_to";
  value?: unknown;
};

function getField(task: Record<string, unknown>, field: string): unknown {
  if (field === "description") {
    const d = task.description;
    if (!d) return "";
    return typeof d === "string" ? d : JSON.stringify(d);
  }
  return task[field];
}

function evalCondition(cond: Condition, task: Record<string, unknown>): boolean {
  const v = getField(task, cond.field);
  switch (cond.op) {
    case "eq":
      return String(v ?? "") === String(cond.value ?? "");
    case "neq":
      return String(v ?? "") !== String(cond.value ?? "");
    case "contains":
      return typeof v === "string" && typeof cond.value === "string" && v.toLowerCase().includes(cond.value.toLowerCase());
    case "in":
      return Array.isArray(cond.value) && (cond.value as unknown[]).map(String).includes(String(v));
    case "is_empty":
      return v == null || v === "" || (Array.isArray(v) && v.length === 0);
    case "is_not_empty":
      return v != null && v !== "" && !(Array.isArray(v) && v.length === 0);
    case "changed_to":
      // In simulation we have no prior — treat as eq
      return String(v ?? "") === String(cond.value ?? "");
    default:
      return false;
  }
}

export const simulateAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        conditions: z.array(z.any()),
        project_id: z.string().uuid().nullable().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const conditions = (data.conditions ?? []) as Condition[];

    let q = supabase
      .from("tasks")
      .select("id,title,status,priority,description,tags,project_id,assignee_ids,workspace_id,created_at")
      .eq("workspace_id", data.workspace_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);

    if (data.project_id) q = q.eq("project_id", data.project_id);

    const { data: tasks, error } = await q;
    if (error) return { evaluated: 0, matched: [], misses: [], error: error.message };

    const matched: { id: string; title: string; status: string; project_id: string | null }[] = [];
    const misses: { id: string; title: string; failed: string }[] = [];

    for (const t of tasks ?? []) {
      const rec = t as unknown as Record<string, unknown>;
      let allPass = true;
      let firstFail: Condition | null = null;
      for (const c of conditions) {
        if (!evalCondition(c, rec)) {
          allPass = false;
          firstFail = c;
          break;
        }
      }
      if (allPass) {
        matched.push({ id: t.id, title: t.title, status: t.status, project_id: t.project_id });
      } else if (firstFail && misses.length < 5) {
        const valStr = firstFail.value == null ? "" : ` "${String(firstFail.value)}"`;
        misses.push({ id: t.id, title: t.title, failed: `${firstFail.field} ${firstFail.op}${valStr}` });
      }
    }

    return {
      evaluated: tasks?.length ?? 0,
      matched,
      misses,
      error: null as string | null,
    };
  });
