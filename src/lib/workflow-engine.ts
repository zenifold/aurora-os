import type {
  Gate,
  GateResult,
  WorkflowStatus,
  WorkflowTransition,
  ApprovalRequiredGate,
  TransitionApproval,
} from "@/lib/workflow-types";
import type { Task } from "@/lib/types";

interface EvalContext {
  task: Task;
  /** Subtasks of this task (children). */
  children?: Task[];
  /** Tasks blocking this task (relation_type='blocked_by' targets). */
  blockers?: Task[];
  /** Approvals already granted for this transition. */
  approvals?: TransitionApproval[];
  /** Lookup of statuses (id → WorkflowStatus) for category checks. */
  statusById?: Map<string, WorkflowStatus>;
  /** Current user id (for self-approval check). */
  currentUserId?: string;
}

const FIELD_GETTERS: Record<string, (t: Task) => unknown> = {
  assignee_ids: (t) => (t.assignee_ids?.length ? t.assignee_ids : null),
  due_date: (t) => t.due_date,
  start_date: (t) => t.start_date,
  priority: (t) => t.priority,
  description: (t) => t.description,
  tags: (t) => (t.tags?.length ? t.tags : null),
};

function getFieldValue(task: Task, field: string): unknown {
  const getter = FIELD_GETTERS[field];
  if (getter) return getter(task);
  // Fall back to custom_values lookup by name
  const cv = task.custom_values ?? {};
  return cv[field] ?? null;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

function evalSingleGate(gate: Gate, ctx: EvalContext): GateResult {
  const behavior = gate.behavior ?? "block";
  const blocking = behavior === "block";

  switch (gate.type) {
    case "field_required": {
      const v = getFieldValue(ctx.task, gate.field);
      if (isEmpty(v)) {
        return {
          passed: false,
          blocking,
          message: gate.message ?? `${gate.field} is required`,
          missing: [gate.field],
        };
      }
      return { passed: true, blocking: false, message: "", missing: [] };
    }

    case "approval_required": {
      const approvals = ctx.approvals ?? [];
      const approved = approvals.filter((a) => a.status === "approved");
      const enough = approved.length >= (gate.min_approvals ?? 1);
      if (enough) return { passed: true, blocking: false, message: "", missing: [] };
      return {
        passed: false,
        blocking: true,
        message: gate.message ?? "Approval required to proceed",
        missing: ["approval"],
        needsApproval: true,
        approvalGate: gate as ApprovalRequiredGate,
      };
    }

    case "all_blockers_resolved":
    case "no_open_blockers": {
      const blockers = ctx.blockers ?? [];
      const open = blockers.filter((b) => {
        const cat = ctx.statusById?.get(b.status as string)?.category;
        return cat !== "done" && cat !== "cancelled";
      });
      if (open.length === 0) return { passed: true, blocking: false, message: "", missing: [] };
      return {
        passed: false,
        blocking,
        message: gate.message ?? `${open.length} blocker(s) still open`,
        missing: open.map((b) => b.title),
      };
    }

    case "subtasks_status": {
      const children = ctx.children ?? [];
      if (children.length === 0) return { passed: true, blocking: false, message: "", missing: [] };
      const allowed = new Set(gate.statuses);
      const failing = children.filter((c) => {
        const cat = ctx.statusById?.get(c.status as string)?.category;
        return !cat || !allowed.has(cat);
      });
      if (failing.length === 0) return { passed: true, blocking: false, message: "", missing: [] };
      return {
        passed: false,
        blocking,
        message: gate.message ?? `${failing.length} subtask(s) not in required status`,
        missing: failing.map((c) => c.title),
      };
    }

    case "child_tasks_status": {
      const children = ctx.children ?? [];
      const total = children.length;
      if (total === 0) return { passed: true, blocking: false, message: "", missing: [] };
      const allowed = new Set(gate.statuses);
      const passing = children.filter((c) => {
        const cat = ctx.statusById?.get(c.status as string)?.category;
        return cat && allowed.has(cat);
      }).length;
      const required = gate.allow_percent ?? 100;
      const pct = (passing / total) * 100;
      if (pct >= required) return { passed: true, blocking: false, message: "", missing: [] };
      return {
        passed: false,
        blocking,
        message: gate.message ?? `${Math.round(pct)}% of children complete (${required}% required)`,
        missing: ["child_tasks"],
      };
    }

    case "checklist_min": {
      // Description is a Tiptap doc — count taskItems with checked=true.
      const { done, total } = countChecklist(ctx.task.description);
      if (total === 0) return { passed: true, blocking: false, message: "", missing: [] };
      const pct = (done / total) * 100;
      const required = gate.percent ?? 100;
      if (pct >= required) return { passed: true, blocking: false, message: "", missing: [] };
      return {
        passed: false,
        blocking: blocking && required === 100,
        message: gate.message ?? `${Math.round(pct)}% checklist complete (${required}% required)`,
        missing: ["checklist_items"],
      };
    }

    case "time_logged": {
      // Not yet tracked; treat as passed for now (placeholder)
      return { passed: true, blocking: false, message: "", missing: [] };
    }

    case "custom_field": {
      const cv = ctx.task.custom_values ?? {};
      const v = cv[gate.field_id];
      let ok = false;
      switch (gate.operator) {
        case "is": ok = v === gate.value; break;
        case "is_not": ok = v !== gate.value; break;
        case "is_empty": ok = isEmpty(v); break;
        case "is_not_empty": ok = !isEmpty(v); break;
        case "contains":
          ok = typeof v === "string" && typeof gate.value === "string" && v.includes(gate.value);
          break;
      }
      if (ok) return { passed: true, blocking: false, message: "", missing: [] };
      return {
        passed: false,
        blocking,
        message: gate.message ?? `Custom field condition not met`,
        missing: [gate.field_id],
      };
    }

    default:
      return { passed: true, blocking: false, message: "", missing: [] };
  }
}

function countChecklist(doc: unknown): { done: number; total: number } {
  let done = 0;
  let total = 0;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; attrs?: { checked?: boolean }; content?: unknown[] };
    if (n.type === "taskItem") {
      total += 1;
      if (n.attrs?.checked) done += 1;
    }
    if (Array.isArray(n.content)) for (const c of n.content) visit(c);
  };
  visit(doc);
  return { done, total };
}

/**
 * Aggregate gate results: returns the *first* failing blocker, or merges
 * non-blocking warnings into a combined result.
 */
export function evaluateGates(gates: Gate[], ctx: EvalContext): GateResult {
  const results = gates.map((g) => evalSingleGate(g, ctx));
  const blocker = results.find((r) => !r.passed && r.blocking);
  if (blocker) return blocker;
  const approval = results.find((r) => r.needsApproval);
  if (approval) return approval;
  const warning = results.find((r) => !r.passed);
  if (warning) return warning;
  return { passed: true, blocking: false, message: "", missing: [] };
}

/**
 * Validate a transition for a task. Combines the transition's own gates plus
 * the source status's exit_criteria and the destination status's entry_criteria.
 */
export function validateTransition(
  fromStatus: WorkflowStatus | undefined,
  toStatus: WorkflowStatus,
  transition: WorkflowTransition | undefined,
  ctx: EvalContext,
): GateResult {
  const all: Gate[] = [
    ...(fromStatus?.exit_criteria ?? []),
    ...(toStatus.entry_criteria ?? []),
    ...(transition?.gates ?? []),
  ];
  return evaluateGates(all, ctx);
}

/** Determine whether a transition exists at all between two statuses. */
export function findTransition(
  transitions: WorkflowTransition[],
  fromId: string,
  toId: string,
): WorkflowTransition | undefined {
  return transitions.find((t) => t.from_status_id === fromId && t.to_status_id === toId);
}

/** Check WIP limit: returns true if moving the task to `toStatus` would exceed it. */
export function wouldExceedWipLimit(
  toStatus: WorkflowStatus,
  currentTasksInStatus: number,
  isAlreadyInStatus: boolean,
): boolean {
  if (toStatus.wip_limit == null) return false;
  if (isAlreadyInStatus) return false;
  return currentTasksInStatus + 1 > toStatus.wip_limit;
}
