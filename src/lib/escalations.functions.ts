import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  EscalationActions,
  EscalationConditions,
} from "@/lib/escalation-types";

/**
 * Escalation engine.
 *
 * Evaluates the workspace's active escalation rules against each project's
 * current signals (overdue tasks, schedule slip, health, margin, etc.) and
 * creates an `escalations` row when a rule fires. Per-rule, per-project
 * cooldown prevents spamming.
 *
 * Today the signals are derived directly from project + task data; future
 * iterations can add financial / timesheet signals when those tables stream
 * live data.
 */

interface ProjectRow {
  id: string;
  name: string;
  health: string | null;
  phase: string | null;
  target_end_date: string | null;
  target_margin_pct: number | null;
  is_archived: boolean;
}

interface RuleRow {
  id: string;
  workspace_id: string;
  name: string;
  tier: number;
  conditions: EscalationConditions;
  actions: EscalationActions;
  cooldown_hours: number;
  is_active: boolean;
}

interface ProjectSignals {
  project: ProjectRow;
  daysOverdue: number; // project past target end date
  scheduleSlipDays: number; // worst overdue task days
  overdueTaskCount: number;
  health: string;
  hasClientDeliverableOverdue: boolean;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string) {
  const ms = new Date(a).getTime() - new Date(b).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function ruleMatches(c: EscalationConditions, s: ProjectSignals): boolean {
  // Rule fires when ANY configured condition matches. Empty conditions never fire.
  let configured = 0;
  let matched = 0;

  if (typeof c.days_overdue === "number") {
    configured++;
    if (s.daysOverdue >= c.days_overdue) matched++;
  }
  if (typeof c.schedule_slip_days === "number") {
    configured++;
    if (s.scheduleSlipDays >= c.schedule_slip_days) matched++;
  }
  if (c.client_deliverable_overdue) {
    configured++;
    if (s.hasClientDeliverableOverdue) matched++;
  }
  // health-as-condition: encode "at_risk" / "off_track" via consecutive_l1_alerts trick? Use phase fallback.
  // We expose a synthetic condition via consecutive_l1_alerts >= 1 → off_track health.
  if (typeof c.consecutive_l1_alerts === "number") {
    configured++;
    if (s.health === "off_track" || s.health === "at_risk") matched++;
  }

  return configured > 0 && matched > 0;
}

function buildTitle(rule: RuleRow, s: ProjectSignals): string {
  const parts: string[] = [];
  if (s.daysOverdue > 0) parts.push(`${s.daysOverdue}d past target end`);
  if (s.scheduleSlipDays > 0) parts.push(`${s.scheduleSlipDays}d worst task slip`);
  if (s.overdueTaskCount > 0) parts.push(`${s.overdueTaskCount} overdue tasks`);
  if (s.health !== "on_track") parts.push(`health: ${s.health}`);
  const detail = parts.length ? ` — ${parts.join(", ")}` : "";
  return `${rule.name}: ${s.project.name}${detail}`;
}

function actionPlanFor(rule: RuleRow): { id: string; text: string; done: boolean }[] {
  const items: string[] = [];
  if (rule.actions.notify_roles?.length) {
    items.push(`Notify: ${rule.actions.notify_roles.join(", ")}`);
  }
  if (rule.actions.schedule_meeting?.type) {
    items.push(`Schedule ${rule.actions.schedule_meeting.type} meeting`);
  }
  if (rule.actions.create_task?.title) {
    items.push(`Action task: ${rule.actions.create_task.title}`);
  }
  if (rule.actions.freeze_scope) items.push("Freeze scope until resolved");
  if (rule.actions.require_approval_for?.length) {
    items.push(`Require approval for: ${rule.actions.require_approval_for.join(", ")}`);
  }
  if (items.length === 0) {
    items.push("Triage and acknowledge", "Capture remediation plan", "Resolve or escalate");
  }
  return items.map((text, i) => ({ id: `step-${i + 1}`, text, done: false }));
}

export const evaluateEscalations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        project_id: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // membership check
    const { data: membership } = await supabaseAdmin
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) {
      return { ok: false as const, error: "Not a workspace member." };
    }

    // load active rules
    const { data: rulesRaw } = await supabaseAdmin
      .from("escalation_rules")
      .select("id, workspace_id, name, tier, conditions, actions, cooldown_hours, is_active")
      .eq("workspace_id", data.workspace_id)
      .eq("is_active", true);
    const rules = ((rulesRaw ?? []) as unknown as RuleRow[]).filter((r) => r.is_active);

    if (rules.length === 0) {
      return { ok: true as const, evaluated: 0, created: 0, message: "No active rules." };
    }

    // load projects
    let projectsQ = supabaseAdmin
      .from("projects")
      .select("id, name, health, phase, target_end_date, target_margin_pct, is_archived")
      .eq("workspace_id", data.workspace_id)
      .eq("is_archived", false);
    if (data.project_id) projectsQ = projectsQ.eq("id", data.project_id);
    const { data: projects } = await projectsQ;
    const projectRows = (projects ?? []) as unknown as ProjectRow[];

    if (projectRows.length === 0) {
      return { ok: true as const, evaluated: 0, created: 0, message: "No projects to evaluate." };
    }

    const today = todayIso();
    const projectIds = projectRows.map((p) => p.id);

    // overdue tasks per project
    const { data: tasksRaw } = await supabaseAdmin
      .from("tasks")
      .select("id, project_id, due_date, status, task_type")
      .in("project_id", projectIds)
      .neq("status", "done");
    const tasks = (tasksRaw ?? []) as Array<{
      id: string;
      project_id: string;
      due_date: string | null;
      status: string;
      task_type: string | null;
    }>;

    const sigs: ProjectSignals[] = projectRows.map((p) => {
      const projTasks = tasks.filter((t) => t.project_id === p.id);
      const overdueTasks = projTasks.filter(
        (t) => t.due_date && t.due_date < today,
      );
      const scheduleSlipDays = overdueTasks.reduce((max, t) => {
        const d = t.due_date ? daysBetween(today, t.due_date) : 0;
        return d > max ? d : max;
      }, 0);
      const daysOverdue =
        p.target_end_date && p.target_end_date < today
          ? daysBetween(today, p.target_end_date)
          : 0;
      const hasClientDeliverableOverdue = overdueTasks.some(
        (t) => (t.task_type ?? "").toLowerCase() === "deliverable",
      );
      return {
        project: p,
        daysOverdue,
        scheduleSlipDays,
        overdueTaskCount: overdueTasks.length,
        health: p.health ?? "on_track",
        hasClientDeliverableOverdue,
      };
    });

    // existing recent (within max cooldown) escalations to enforce cooldown
    const maxCooldown = Math.max(...rules.map((r) => r.cooldown_hours), 24);
    const sinceIso = new Date(Date.now() - maxCooldown * 60 * 60 * 1000).toISOString();
    const { data: recentRaw } = await supabaseAdmin
      .from("escalations")
      .select("id, project_id, rule_id, created_at, status")
      .eq("workspace_id", data.workspace_id)
      .gte("created_at", sinceIso);
    const recent = (recentRaw ?? []) as Array<{
      id: string;
      project_id: string;
      rule_id: string | null;
      created_at: string;
      status: string;
    }>;

    const inCooldown = (ruleId: string, projectId: string, hours: number) => {
      const cutoff = Date.now() - hours * 60 * 60 * 1000;
      return recent.some(
        (e) =>
          e.rule_id === ruleId &&
          e.project_id === projectId &&
          new Date(e.created_at).getTime() >= cutoff,
      );
    };
    // also skip if there's already an unresolved escalation for the same rule+project
    const hasOpen = (ruleId: string, projectId: string) =>
      recent.some(
        (e) =>
          e.rule_id === ruleId &&
          e.project_id === projectId &&
          (e.status === "active" || e.status === "acknowledged"),
      );

    const toInsert: Array<Record<string, unknown>> = [];

    for (const sig of sigs) {
      for (const rule of rules) {
        if (!ruleMatches(rule.conditions, sig)) continue;
        if (hasOpen(rule.id, sig.project.id)) continue;
        if (inCooldown(rule.id, sig.project.id, rule.cooldown_hours)) continue;

        toInsert.push({
          workspace_id: data.workspace_id,
          rule_id: rule.id,
          project_id: sig.project.id,
          tier: rule.tier,
          title: buildTitle(rule, sig),
          detail: null,
          triggered_by: {
            days_overdue: sig.daysOverdue,
            schedule_slip_days: sig.scheduleSlipDays,
            overdue_task_count: sig.overdueTaskCount,
            health: sig.health,
            client_deliverable_overdue: sig.hasClientDeliverableOverdue,
          },
          impact: {
            schedule_slip_days: sig.scheduleSlipDays,
            notes: `Rule "${rule.name}" tier ${rule.tier} triggered.`,
          },
          action_plan: actionPlanFor(rule),
          status: "active",
        });
      }
    }

    let created = 0;
    if (toInsert.length > 0) {
      const { error, count } = await supabaseAdmin
        .from("escalations")
        .insert(toInsert as never, { count: "exact" });
      if (error) {
        return { ok: false as const, error: error.message };
      }
      created = count ?? toInsert.length;
    }

    return {
      ok: true as const,
      evaluated: sigs.length,
      created,
      rules: rules.length,
    };
  });

const DEFAULT_RULES = [
  {
    name: "L1 — Project alert",
    tier: 1,
    conditions: { days_overdue: 1, schedule_slip_days: 3 } as EscalationConditions,
    actions: {
      notify_roles: ["project_manager"],
    } as EscalationActions,
    cooldown_hours: 24,
  },
  {
    name: "L2 — Delivery intervention",
    tier: 2,
    conditions: { schedule_slip_days: 7, consecutive_l1_alerts: 1 } as EscalationConditions,
    actions: {
      notify_roles: ["project_manager", "delivery_lead"],
      schedule_meeting: { type: "intervention" },
    } as EscalationActions,
    cooldown_hours: 48,
  },
  {
    name: "L3 — PMO governance",
    tier: 3,
    conditions: { days_overdue: 7, client_deliverable_overdue: true } as EscalationConditions,
    actions: {
      notify_roles: ["pmo", "delivery_lead"],
      create_task: { title: "PMO governance review" },
    } as EscalationActions,
    cooldown_hours: 72,
  },
  {
    name: "L4 — Commercial action",
    tier: 4,
    conditions: { days_overdue: 14 } as EscalationConditions,
    actions: {
      notify_roles: ["commercial", "owner"],
      freeze_scope: true,
      require_approval_for: ["scope_changes", "additional_hours"],
    } as EscalationActions,
    cooldown_hours: 96,
  },
  {
    name: "L5 — Executive",
    tier: 5,
    conditions: { days_overdue: 21 } as EscalationConditions,
    actions: {
      notify_roles: ["executive", "owner"],
      schedule_meeting: { type: "executive_review" },
    } as EscalationActions,
    cooldown_hours: 168,
  },
];

export const seedDefaultEscalationRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ workspace_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!role || (role.role !== "owner" && role.role !== "manager")) {
      return { ok: false as const, error: "Only workspace owners or admins can seed defaults." };
    }

    const { count } = await supabaseAdmin
      .from("escalation_rules")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", data.workspace_id);
    if ((count ?? 0) > 0) {
      return { ok: false as const, error: "Workspace already has rules." };
    }

    const rows = DEFAULT_RULES.map((r) => ({
      workspace_id: data.workspace_id,
      created_by: userId,
      ...r,
    }));
    const { error } = await supabaseAdmin
      .from("escalation_rules")
      .insert(rows as never);
    if (error) return { ok: false as const, error: error.message };

    return { ok: true as const, created: rows.length };
  });
