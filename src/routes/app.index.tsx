import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { useUIStore } from "@/stores/ui-store";
import { useCreateProject } from "@/hooks/use-projects";
import { supabase } from "@/integrations/supabase/client";
import type { Project, Task } from "@/lib/types";
import { STATUS_OPTIONS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarClock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Folder,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { format, formatDistanceToNow, isAfter, isToday, parseISO, startOfWeek } from "date-fns";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

interface ActivityRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
  actor?: { display_name: string | null };
  taskTitle?: string;
}

function Dashboard() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const navigate = useNavigate();
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);
  const createProject = useCreateProject();

  const { data: projects = [] } = useQuery({
    queryKey: ["dashboard", "projects", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const { data: tasksAll = [] } = useQuery({
    queryKey: ["dashboard", "all-tasks", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", ws!.id);
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const myTasks = user ? tasksAll.filter((t) => (t.assignee_ids ?? []).includes(user.id) || t.created_by === user.id) : [];
  const dueToday = myTasks.filter((t) => t.due_date && isToday(parseISO(t.due_date)) && t.status !== "done");
  const overdue = myTasks.filter((t) => t.due_date && !isToday(parseISO(t.due_date)) && parseISO(t.due_date) < new Date() && t.status !== "done");
  const inProgress = myTasks.filter((t) => t.status === "in_progress");
  const completedThisWeek = myTasks.filter((t) => {
    if (t.status !== "done" || !t.completed_at) return false;
    return isAfter(parseISO(t.completed_at), startOfWeek(new Date(), { weekStartsOn: 1 }));
  });

  const myUpcoming = myTasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    })
    .slice(0, 5);

  const projectById = new Map(projects.map((p) => [p.id, p]));

  const { data: activity = [] } = useQuery({
    queryKey: ["dashboard", "activity", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      const rows = (data ?? []) as ActivityRow[];
      const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[]));
      const taskIds = Array.from(new Set(rows.filter((r) => r.entity_type === "task").map((r) => r.entity_id)));
      const [{ data: profs }, { data: tsks }] = await Promise.all([
        actorIds.length ? supabase.from("profiles").select("id, display_name").in("id", actorIds) : Promise.resolve({ data: [] }),
        taskIds.length ? supabase.from("tasks").select("id, title").in("id", taskIds) : Promise.resolve({ data: [] }),
      ]);
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      const taskMap = new Map((tsks ?? []).map((t) => [t.id, t.title]));
      return rows.map((r) => ({
        ...r,
        actor: r.actor_id ? profMap.get(r.actor_id) : undefined,
        taskTitle: taskMap.get(r.entity_id),
      }));
    },
  });

  const greeting = getGreeting();
  const firstName = (user?.user_metadata?.display_name ?? user?.email ?? "").toString().split(/[ @]/)[0];

  const handleCreate = async () => {
    if (!ws) return;
    const proj = await createProject.mutateAsync({ name: "Untitled project" });
    navigate({ to: "/app/p/$projectId", params: { projectId: proj.id } });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-10">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {greeting}, <span className="text-aura-gradient">{firstName || "there"}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dueToday.length === 0 && overdue.length === 0
              ? "You're all caught up. Nice."
              : `You have ${dueToday.length} task${dueToday.length === 1 ? "" : "s"} due today${overdue.length > 0 ? `, ${overdue.length} overdue` : ""}.`}
          </p>
        </div>
        <Button onClick={handleCreate} className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
          <Plus className="mr-1.5 h-4 w-4" /> New project
        </Button>
      </div>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarClock}
          label="Due today"
          value={dueToday.length}
          tone="default"
          to="/app/my-tasks"
        />
        <StatCard
          icon={Loader2}
          label="In progress"
          value={inProgress.length}
          tone="default"
          to="/app/my-tasks"
        />
        <StatCard
          icon={AlertCircle}
          label="Overdue"
          value={overdue.length}
          tone={overdue.length > 0 ? "danger" : "default"}
          to="/app/my-tasks"
        />
        <StatCard
          icon={CheckCircle2}
          label="Done this week"
          value={completedThisWeek.length}
          tone="success"
          to="/app/my-tasks"
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* Recent projects + my tasks */}
        <div className="space-y-8 lg:col-span-2">
          <section>
            <SectionHeader title="Recent projects" />
            {projects.length === 0 ? (
              <EmptyProjects onCreate={handleCreate} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    to="/app/p/$projectId"
                    params={{ projectId: p.id }}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-elegant transition hover:-translate-y-0.5 hover:shadow-pop"
                  >
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${p.color}22`, color: p.color }}
                    >
                      <Folder className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Updated {formatDistanceToNow(parseISO(p.updated_at ?? p.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader title="My tasks" linkTo="/app/my-tasks" linkLabel="See all" />
            {myUpcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-aura-gradient" />
                <p className="mt-2 font-medium">No tasks assigned to you. Take a breath.</p>
              </div>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-border bg-card">
                {myUpcoming.map((t) => {
                  const status = STATUS_OPTIONS.find((s) => s.value === t.status);
                  const proj = projectById.get(t.project_id);
                  return (
                    <li
                      key={t.id}
                      className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-muted/40"
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
                      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                        {t.due_date ? format(parseISO(t.due_date), "MMM d") : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Activity feed */}
        <section>
          <SectionHeader title="Recent activity" />
          {activity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Activity will appear here as your team works.
            </div>
          ) : (
            <ul className="space-y-3 rounded-xl border border-border bg-card p-4">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aura-gradient" />
                  <div className="flex-1">
                    <span className="font-medium">{a.actor?.display_name ?? "Someone"}</span>{" "}
                    <span className="text-muted-foreground">{describeActivity(a)}</span>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(parseISO(a.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* FAB */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Quick capture"
            className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-aura-gradient shadow-pop transition hover:scale-110"
          >
            <Plus className="h-6 w-6 text-primary-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuItem onClick={handleCreate}>
            <Folder className="mr-2 h-4 w-4" /> New project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/app/my-tasks" })}>
            <Sparkles className="mr-2 h-4 w-4" /> Open my tasks
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SectionHeader({ title, linkTo, linkLabel }: { title: string; linkTo?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {linkTo && (
        <Link to={linkTo} className="text-xs text-muted-foreground transition hover:text-foreground">
          {linkLabel ?? "View"} →
        </Link>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  to,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: number;
  tone: "default" | "danger" | "success";
  to: string;
}) {
  const toneClass =
    tone === "danger" ? "text-destructive" : tone === "success" ? "text-status-done" : "text-foreground";
  return (
    <Link
      to={to}
      className="group rounded-xl border border-border bg-card p-4 shadow-elegant transition hover:-translate-y-0.5 hover:shadow-pop"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</div>
    </Link>
  );
}

function EmptyProjects({ onCreate }: { onCreate: () => void }) {
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Working late";
}

function describeActivity(a: ActivityRow): string {
  const taskRef = a.taskTitle ? `"${a.taskTitle}"` : "a task";
  if (a.action === "created") return `created ${taskRef}`;
  if (a.action === "deleted") return `deleted ${taskRef}`;
  if (a.action === "updated" && a.changes) {
    const k = Object.keys(a.changes)[0];
    if (!k) return `updated ${taskRef}`;
    const ch = (a.changes as Record<string, { to?: unknown }>)[k];
    const to = ch?.to;
    return `set ${k.replace(/_/g, " ")} on ${taskRef} to ${String(to ?? "—")}`;
  }
  return `${a.action} ${taskRef}`;
}
