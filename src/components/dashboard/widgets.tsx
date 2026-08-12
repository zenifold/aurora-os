import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { useUIStore } from "@/stores/ui-store";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, isAfter, isToday, parseISO, startOfWeek } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  Flag,
  Folder,
  Inbox,
  Loader2,
  Mic,
  Pin,
  Plus,
  Sparkles,
  StickyNote,
  Users,
} from "lucide-react";
import type { Project, Task, Note } from "@/lib/types";
import { ProjectPhaseChip } from "@/components/projects/ProjectPhaseChip";
import { STATUS_OPTIONS } from "@/lib/types";
import type { Page } from "@/lib/page-types";
import type { Meeting } from "@/lib/meeting-types";
import type { Milestone } from "@/lib/milestone-types";
import { MILESTONE_STATUS_META } from "@/lib/milestone-types";
import { Button } from "@/components/ui/button";
import { UpcomingCalendar } from "@/components/meetings/UpcomingCalendar";

// Shared frame ----------------------------------------------------

export function WidgetFrame({
  title,
  icon: Icon,
  linkTo,
  linkLabel,
  children,
  empty,
}: {
  title: string;
  icon?: typeof CalendarClock;
  linkTo?: string;
  linkLabel?: string;
  children?: React.ReactNode;
  empty?: { icon?: typeof CalendarClock; label: string };
}) {
  return (
    <section className="surface-card group flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {Icon && (
            <span className="icon-tile h-6 w-6">
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
          <span className="transition-colors group-hover:text-foreground">{title}</span>
        </h2>
        {linkTo && (
          <Link
            to={linkTo}
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition hover:gap-1.5 hover:text-foreground"
          >
            {linkLabel ?? "View"} <span aria-hidden>→</span>
          </Link>
        )}
      </div>
      <div className="flex-1">
        {children ?? (
          <div className="flex h-full min-h-24 flex-col items-center justify-center text-center text-xs text-muted-foreground">
            {empty?.icon ? <empty.icon className="mb-1 h-5 w-5 opacity-60" /> : null}
            {empty?.label}
          </div>
        )}
      </div>
    </section>
  );
}

// Quick actions ---------------------------------------------------

export function QuickActionsWidget() {
  const navigate = useNavigate();
  const setQuickCaptureOpen = useUIStore((s) => s.setQuickCaptureOpen);
  const items = [
    {
      icon: Sparkles,
      label: "Capture task",
      onClick: () => setQuickCaptureOpen(true),
      iconClass: "text-violet-500 dark:text-violet-300",
      bgClass: "bg-violet-500/10 group-hover:bg-violet-500/20 ring-1 ring-violet-500/20",
    },
    {
      icon: StickyNote,
      label: "New note",
      onClick: () => navigate({ to: "/app/notes", search: { archived: false, project: undefined } }),
      iconClass: "text-amber-500 dark:text-amber-300",
      bgClass: "bg-amber-500/10 group-hover:bg-amber-500/20 ring-1 ring-amber-500/20",
    },
    {
      icon: FileText,
      label: "New page",
      onClick: () => navigate({ to: "/app/pages" }),
      iconClass: "text-sky-500 dark:text-sky-300",
      bgClass: "bg-sky-500/10 group-hover:bg-sky-500/20 ring-1 ring-sky-500/20",
    },
    {
      icon: Mic,
      label: "New meeting",
      onClick: () => navigate({ to: "/app/meetings" }),
      iconClass: "text-rose-500 dark:text-rose-300",
      bgClass: "bg-rose-500/10 group-hover:bg-rose-500/20 ring-1 ring-rose-500/20",
    },
    {
      icon: Inbox,
      label: "My tasks",
      onClick: () => navigate({ to: "/app/my-tasks" }),
      iconClass: "text-emerald-500 dark:text-emerald-300",
      bgClass: "bg-emerald-500/10 group-hover:bg-emerald-500/20 ring-1 ring-emerald-500/20",
    },
    {
      icon: Users,
      label: "CRM",
      onClick: () => navigate({ to: "/app/clients" }),
      iconClass: "text-fuchsia-500 dark:text-fuchsia-300",
      bgClass: "bg-fuchsia-500/10 group-hover:bg-fuchsia-500/20 ring-1 ring-fuchsia-500/20",
    },
  ];
  return (
    <WidgetFrame title="Quick actions" icon={Sparkles}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            onClick={it.onClick}
            className="group flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-left text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-pop hover:border-foreground/20 active:scale-[0.98]"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition ${it.bgClass}`}>
              <it.icon className={`h-4 w-4 ${it.iconClass}`} />
            </span>
            <span className="truncate text-xs sm:text-sm">{it.label}</span>
          </button>
        ))}
      </div>
    </WidgetFrame>
  );
}

// Stats -----------------------------------------------------------

export function StatsWidget() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const { data: tasks = [] } = useQuery({
    queryKey: ["dashboard", "all-tasks", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("workspace_id", ws!.id);
      return (data ?? []) as Task[];
    },
  });
  const my = user ? tasks.filter((t) => (t.assignee_ids ?? []).includes(user.id) || t.created_by === user.id) : [];
  const dueToday = my.filter((t) => t.due_date && isToday(parseISO(t.due_date)) && t.status !== "done").length;
  const overdue = my.filter((t) => t.due_date && !isToday(parseISO(t.due_date)) && parseISO(t.due_date) < new Date() && t.status !== "done").length;
  const inProgress = my.filter((t) => t.status === "in_progress").length;
  const doneWeek = my.filter((t) => t.status === "done" && t.completed_at && isAfter(parseISO(t.completed_at), startOfWeek(new Date(), { weekStartsOn: 1 }))).length;

  const cards = [
    { icon: CalendarClock, label: "Due today", value: dueToday, tone: "default" as const },
    { icon: Loader2, label: "In progress", value: inProgress, tone: "default" as const },
    { icon: AlertCircle, label: "Overdue", value: overdue, tone: overdue > 0 ? ("danger" as const) : ("default" as const) },
    { icon: CheckCircle2, label: "Done this week", value: doneWeek, tone: "success" as const },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <Link
          key={c.label}
          to="/app/my-tasks"
          className="group rounded-xl border border-border bg-card p-3 shadow-elegant transition hover:-translate-y-0.5 hover:shadow-pop sm:p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{c.label}</span>
            <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div
            className={`mt-1.5 text-2xl font-semibold sm:text-3xl ${
              c.tone === "danger" ? "text-destructive" : c.tone === "success" ? "text-status-done" : "text-foreground"
            }`}
          >
            {c.value}
          </div>
        </Link>
      ))}
    </div>
  );
}

// My tasks --------------------------------------------------------

export function MyTasksWidget() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const navigate = useNavigate();
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);

  const { data: tasks = [] } = useQuery({
    queryKey: ["dashboard", "my-upcoming", ws?.id, user?.id],
    enabled: !!ws && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", ws!.id)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(50);
      const list = ((data ?? []) as Task[]).filter(
        (t) => (t.assignee_ids ?? []).includes(user!.id) || t.created_by === user!.id,
      );
      return list.slice(0, 6);
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["dashboard", "projects-map", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name,color").eq("workspace_id", ws!.id);
      return (data ?? []) as Pick<Project, "id" | "name" | "color">[];
    },
  });
  const projectById = new Map(projects.map((p) => [p.id, p]));

  return (
    <WidgetFrame
      title="My tasks"
      icon={Inbox}
      linkTo="/app/my-tasks"
      linkLabel="See all"
      empty={tasks.length === 0 ? { icon: CheckCircle2, label: "No tasks assigned to you. Take a breath." } : undefined}
    >
      {tasks.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-border">
          {tasks.map((t) => {
            const status = STATUS_OPTIONS.find((s) => s.value === t.status);
            const proj = projectById.get(t.project_id);
            return (
              <li
                key={t.id}
                className="flex cursor-pointer items-center gap-3 border-b border-border bg-background px-3 py-2.5 last:border-b-0 hover:bg-muted/40"
                onClick={() => {
                  setSelectedTaskId(t.id);
                  navigate({ to: "/app/p/$projectId", params: { projectId: t.project_id } });
                }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: status?.color }} />
                <span className="flex-1 truncate text-sm">{t.title}</span>
                {proj && (
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline" style={{ color: proj.color }}>
                    {proj.name}
                  </span>
                )}
                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                  {t.due_date ? format(parseISO(t.due_date), "MMM d") : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetFrame>
  );
}

// Recent projects -------------------------------------------------

export function RecentProjectsWidget() {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: projects = [] } = useQuery({
    queryKey: ["dashboard", "recent-projects", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(6);
      return (data ?? []) as Project[];
    },
  });
  return (
    <WidgetFrame
      title="Recent projects"
      icon={Folder}
      empty={projects.length === 0 ? { icon: Folder, label: "No projects yet." } : undefined}
    >
      {projects.length > 0 && (
        <div className="grid gap-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/app/p/$projectId"
              params={{ projectId: p.id }}
              className="group flex items-center gap-3 rounded-lg border border-border bg-background p-2.5 transition hover:-translate-y-0.5 hover:shadow-pop"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `${p.color}22`, color: p.color }}
              >
                <Folder className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(parseISO(p.updated_at ?? p.created_at), { addSuffix: true })}
                  </p>
                  <ProjectPhaseChip projectId={p.id} noLink />
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      )}
    </WidgetFrame>
  );
}

// Activity feed ---------------------------------------------------

interface ActivityRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  created_at: string;
  actor?: { display_name: string | null };
  taskTitle?: string;
}

export function ActivityWidget() {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: rows = [] } = useQuery({
    queryKey: ["dashboard", "activity", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false })
        .limit(8);
      const list = (data ?? []) as ActivityRow[];
      const actorIds = Array.from(new Set(list.map((r) => r.actor_id).filter(Boolean) as string[]));
      const taskIds = Array.from(new Set(list.filter((r) => r.entity_type === "task").map((r) => r.entity_id)));
      const [{ data: profs }, { data: tsks }] = await Promise.all([
        actorIds.length ? supabase.from("profiles").select("id, display_name").in("id", actorIds) : Promise.resolve({ data: [] }),
        taskIds.length ? supabase.from("tasks").select("id, title").in("id", taskIds) : Promise.resolve({ data: [] }),
      ]);
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      const taskMap = new Map((tsks ?? []).map((t) => [t.id, t.title]));
      return list.map((r) => ({
        ...r,
        actor: r.actor_id ? profMap.get(r.actor_id) : undefined,
        taskTitle: taskMap.get(r.entity_id),
      }));
    },
  });
  return (
    <WidgetFrame
      title="Recent activity"
      empty={rows.length === 0 ? { label: "Activity will appear here as your team works." } : undefined}
    >
      {rows.length > 0 && (
        <ul className="space-y-2.5">
          {rows.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aura-gradient" />
              <div className="min-w-0 flex-1">
                <span className="font-medium">{a.actor?.display_name ?? "Someone"}</span>{" "}
                <span className="text-muted-foreground">
                  {a.action} {a.taskTitle ? `"${a.taskTitle}"` : a.entity_type}
                </span>
                <div className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(parseISO(a.created_at), { addSuffix: true })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

// Pinned pages ----------------------------------------------------

export function PinnedPagesWidget() {
  const ws = useWorkspaceStore((s) => s.current);
  const navigate = useNavigate();
  const { data: pages = [] } = useQuery({
    queryKey: ["dashboard", "pinned-pages", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data } = await supabase
        .from("pages" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false)
        .eq("is_pinned", true)
        .order("updated_at", { ascending: false })
        .limit(8);
      return ((data ?? []) as unknown) as Page[];
    },
  });
  return (
    <WidgetFrame
      title="Pinned pages"
      icon={Pin}
      linkTo="/app/pages"
      empty={pages.length === 0 ? { icon: FileText, label: "Pin your most important pages to see them here." } : undefined}
    >
      {pages.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate({ to: "/app/pages" })}
              className="group flex items-center gap-2 rounded-lg border border-border bg-background p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-pop"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-base">
                {p.icon ?? "📄"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.title || "Untitled"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(parseISO(p.updated_at), { addSuffix: true })}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </WidgetFrame>
  );
}

// Recent notes ----------------------------------------------------

export function RecentNotesWidget() {
  const ws = useWorkspaceStore((s) => s.current);
  const navigate = useNavigate();
  const { data: notes = [] } = useQuery({
    queryKey: ["dashboard", "recent-notes", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(5);
      return (data ?? []) as Note[];
    },
  });
  return (
    <WidgetFrame
      title="Recent notes"
      icon={StickyNote}
      linkTo="/app/notes"
      linkLabel="All notes"
      empty={notes.length === 0 ? { icon: StickyNote, label: "No notes yet." } : undefined}
    >
      {notes.length > 0 && (
        <ul className="space-y-1.5">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => navigate({ to: "/app/notes", search: { archived: false, project: undefined } })}
                className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{n.title || "Untitled"}</span>{" "}
                <span className="text-xs text-muted-foreground">
                  · {formatDistanceToNow(parseISO(n.updated_at), { addSuffix: true })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

// Upcoming meetings ----------------------------------------------

export function UpcomingMeetingsWidget() {
  return (
    <WidgetFrame title="Upcoming meetings" icon={CalendarClock} linkTo="/app/meetings" linkLabel="Open hub">
      <UpcomingCalendar daysAhead={7} compact />
    </WidgetFrame>
  );
}

// My action items (from meetings) --------------------------------

export function MyActionItemsWidget() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: items = [] } = useQuery({
    queryKey: ["dashboard", "my-action-items", ws?.id, user?.id],
    enabled: !!ws && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("meeting_action_items")
        .select("id, meeting_id, summary, original_text, due_guess, priority_guess, status, assignee_guess_user_id, assignee_guess_name")
        .eq("workspace_id", ws!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);
      const all = (data ?? []) as Array<{
        id: string;
        meeting_id: string;
        summary: string | null;
        original_text: string;
        due_guess: string | null;
        priority_guess: "low" | "medium" | "high" | "urgent" | null;
        assignee_guess_user_id: string | null;
        assignee_guess_name: string | null;
      }>;
      return all
        .filter((i) => !i.assignee_guess_user_id || i.assignee_guess_user_id === user!.id)
        .slice(0, 6);
    },
  });
  return (
    <WidgetFrame
      title="My action items"
      icon={CheckCircle2}
      linkTo="/app/meetings"
      linkLabel="All meetings"
      empty={items.length === 0 ? { icon: CheckCircle2, label: "No open action items from meetings." } : undefined}
    >
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => navigate({ to: "/app/meetings/$meetingId", params: { meetingId: i.meeting_id } })}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
              >
                <span className="mt-0.5 text-muted-foreground">
                  {i.priority_guess === "urgent" || i.priority_guess === "high" ? (
                    <Flag className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="flex-1 truncate text-sm">
                  {i.summary ?? i.original_text}
                  {i.due_guess && (
                    <span className="ml-1.5 text-xs text-muted-foreground">· due {i.due_guess}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

// Recent meeting recaps ------------------------------------------

export function RecentRecapsWidget() {
  const ws = useWorkspaceStore((s) => s.current);
  const navigate = useNavigate();
  const { data: meetings = [] } = useQuery({
    queryKey: ["dashboard", "recent-recaps", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data } = await supabase
        .from("meetings")
        .select("id, title, summary, ai_status, updated_at, actual_end, scheduled_start")
        .eq("workspace_id", ws!.id)
        .eq("ai_status", "completed")
        .order("updated_at", { ascending: false })
        .limit(5);
      return (data ?? []) as Array<Pick<Meeting, "id" | "title" | "summary" | "ai_status" | "updated_at" | "actual_end" | "scheduled_start">>;
    },
  });
  return (
    <WidgetFrame
      title="Recent recaps"
      icon={Sparkles}
      linkTo="/app/meetings"
      linkLabel="All meetings"
      empty={meetings.length === 0 ? { icon: Sparkles, label: "No AI recaps yet." } : undefined}
    >
      {meetings.length > 0 && (
        <ul className="space-y-1.5">
          {meetings.map((m) => {
            const overview = m.summary?.overview ?? null;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/app/meetings/$meetingId", params: { meetingId: m.id } })}
                  className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{m.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(parseISO(m.updated_at), { addSuffix: true })}
                    </span>
                  </div>
                  {overview && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{overview}</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetFrame>
  );
}

// At-risk projects -----------------------------------------------

export function AtRiskProjectsWidget() {
  const ws = useWorkspaceStore((s) => s.current);
  const { data } = useQuery({
    queryKey: ["dashboard", "at-risk", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: projs }, { data: tasks }] = await Promise.all([
        supabase.from("projects").select("id,name,color").eq("workspace_id", ws!.id).eq("is_archived", false),
        supabase
          .from("tasks")
          .select("project_id,status,due_date")
          .eq("workspace_id", ws!.id)
          .neq("status", "done")
          .lt("due_date", today),
      ]);
      const counts = new Map<string, number>();
      ((tasks ?? []) as { project_id: string }[]).forEach((t) => counts.set(t.project_id, (counts.get(t.project_id) ?? 0) + 1));
      const list = ((projs ?? []) as Pick<Project, "id" | "name" | "color">[])
        .map((p) => ({ ...p, overdue: counts.get(p.id) ?? 0 }))
        .filter((p) => p.overdue > 0)
        .sort((a, b) => b.overdue - a.overdue)
        .slice(0, 6);
      return list;
    },
  });
  const list = data ?? [];
  return (
    <WidgetFrame
      title="At-risk projects"
      icon={AlertCircle}
      empty={list.length === 0 ? { icon: CheckCircle2, label: "Nothing overdue. Great work." } : undefined}
    >
      {list.length > 0 && (
        <ul className="space-y-1.5">
          {list.map((p) => (
            <li key={p.id}>
              <Link
                to="/app/p/$projectId"
                params={{ projectId: p.id }}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:-translate-y-0.5 hover:shadow-pop"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="truncate font-medium">{p.name}</span>
                </span>
                <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  {p.overdue} overdue
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

// Milestones ------------------------------------------------------

export function MilestonesWidget() {
  const ws = useWorkspaceStore((s) => s.current);
  const navigate = useNavigate();
  const { data: milestones = [] } = useQuery({
    queryKey: ["dashboard", "milestones", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data } = await supabase
        .from("milestones" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .in("status", ["upcoming", "at_risk"])
        .order("target_date", { ascending: true })
        .limit(6);
      return ((data ?? []) as unknown) as Milestone[];
    },
  });
  return (
    <WidgetFrame
      title="Upcoming milestones"
      icon={Flag}
      empty={milestones.length === 0 ? { icon: Flag, label: "No active milestones." } : undefined}
    >
      {milestones.length > 0 && (
        <ul className="space-y-1.5">
          {milestones.map((m) => {
            const meta = MILESTONE_STATUS_META[m.status];
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/app/p/$projectId/milestones", params: { projectId: m.project_id } })}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition hover:-translate-y-0.5 hover:shadow-pop"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}>
                    {meta.label}
                  </span>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {format(parseISO(m.target_date), "MMM d")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetFrame>
  );
}

// Agent runs ------------------------------------------------------

interface AgentRunRow {
  id: string;
  status: string;
  prompt: string | null;
  created_at: string;
}

export function AgentRunsWidget() {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: runs = [] } = useQuery({
    queryKey: ["dashboard", "agent-runs", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_runs")
        .select("id,status,prompt,created_at")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as AgentRunRow[];
    },
  });
  return (
    <WidgetFrame
      title="Recent AI runs"
      icon={Sparkles}
      linkTo="/app/agent-runs"
      empty={runs.length === 0 ? { icon: Sparkles, label: "Run an agent to see it here." } : undefined}
    >
      {runs.length > 0 && (
        <ul className="space-y-1.5">
          {runs.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  r.status === "completed" ? "bg-status-done" : r.status === "failed" ? "bg-destructive" : "bg-primary"
                }`}
              />
              <span className="flex-1 truncate">{r.prompt || "Untitled run"}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatDistanceToNow(parseISO(r.created_at), { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

// Empty + create-project helper ----------------------------------

export function EmptyProjectsCallout({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-aura-gradient-subtle p-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-aura-gradient">
        <Folder className="h-5 w-5 text-primary-foreground" />
      </div>
      <p className="mt-3 font-semibold">Create your first project</p>
      <p className="mt-1 text-sm text-muted-foreground">Group your tasks, pick a view, and get to work.</p>
      <Button onClick={onCreate} className="mt-4 bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
        <Plus className="mr-1.5 h-4 w-4" /> New project
      </Button>
    </div>
  );
}
