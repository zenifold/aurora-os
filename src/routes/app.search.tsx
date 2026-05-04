import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon, X, Folder, CheckSquare, MessageSquare } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useEffect, useMemo, useState } from "react";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  type: fallback(z.enum(["all", "task", "project", "comment"]), "all").default("all"),
});

export const Route = createFileRoute("/app/search")({
  validateSearch: zodValidator(searchSchema),
  component: SearchPage,
});

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-primary/20 px-0.5 text-foreground">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function SearchPage() {
  const { q, type } = Route.useSearch();
  const navigate = useNavigate();
  const ws = useWorkspaceStore((s) => s.current);
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);
  const [input, setInput] = useState(q);

  useEffect(() => setInput(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (input !== q) navigate({ to: "/app/search", search: (prev) => ({ ...prev, q: input }) });
    }, 200);
    return () => clearTimeout(t);
  }, [input, q, navigate]);

  const enabled = !!ws && q.trim().length > 0;
  const term = `%${q.trim()}%`;

  const { data: tasks = [], isFetching: lt } = useQuery({
    queryKey: ["search-tasks", ws?.id, q],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, project_id, status")
        .eq("workspace_id", ws!.id)
        .ilike("title", term)
        .limit(25);
      return data ?? [];
    },
  });

  const { data: projects = [], isFetching: lp } = useQuery({
    queryKey: ["search-projects", ws?.id, q],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, color, description")
        .eq("workspace_id", ws!.id)
        .ilike("name", term)
        .limit(15);
      return data ?? [];
    },
  });

  const { data: comments = [], isFetching: lc } = useQuery({
    queryKey: ["search-comments", ws?.id, q],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("id, task_id, content, created_at")
        .eq("workspace_id", ws!.id)
        .textSearch("content", q, { type: "websearch", config: "english" })
        .limit(15)
        .then(async (res) => {
          // textSearch on jsonb may fail — fall back to empty
          if (res.error) return { data: [] as typeof res.data };
          return res;
        });
      return data ?? [];
    },
  });

  const total = tasks.length + projects.length + comments.length;
  const fetching = lt || lp || lc;

  const showTasks = type === "all" || type === "task";
  const showProjects = type === "all" || type === "project";
  const showComments = type === "all" || type === "comment";

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background p-6">
        <div className="relative mx-auto max-w-3xl">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            placeholder="Search tasks, projects, comments…"
            className="h-11 pl-9 pr-9 text-base"
          />
          {input && (
            <button
              onClick={() => setInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mx-auto mt-3 flex max-w-3xl items-center gap-1">
          {(["all", "task", "project", "comment"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={type === t ? "secondary" : "ghost"}
              onClick={() => navigate({ to: "/app/search", search: (prev) => ({ ...prev, type: t }) })}
              className="h-7 text-xs capitalize"
            >
              {t === "all" ? "All" : `${t}s`}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-3xl">
          {!q.trim() ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <SearchIcon className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h2 className="text-lg font-medium">Search your workspace</h2>
              <p className="mt-1 text-sm text-muted-foreground">Find tasks, projects, and comments instantly.</p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-xs text-muted-foreground">
                {fetching ? "Searching…" : `${total} result${total === 1 ? "" : "s"} for "${q}"`}
              </p>

              {showTasks && tasks.length > 0 && (
                <Section title={`Tasks (${tasks.length})`}>
                  {tasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        navigate({ to: "/app/p/$projectId", params: { projectId: t.project_id } });
                        setTimeout(() => setSelectedTaskId(t.id), 100);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent"
                    >
                      <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{highlight(t.title, q)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {projectsById.get(t.project_id)?.name ?? "Project"} · {t.status}
                        </p>
                      </div>
                    </button>
                  ))}
                </Section>
              )}

              {showProjects && projects.length > 0 && (
                <Section title={`Projects (${projects.length})`}>
                  {projects.map((p) => (
                    <Link
                      key={p.id}
                      to="/app/p/$projectId"
                      params={{ projectId: p.id }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent"
                    >
                      <Folder className="h-4 w-4 shrink-0" style={{ color: p.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{highlight(p.name, q)}</p>
                        {p.description && <p className="truncate text-xs text-muted-foreground">{p.description}</p>}
                      </div>
                    </Link>
                  ))}
                </Section>
              )}

              {showComments && comments.length > 0 && (
                <Section title={`Comments (${comments.length})`}>
                  {comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-accent">
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {JSON.stringify(c.content).slice(0, 200)}
                        </p>
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              {!fetching && total === 0 && (
                <div className="py-16 text-center">
                  <p className="text-sm font-medium">No results for "{q}"</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try different keywords.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="overflow-hidden rounded-lg border border-border bg-card">{children}</div>
    </section>
  );
}
