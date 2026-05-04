import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { Task } from "@/lib/types";
import { STATUS_OPTIONS } from "@/lib/types";
import { format, isPast, parseISO } from "date-fns";
import { CheckCircle2, Inbox } from "lucide-react";

export const Route = createFileRoute("/app/my-tasks")({
  component: MyTasks,
});

function MyTasks() {
  const { user } = useAuth();
  const ws = useWorkspaceStore((s) => s.current);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["my-tasks", ws?.id, user?.id],
    enabled: !!user && !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", ws!.id)
        .contains("assignee_ids", [user!.id])
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aura-gradient-subtle">
          <Inbox className="h-5 w-5 text-aura-gradient" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">My tasks</h1>
          <p className="text-sm text-muted-foreground">Everything assigned to you across {ws?.name}.</p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-aura-gradient" />
            <p className="mt-3 font-medium">All clear</p>
            <p className="mt-1 text-sm text-muted-foreground">No tasks assigned to you. Enjoy the calm.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((t) => {
              const status = STATUS_OPTIONS.find((s) => s.value === t.status);
              const overdue = t.due_date && isPast(parseISO(t.due_date)) && t.status !== "done";
              return (
                <li key={t.id}>
                  <Link
                    to="/app/p/$projectId"
                    params={{ projectId: t.project_id }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: status?.color ?? "var(--status-todo)" }}
                    />
                    <span className="flex-1 truncate text-sm">{t.title}</span>
                    {t.due_date && (
                      <span className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                        {format(parseISO(t.due_date), "MMM d")}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
