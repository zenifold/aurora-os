import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useProjects } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Sparkles,
  ExternalLink,
  Plus,
  Paperclip,
  Loader2,
  CheckCircle2,
  Folder,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

interface PageContext {
  url: string;
  title: string;
  text: string;
  platform: string;
}

interface TaskHit {
  id: string;
  title: string;
  status: string;
  project_id: string;
  project_name?: string;
}
interface ProjectHit {
  id: string;
  name: string;
  color: string;
}

const STOPWORDS = new Set([
  "the","and","for","you","your","with","this","that","are","but","not","from",
  "have","has","was","were","will","can","just","its","into","about","gmail",
  "inbox","reply","fwd","re","new","page","tab",
]);

function buildSearchTerms(ctx: PageContext): string[] {
  const raw = `${ctx.title} ${ctx.text}`.toLowerCase();
  const words = raw
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  // unique, top 5
  return Array.from(new Set(words)).slice(0, 5);
}

export function ContextLens({ context }: { context: PageContext }) {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: projects = [] } = useProjects();
  const [manualQuery, setManualQuery] = useState("");
  const [autoSearch, setAutoSearch] = useState(false);

  const terms = useMemo(() => {
    if (manualQuery.trim()) return buildSearchTerms({ ...context, title: manualQuery, text: "" });
    if (!autoSearch) return [];
    return buildSearchTerms(context);
  }, [context, manualQuery, autoSearch]);

  const { data: results, isLoading } = useQuery({
    queryKey: ["context-lens", ws?.id, terms.join("|")],
    enabled: !!ws && terms.length > 0,
    queryFn: async () => {
      const orFilter = terms.map((t) => `title.ilike.%${t}%`).join(",");
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, project_id")
        .eq("workspace_id", ws!.id)
        .or(orFilter)
        .limit(8);

      const projectFilter = terms.map((t) => `name.ilike.%${t}%`).join(",");
      const { data: projs } = await supabase
        .from("projects")
        .select("id, name, color")
        .eq("workspace_id", ws!.id)
        .or(projectFilter)
        .limit(4);

      return {
        tasks: (tasks ?? []) as TaskHit[],
        projects: (projs ?? []) as ProjectHit[],
      };
    },
  });

  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  const tasks = (results?.tasks ?? []).map((t) => ({
    ...t,
    project_name: projectById.get(t.project_id)?.name,
  }));
  const projectHits = results?.projects ?? [];

  const hasResults = tasks.length > 0 || projectHits.length > 0;
  const showEmpty = terms.length > 0 && !isLoading && !hasResults;

  return (
    <div className="flex h-full flex-col">
      {/* On this page */}
      <div className="space-y-2 border-b border-border px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          On this page
        </p>
        <p className="line-clamp-2 text-sm font-medium">
          {context.title || "Untitled page"}
        </p>
        {context.url && (
          <p className="truncate text-[11px] text-muted-foreground">{context.url}</p>
        )}
        {context.text && (
          <p className="line-clamp-2 rounded border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
            "{context.text.slice(0, 200)}"
          </p>
        )}
      </div>

      {/* Search */}
      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search Aurora…"
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
        {!autoSearch && !manualQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoSearch(true)}
            className="mt-2 h-7 w-full text-xs"
          >
            <Sparkles className="mr-1.5 h-3 w-3 text-primary" />
            Find related work for this page
          </Button>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {tasks.length > 0 && (
          <Section icon={<CheckCircle2 className="h-3 w-3" />} title="Related tasks">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} pageUrl={context.url} pageTitle={context.title} />
            ))}
          </Section>
        )}

        {projectHits.length > 0 && (
          <Section icon={<Folder className="h-3 w-3" />} title="Related projects">
            {projectHits.map((p) => (
              <a
                key={p.id}
                href={`/app/p/${p.id}/overview`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
              >
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ backgroundColor: p.color }}
                />
                <span className="flex-1 truncate">{p.name}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            ))}
          </Section>
        )}

        {showEmpty && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No matches in your workspace.</p>
          </div>
        )}

        {terms.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <Sparkles className="h-6 w-6 text-primary" />
            <p className="text-xs text-muted-foreground">
              Click "Find related" or search above to surface tasks for this page.
            </p>
          </div>
        )}
      </div>

      {/* Quick actions footer */}
      <div className="border-t border-border bg-muted/20 p-2">
        <CreateFromPageButton context={context} />
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-2 py-2">
      <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function TaskRow({
  task,
  pageUrl,
  pageTitle,
}: {
  task: TaskHit;
  pageUrl: string;
  pageTitle: string;
}) {
  const [attaching, setAttaching] = useState(false);
  const [attached, setAttached] = useState(false);

  const handleAttach = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (attaching || attached || !pageUrl) return;
    setAttaching(true);
    try {
      const { data } = await supabase
        .from("tasks")
        .select("description")
        .eq("id", task.id)
        .single();
      const existing = (data?.description as { type?: string; content?: unknown[] } | null) ?? null;
      const newPara = {
        type: "paragraph",
        content: [
          { type: "text", text: "🔗 " },
          {
            type: "text",
            text: pageTitle || pageUrl,
            marks: [{ type: "link", attrs: { href: pageUrl, target: "_blank" } }],
          },
        ],
      };
      const next =
        existing && existing.type === "doc" && Array.isArray(existing.content)
          ? { ...existing, content: [...existing.content, newPara] }
          : { type: "doc", content: [newPara] };
      const { error } = await supabase
        .from("tasks")
        .update({ description: next as never })
        .eq("id", task.id);
      if (error) throw error;
      setAttached(true);
      toast.success("Page attached to task");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to attach");
    } finally {
      setAttaching(false);
    }
  };

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
      <a
        href={`/app/my-tasks?task=${task.id}`}
        target="_blank"
        rel="noreferrer"
        className="flex flex-1 items-center gap-2 truncate text-xs"
      >
        <span className="flex-1 truncate">{task.title}</span>
        {task.project_name && (
          <Badge variant="outline" className="h-4 px-1 text-[9px]">
            {task.project_name}
          </Badge>
        )}
      </a>
      {pageUrl && (
        <button
          onClick={handleAttach}
          disabled={attaching || attached}
          className="opacity-0 transition group-hover:opacity-100 disabled:opacity-100"
          title={attached ? "Attached" : "Attach this page"}
        >
          {attached ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          ) : attaching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          )}
        </button>
      )}
    </div>
  );
}

function CreateFromPageButton({ context }: { context: PageContext }) {
  const params = new URLSearchParams({
    mode: "popup",
    url: context.url,
    title: context.title,
    text: context.text.slice(0, 1000),
  });
  return (
    <Link
      to="/extension-entry"
      search={{
        mode: "popup",
        url: context.url,
        title: context.title,
        text: context.text,
        platform: context.platform,
        token: "",
      }}
      className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-aura-gradient text-xs font-medium text-primary-foreground hover:opacity-90"
      onClick={(e) => {
        e.preventDefault();
        window.location.search = `?${params.toString()}`;
      }}
    >
      <Plus className="h-3.5 w-3.5" />
      Create task from page
    </Link>
  );
}
