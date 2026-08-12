import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UnifiedInboxKind =
  | "notification"
  | "transition_approval"
  | "agent_approval"
  | "portal_unblock"
  | "ai_draft"
  | "due_task";

export type UnifiedInboxPriority = "high" | "medium" | "low";

export interface UnifiedInboxItem {
  id: string;
  kind: UnifiedInboxKind;
  priority: UnifiedInboxPriority;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  // Decide payload for actionable items
  decidable: boolean;
  decideRef: { type: "transition" | "agent"; id: string } | null;
  contextJson: string | null;
}

// ---------- Unified Inbox ----------
export const getUnifiedInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const items: UnifiedInboxItem[] = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    // 1. Notifications addressed to me
    const { data: notifs } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, created_at, read_at, archived_at, snoozed_until")
      .eq("recipient_id", userId)
      .eq("workspace_id", data.workspaceId)
      .is("archived_at", null)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(150);
    for (const n of notifs ?? []) {
      if (n.snoozed_until && new Date(n.snoozed_until).getTime() > Date.now()) continue;
      const isApproval = n.type?.includes("approval");
      items.push({
        id: `notif:${n.id}`,
        kind: "notification",
        priority: isApproval ? "high" : n.read_at ? "low" : "medium",
        title: n.title,
        body: n.body ?? null,
        link: n.link ?? null,
        createdAt: n.created_at,
        decidable: false,
        decideRef: null,
        contextJson: null,
      });
    }

    // 2. Pending transition approvals where I am the approver
    const { data: tApprovals } = await supabase
      .from("transition_approvals")
      .select("id, task_id, transition_id, requested_at, comment, requested_by")
      .eq("workspace_id", data.workspaceId)
      .eq("approver_id", userId)
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(50);
    if (tApprovals && tApprovals.length) {
      const taskIds = Array.from(new Set(tApprovals.map((a) => a.task_id)));
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, project_id")
        .in("id", taskIds);
      const tMap = new Map(
        (tasks ?? []).map((t) => [t.id, t as { id: string; title: string; project_id: string | null }]),
      );
      for (const a of tApprovals) {
        const t = tMap.get(a.task_id);
        items.push({
          id: `tappr:${a.id}`,
          kind: "transition_approval",
          priority: "high",
          title: `Approval needed: "${t?.title ?? "task"}"`,
          body: a.comment ?? "A teammate requested your approval to advance this task.",
          link: t?.project_id ? `/app/p/${t.project_id}` : null,
          createdAt: a.requested_at,
          decidable: true,
          decideRef: { type: "transition", id: a.id },
          contextJson: JSON.stringify({ taskId: a.task_id, transitionId: a.transition_id, requestedBy: a.requested_by }),
        });
      }
    }

    // 3. Pending agent action approvals (any workspace member can decide)
    const { data: aApprovals } = await supabase
      .from("agent_action_approvals")
      .select("id, agent_id, tool_name, action_summary, created_at, payload")
      .eq("workspace_id", data.workspaceId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    for (const a of aApprovals ?? []) {
      items.push({
        id: `aappr:${a.id}`,
        kind: "agent_approval",
        priority: "medium",
        title: `Agent wants to run: ${a.tool_name}`,
        body: a.action_summary,
        link: `/app/agents`,
        createdAt: a.created_at,
        decidable: true,
        decideRef: { type: "agent", id: a.id },
        contextJson: JSON.stringify({ agentId: a.agent_id, payload: a.payload }),
      });
    }

    // 4. Portal events that unblock internal work and still need response
    const { data: portal } = await supabase
      .from("portal_activity_log")
      .select("id, activity_type, created_at, client_account_id, project_id, metadata")
      .eq("workspace_id", data.workspaceId)
      .eq("unblocks_internal", true)
      .is("responded_at", null)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(50);
    for (const p of portal ?? []) {
      const meta = (p.metadata ?? {}) as Record<string, unknown>;
      items.push({
        id: `portal:${p.id}`,
        kind: "portal_unblock",
        priority: "high",
        title: `Portal: ${p.activity_type} unblocks your work`,
        body: typeof meta.summary === "string" ? meta.summary : null,
        link: p.client_account_id ? `/app/clients/${p.client_account_id}` : null,
        createdAt: p.created_at,
        decidable: false,
        decideRef: null,
        contextJson: JSON.stringify({ accountId: p.client_account_id, projectId: p.project_id }),
      });
    }

    // 5. My own AI artifact drafts awaiting review
    const { data: drafts } = await supabase
      .from("ai_artifacts")
      .select("id, title, kind, created_at, client_account_id, status")
      .eq("workspace_id", data.workspaceId)
      .eq("created_by", userId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(25);
    for (const d of drafts ?? []) {
      items.push({
        id: `draft:${d.id}`,
        kind: "ai_draft",
        priority: "medium",
        title: `AI draft awaiting your review: ${d.title}`,
        body: `${d.kind} • status: draft`,
        link: d.client_account_id ? `/app/clients/${d.client_account_id}` : null,
        createdAt: d.created_at,
        decidable: false,
        decideRef: null,
        contextJson: JSON.stringify({ artifactId: d.id, kind: d.kind }),
      });
    }

    // 6. Tasks due today/overdue assigned to me
    const todayIso = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, project_id")
      .eq("workspace_id", data.workspaceId)
      .contains("assignee_ids", [userId])
      .is("completed_at", null)
      .not("due_date", "is", null)
      .lte("due_date", horizon)
      .order("due_date", { ascending: true })
      .limit(50);
    for (const t of tasks ?? []) {
      const overdue = t.due_date && t.due_date < todayIso;
      items.push({
        id: `task:${t.id}`,
        kind: "due_task",
        priority: overdue ? "high" : "medium",
        title: overdue ? `Overdue: ${t.title}` : `Due ${t.due_date}: ${t.title}`,
        body: null,
        link: t.project_id ? `/app/p/${t.project_id}` : null,
        createdAt: t.due_date ?? new Date().toISOString(),
        decidable: false,
        decideRef: null,
        contextJson: null,
      });
    }

    // Sort: priority desc, then createdAt desc
    const prioRank: Record<UnifiedInboxPriority, number> = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => {
      const p = prioRank[a.priority] - prioRank[b.priority];
      if (p !== 0) return p;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return items;
  });

// ---------- Decide (transition OR agent approval) ----------
export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(["transition", "agent"]),
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        comment: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    if (data.kind === "transition") {
      const { error } = await supabase
        .from("transition_approvals")
        .update({
          status: data.decision,
          comment: data.comment ?? null,
          decided_at: nowIso,
        })
        .eq("id", data.id)
        .eq("approver_id", userId)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("agent_action_approvals")
        .update({
          status: data.decision,
          decision_note: data.comment ?? null,
          decided_by: userId,
          decided_at: nowIso,
        })
        .eq("id", data.id)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
