import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EVENT_TYPES = [
  "task_complete",
  "task_comment",
  "doc_upload",
  "status_update",
  "login",
  "approval_given",
] as const;
type EventType = (typeof EVENT_TYPES)[number];

async function assertAccountAccess(accountId: string, userId: string): Promise<string> {
  const { data: account } = await supabaseAdmin
    .from("client_accounts")
    .select("workspace_id")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) throw new Error("Account not found");
  const { data: member } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", account.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) throw new Error("Not a workspace member");
  return account.workspace_id;
}

function classify(type: EventType): { requires_response: boolean; unblocks_internal: boolean } {
  switch (type) {
    case "task_complete":
      return { requires_response: false, unblocks_internal: true };
    case "approval_given":
      return { requires_response: false, unblocks_internal: true };
    case "doc_upload":
      return { requires_response: false, unblocks_internal: true };
    case "task_comment":
      return { requires_response: true, unblocks_internal: false };
    case "status_update":
      return { requires_response: false, unblocks_internal: false };
    case "login":
      return { requires_response: false, unblocks_internal: false };
  }
}

// ---------- Emit ----------
export const emitPortalEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientAccountId: z.string().uuid(),
        eventType: z.enum(EVENT_TYPES),
        projectId: z.string().uuid().optional().nullable(),
        contactId: z.string().uuid().optional().nullable(),
        payload: z.record(z.string(), z.unknown()).optional(),
        portalSessionId: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await assertAccountAccess(data.clientAccountId, context.userId);
    const flags = classify(data.eventType);

    const { data: row, error } = await supabaseAdmin
      .from("portal_activity_log")
      .insert({
        workspace_id: workspaceId,
        client_account_id: data.clientAccountId,
        project_id: data.projectId ?? null,
        contact_id: data.contactId ?? null,
        activity_type: data.eventType,
        metadata: (data.payload ?? {}) as never,
        requires_response: flags.requires_response,
        unblocks_internal: flags.unblocks_internal,
        portal_session_id: data.portalSessionId ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ---------- Get timeline ----------
export const getPortalActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        accountId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAccountAccess(data.accountId, context.userId);

    const { data: events, error } = await supabaseAdmin
      .from("portal_activity_log")
      .select(
        "id, activity_type, metadata, created_at, project_id, contact_id, requires_response, unblocks_internal, responded_at, seen_by_user_ids",
      )
      .eq("client_account_id", data.accountId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    // Hydrate project + contact names
    const projectIds = [...new Set((events ?? []).map((e) => e.project_id).filter(Boolean) as string[])];
    const contactIds = [...new Set((events ?? []).map((e) => e.contact_id).filter(Boolean) as string[])];

    const [projects, contacts] = await Promise.all([
      projectIds.length
        ? supabaseAdmin.from("projects").select("id, name").in("id", projectIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      contactIds.length
        ? supabaseAdmin.from("contacts").select("id, name, email").in("id", contactIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null; email: string | null }[] }),
    ]);

    const projectMap = new Map((projects.data ?? []).map((p) => [p.id, p.name]));
    const contactMap = new Map(
      (contacts.data ?? []).map((c: { id: string; name: string | null; email: string | null }) => [
        c.id,
        c.name || c.email || "Unknown",
      ]),
    );

    return (events ?? []).map((e) => ({
      id: e.id,
      type: e.activity_type as EventType,
      payload: (e.metadata ?? {}) as Record<string, unknown> as Record<string, never>,
      createdAt: e.created_at,
      projectId: e.project_id,
      projectName: e.project_id ? projectMap.get(e.project_id) ?? null : null,
      contactId: e.contact_id,
      contactName: e.contact_id ? contactMap.get(e.contact_id) ?? null : null,
      requiresResponse: e.requires_response,
      unblocksInternal: e.unblocks_internal,
      respondedAt: e.responded_at,
      seenByUserIds: e.seen_by_user_ids ?? [],
    }));
  });

// ---------- Pulse + Engagement ----------
export const getClientPulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAccountAccess(data.accountId, context.userId);

    // Trigger recompute, then read
    await supabaseAdmin.rpc("recalculate_client_engagement_score", {
      _client_account_id: data.accountId,
    });

    const { data: pulse } = await supabaseAdmin
      .from("client_portal_pulse")
      .select("*")
      .eq("client_account_id", data.accountId)
      .maybeSingle();

    return pulse;
  });

// ---------- Task Matrix: open client-side tasks ----------
export const getClientTaskMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAccountAccess(data.accountId, context.userId);

    // "Client owed" tasks: tasks on this account's projects assigned to a client contact (heuristic: metadata.client_assigned)
    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id, name, phase, current_phase_id")
      .eq("client_account_id", data.accountId);
    const projectIds = (projects ?? []).map((p) => p.id);
    if (!projectIds.length) return [];

    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("id, title, status, due_date, project_id, updated_at")
      .in("project_id", projectIds)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false });

    const projectMap = new Map((projects ?? []).map((p) => [p.id, p]));
    const now = Date.now();

    // Pair each task with its last related portal action
    const { data: lastActions } = await supabaseAdmin
      .from("portal_activity_log")
      .select("created_at, activity_type, metadata")
      .eq("client_account_id", data.accountId)
      .order("created_at", { ascending: false })
      .limit(200);

    return (tasks ?? []).map((t) => {
      const project = projectMap.get(t.project_id);
      const due = t.due_date ? new Date(t.due_date).getTime() : null;
      const overdue = due !== null && due < now;
      const lastAction =
        (lastActions ?? []).find((a) => {
          const md = a.metadata as Record<string, unknown>;
          return md?.task_id === t.id;
        }) ?? null;
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.due_date,
        overdue,
        projectId: t.project_id,
        projectName: project?.name ?? "—",
        phase: project?.phase ?? null,
        lastClientAction: lastAction
          ? { type: lastAction.activity_type, at: lastAction.created_at }
          : null,
        blocks: overdue ? "Phase progression" : "—",
      };
    });
  });

// ---------- Mark seen ----------
export const markEventSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await supabaseAdmin.rpc("mark_portal_event_seen", {
      _event_id: data.eventId,
      _user_id: context.userId,
    });
    return { ok: true };
  });

export const markAllAccountEventsSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAccountAccess(data.accountId, context.userId);
    const { data: events } = await supabaseAdmin
      .from("portal_activity_log")
      .select("id, seen_by_user_ids")
      .eq("client_account_id", data.accountId)
      .order("created_at", { ascending: false })
      .limit(200);
    const toUpdate = (events ?? []).filter(
      (e) => !(e.seen_by_user_ids ?? []).includes(context.userId),
    );
    for (const e of toUpdate) {
      await supabaseAdmin.rpc("mark_portal_event_seen", {
        _event_id: e.id,
        _user_id: context.userId,
      });
    }
    return { marked: toUpdate.length };
  });

// ---------- Global signals: unseen counts per account in workspace ----------
export const getUnseenActivityCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Membership check
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) throw new Error("Not a workspace member");

    const { data: rows } = await supabaseAdmin
      .from("portal_activity_log")
      .select("client_account_id, requires_response, responded_at, seen_by_user_ids, created_at")
      .eq("workspace_id", data.workspaceId)
      .gt("created_at", new Date(Date.now() - 14 * 86_400_000).toISOString());

    const counts: Record<
      string,
      { total: number; requiresResponse: number; lastActivityAt: string | null }
    > = {};
    for (const r of rows ?? []) {
      if (!r.client_account_id) continue;
      const seen = (r.seen_by_user_ids ?? []).includes(context.userId);
      if (seen) continue;
      if (!counts[r.client_account_id]) {
        counts[r.client_account_id] = { total: 0, requiresResponse: 0, lastActivityAt: null };
      }
      const c = counts[r.client_account_id];
      c.total += 1;
      if (r.requires_response && !r.responded_at) c.requiresResponse += 1;
      if (!c.lastActivityAt || r.created_at > c.lastActivityAt) c.lastActivityAt = r.created_at;
    }
    return counts;
  });

// ---------- Respond to an event (clears requires_response flag) ----------
export const respondToEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("portal_activity_log")
      .update({ responded_at: new Date().toISOString() })
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
