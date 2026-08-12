import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search as SearchIcon,
  X,
  Folder,
  CheckSquare,
  StickyNote,
  FileText,
  FolderTree,
  User,
  MessageSquare,
  Mic,
} from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { pushRecent } from "@/lib/recents";
import { useEffect, useMemo, useState } from "react";

const TYPES = [
  "all",
  "task",
  "project",
  "note",
  "page",
  "folder",
  "contact",
  "comment",
  "meeting",
] as const;
type SearchType = (typeof TYPES)[number];

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  type: fallback(z.enum(TYPES), "all").default("all"),
  project: fallback(z.string().optional(), undefined).optional(),
});

export const Route = createFileRoute("/app/search")({
  validateSearch: zodValidator(searchSchema),
  component: SearchPage,
});

type SearchKind =
  | "task"
  | "project"
  | "note"
  | "page"
  | "folder"
  | "contact"
  | "comment"
  | "meeting";

type SearchRow = {
  kind: SearchKind;
  id: string;
  title: string;
  snippet: string;
  project_id: string | null;
  rank: number;
};

function highlight(text: string, q: string) {
  if (!q || !text) return text;
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

const ICONS: Record<SearchKind, React.ComponentType<{ className?: string }>> = {
  task: CheckSquare,
  project: Folder,
  note: StickyNote,
  page: FileText,
  folder: FolderTree,
  contact: User,
  comment: MessageSquare,
  meeting: Mic,
};

function SearchPage() {
  const { q, type, project } = Route.useSearch();
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

  const { data: projectsList = [] } = useQuery({
    queryKey: ["search-projects", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false)
        .order("name");
      return data ?? [];
    },
  });

  const enabled = !!ws && q.trim().length > 0;

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["global-search", ws?.id, q, project ?? null],
    enabled,
    queryFn: async (): Promise<SearchRow[]> => {
      const { data, error } = await supabase.rpc("global_search", {
        _workspace_id: ws!.id,
        _q: q.trim(),
        _limit: 30,
        _project_id: project ?? null,
      });
      if (error) throw error;
      return (data ?? []) as SearchRow[];
    },
  });

  const grouped = useMemo(() => {
    const m = new Map<SearchRow["kind"], SearchRow[]>();
    for (const r of rows) {
      if (type !== "all" && r.kind !== type) continue;
      const arr = m.get(r.kind) ?? [];
      arr.push(r);
      m.set(r.kind, arr);
    }
    return m;
  }, [rows, type]);

  const total = useMemo(
    () => Array.from(grouped.values()).reduce((n, a) => n + a.length, 0),
    [grouped],
  );

  const handleSelect = (r: SearchRow) => {
    if (r.kind !== "comment" && r.kind !== "meeting") {
      pushRecent(ws?.id, {
        kind: r.kind,
        id: r.id,
        label: r.title,
        meta: { project_id: r.project_id ?? undefined },
      });
    }
    if ((r.kind === "task" || r.kind === "comment") && r.project_id) {
      navigate({ to: "/app/p/$projectId", params: { projectId: r.project_id } });
      setTimeout(() => setSelectedTaskId(r.id), 100);
    } else if (r.kind === "project") {
      navigate({ to: "/app/p/$projectId", params: { projectId: r.id } });
    } else if (r.kind === "folder") {
      navigate({ to: "/app/clients" });

    } else if (r.kind === "contact") {
      navigate({ to: "/app/clients" });
    } else if (r.kind === "note") {
      navigate({ to: "/app/notes", search: { archived: false, project: undefined } });
    } else if (r.kind === "page") {
      navigate({ to: "/app/pages" });
    } else if (r.kind === "meeting") {
      navigate({ to: "/app/meetings/$meetingId", params: { meetingId: r.id } });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background p-6">
        <div className="relative mx-auto max-w-3xl">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            placeholder="Search tasks, projects, notes, pages, folders, contacts…"
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
        <div className="mx-auto mt-3 flex max-w-3xl flex-wrap items-center gap-1">
          {TYPES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={type === t ? "secondary" : "ghost"}
              onClick={() => navigate({ to: "/app/search", search: (prev) => ({ ...prev, type: t as SearchType }) })}
              className="h-7 text-xs capitalize"
            >
              {t === "all" ? "All" : `${t}s`}
            </Button>
          ))}
        </div>
        <div className="mx-auto mt-2 flex max-w-3xl flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Scope</span>
          <select
            value={project ?? ""}
            onChange={(e) =>
              navigate({
                to: "/app/search",
                search: (prev) => ({ ...prev, project: e.target.value || undefined }),
              })
            }
            className="h-7 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Entire workspace</option>
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {project && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() =>
                navigate({ to: "/app/search", search: (prev) => ({ ...prev, project: undefined }) })
              }
            >
              <X className="mr-1 h-3 w-3" /> Clear scope
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-3xl">
          {!q.trim() ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <SearchIcon className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h2 className="text-lg font-medium">Search your workspace</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Find tasks, projects, notes, pages, folders, and contacts instantly.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-xs text-muted-foreground">
                {isFetching ? "Searching…" : `${total} result${total === 1 ? "" : "s"} for "${q}"`}
              </p>

              {Array.from(grouped.entries()).map(([kind, items]) => {
                const Icon = ICONS[kind];
                return (
                  <Section key={kind} title={`${kind.charAt(0).toUpperCase() + kind.slice(1)}s (${items.length})`}>
                    {items.map((r) => (
                      <button
                        key={`${r.kind}:${r.id}`}
                        onClick={() => handleSelect(r)}
                        className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent"
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{highlight(r.title || "Untitled", q)}</p>
                          {r.snippet && (
                            <p className="line-clamp-1 text-xs text-muted-foreground">{highlight(r.snippet, q)}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </Section>
                );
              })}

              {!isFetching && total === 0 && (
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

