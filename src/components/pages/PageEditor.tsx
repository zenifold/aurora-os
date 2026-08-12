import { useEffect, useRef, useState } from "react";
import { confirmDialog, promptDialog } from "@/lib/dialogs";
import { useServerFn } from "@tanstack/react-start";
import { PageRichEditor } from "@/components/pages/PageRichEditor";
import { CanvasEditor, type CanvasScene } from "@/components/pages/CanvasEditor";
import { PlanEditor } from "@/components/pages/PlanEditor";
import type { PlanContent } from "@/lib/plan-types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, History, Loader2, Pin, PinOff, Sparkles, Trash2, BookmarkPlus, FolderIcon, ListTodo, Globe, MoreHorizontal, ShieldCheck, Share2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PAGE_TYPES, type Page } from "@/lib/page-types";
import { useUpdatePage, useDeletePage, useCreatePage } from "@/hooks/use-pages";
import { updateProjectJournal } from "@/server/journal.functions";
import { enhancePage, pageToTasks } from "@/server/page-ai.functions";
import { saveDocVersion } from "@/server/page-doc-ai.functions";
import { PageAiPanel } from "@/components/pages/PageAiPanel";
import { PageVersionsDrawer } from "@/components/pages/PageVersionsDrawer";
import { BacklinksPanel } from "@/components/pages/BacklinksPanel";
import { BlockAttributionPanel } from "@/components/pages/BlockAttributionPanel";
import { PageCoverBand } from "@/components/pages/PageCoverBand";
import { PageMetaFooter } from "@/components/pages/PageMetaFooter";
import { PageTocRail } from "@/components/pages/PageTocRail";
import { useRebuildPageLinks, useSetPortalPublished } from "@/hooks/use-pages-extra";
import { PresenceStack } from "@/components/app/PresenceStack";
import { usePresence } from "@/hooks/use-presence";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/use-profile";
import { useProjects } from "@/hooks/use-projects";
import { useFolders } from "@/hooks/use-folders";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  page: Page;
  onClose?: () => void;
}

export function PageEditor({ page, onClose }: Props) {
  const update = useUpdatePage();
  const del = useDeletePage();
  const createPage = useCreatePage();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [isEditing, setIsEditing] = useState(false);
  const { users: viewers } = usePresence(`presence:page:${page.id}`, {
    display_name: profile?.display_name ?? user?.email?.split("@")[0],
    avatar_url: profile?.avatar_url ?? null,
    is_editing: isEditing,
  });
  const runJournal = useServerFn(updateProjectJournal);
  const enhanceFn = useServerFn(enhancePage);
  const toTasksFn = useServerFn(pageToTasks);
  const saveVersionFn = useServerFn(saveDocVersion);
  const [title, setTitle] = useState(page.title);
  const [icon, setIcon] = useState(page.icon ?? "");
  const [updatingJournal, setUpdatingJournal] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [attribOpen, setAttribOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsRefresh, setVersionsRefresh] = useState(0);
  const rebuildLinks = useRebuildPageLinks();
  const setPublished = useSetPortalPublished();
  const linkRebuildRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (versionDebounceRef.current) clearTimeout(versionDebounceRef.current);
    if (editingTimerRef.current) clearTimeout(editingTimerRef.current);
  }, []);

  const snapshotVersion = (nextTitle: string, nextContent: unknown) => {
    if (versionDebounceRef.current) clearTimeout(versionDebounceRef.current);
    versionDebounceRef.current = setTimeout(() => {
      saveVersionFn({
        data: {
          page_id: page.id,
          title: nextTitle || "Untitled",
          content: nextContent ?? { type: "doc", content: [] },
        },
      }).catch(() => {});
    }, 8000);
  };

  const flagEditing = () => {
    setIsEditing(true);
    if (editingTimerRef.current) clearTimeout(editingTimerRef.current);
    editingTimerRef.current = setTimeout(() => setIsEditing(false), 3000);
  };

  const handleAi = async (action: "improve" | "summarize" | "continue" | "to_tasks", selection: string) => {
    if (action === "to_tasks") {
      const r = await toTasksFn({ data: { page_id: page.id, selection_text: selection } });
      if ("error" in r && r.error) toast.error(r.error);
      else toast.success(`Created ${r.created ?? 0} task(s)`);
      return;
    }
    const r = await enhanceFn({ data: { page_id: page.id, action, selection_text: selection } });
    if ("error" in r && r.error) {
      toast.error(r.error);
      return;
    }
    if ("nodes" in r && r.nodes && r.nodes.length) {
      const cur = (page.content as { type?: string; content?: unknown[] } | null) ?? { type: "doc", content: [] };
      const merged = { type: "doc", content: [...(cur.content ?? []), ...r.nodes] };
      update.mutate({ id: page.id, content: merged });
      toast.success("AI added content");
    }
  };

  useEffect(() => {
    setTitle(page.title);
    setIcon(page.icon ?? "");
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = PAGE_TYPES.find((t) => t.value === page.page_type);

  const saveTitle = () => {
    if (title !== page.title) {
      flagEditing();
      update.mutate({ id: page.id, title: title || "Untitled" });
    }
  };
  const saveIcon = (next: string) => {
    setIcon(next);
    flagEditing();
    update.mutate({ id: page.id, icon: next || null });
  };
  const saveContent = (json: unknown) => {
    flagEditing();
    update.mutate({ id: page.id, content: json });
    snapshotVersion(title, json);
    // Debounced rebuild of page_links (graph index)
    if (linkRebuildRef.current) clearTimeout(linkRebuildRef.current);
    linkRebuildRef.current = setTimeout(() => {
      rebuildLinks.mutate(page.id);
    }, 4000);
  };
  useEffect(() => () => {
    if (linkRebuildRef.current) clearTimeout(linkRebuildRef.current);
  }, []);

  return (
    <div className="flex h-full">
      <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 lg:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary" className="gap-1">
            <span>{meta?.icon}</span>
            <span className="hidden sm:inline">{meta?.label}</span>
          </Badge>
          <ContextBadge page={page} />
          {page.ai_managed && (
            <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
              <Sparkles className="h-3 w-3" /> <span className="hidden sm:inline">AI-managed</span>
            </Badge>
          )}
          <span className="hidden truncate xl:inline">Updated {formatDistanceToNow(new Date(page.updated_at), { addSuffix: true })}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {viewers.length > 0 && (
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-2 py-0.5 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="hidden text-[11px] font-medium text-muted-foreground md:inline">
                {viewers.length === 1 ? "1 here" : `${viewers.length} here`}
              </span>
              <PresenceStack users={viewers} max={3} />
            </div>
          )}
          {page.page_type === "journal" && page.scope === "project" && page.scope_id && (
            <Button
              size="sm"
              variant="outline"
              className="hidden h-8 gap-1.5 md:inline-flex"
              disabled={updatingJournal}
              onClick={async () => {
                setUpdatingJournal(true);
                try {
                  const r = await runJournal({ data: { project_id: page.scope_id!, page_id: page.id } });
                  if ("error" in r && r.error) toast.error(r.error);
                  else toast.success("Journal updated");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setUpdatingJournal(false);
                }
              }}
            >
              {updatingJournal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
              Update journal
            </Button>
          )}
          {/* Primary actions — always visible */}
          <Button
            size="icon"
            variant={aiOpen ? "default" : "ghost"}
            className="h-8 w-8"
            title="Document AI"
            onClick={() => setAiOpen((v) => !v)}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={attribOpen ? "default" : "ghost"}
            className="h-8 w-8"
            title="AI attribution"
            onClick={() => setAttribOpen((v) => !v)}
          >
            <ShieldCheck className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={page.is_portal_published ? "default" : "ghost"}
            className="h-8 w-8"
            title={page.is_portal_published ? "Published to client portal — click to unpublish" : "Publish to client portal"}
            onClick={() =>
              setPublished.mutate({ page_id: page.id, published: !page.is_portal_published })
            }
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Versions" onClick={() => setVersionsOpen(true)}>
            <History className="h-4 w-4" />
          </Button>
          {/* Secondary actions — visible on lg, collapsed into menu below */}
          <Button
            size="icon"
            variant="ghost"
            className="hidden h-8 w-8 lg:inline-flex"
            title={page.is_pinned ? "Unpin" : "Pin"}
            onClick={() => update.mutate({ id: page.id, is_pinned: !page.is_pinned })}
          >
            {page.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="hidden h-8 w-8 lg:inline-flex"
            title="Save as template"
            onClick={async () => {
              const name = await promptDialog({
                title: "Save as template",
                description: "This template will be available across the workspace.",
                defaultValue: page.title || "My template",
                placeholder: "Template name",
                confirmLabel: "Save template",
                required: true,
              });
              if (!name) return;
              const tpl = await createPage.mutateAsync({
                scope: "workspace",
                page_type: page.page_type,
                title: name,
                icon: page.icon ?? undefined,
                content: page.content,
              });
              await update.mutateAsync({ id: tpl.id, is_template: true });
              toast.success("Saved as template");
            }}
          >
            <BookmarkPlus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="hidden h-8 w-8 lg:inline-flex"
            title={page.is_archived ? "Unarchive" : "Archive"}
            onClick={() => update.mutate({ id: page.id, is_archived: !page.is_archived })}
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="hidden h-8 w-8 text-destructive hover:text-destructive lg:inline-flex"
            title="Delete page"
            onClick={async () => {
              const ok = await confirmDialog({
                title: "Delete this page?",
                description: "This cannot be undone. Subpages will be deleted too.",
                confirmLabel: "Delete",
                tone: "destructive",
              });
              if (!ok) return;
              await del.mutateAsync(page.id);
              toast.success("Page deleted");
              onClose?.();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {/* Overflow menu for small/medium screens */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 lg:hidden" title="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {page.page_type === "journal" && page.scope === "project" && page.scope_id && (
                <>
                  <DropdownMenuItem
                    disabled={updatingJournal}
                    onClick={async () => {
                      setUpdatingJournal(true);
                      try {
                        const r = await runJournal({ data: { project_id: page.scope_id!, page_id: page.id } });
                        if ("error" in r && r.error) toast.error(r.error);
                        else toast.success("Journal updated");
                      } finally {
                        setUpdatingJournal(false);
                      }
                    }}
                  >
                    <Sparkles className="mr-2 h-4 w-4 text-primary" /> Update journal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => update.mutate({ id: page.id, is_pinned: !page.is_pinned })}>
                {page.is_pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                {page.is_pinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  const name = await promptDialog({
                    title: "Save as template",
                    description: "This template will be available across the workspace.",
                    defaultValue: page.title || "My template",
                    placeholder: "Template name",
                    confirmLabel: "Save template",
                    required: true,
                  });
                  if (!name) return;
                  const tpl = await createPage.mutateAsync({
                    scope: "workspace",
                    page_type: page.page_type,
                    title: name,
                    icon: page.icon ?? undefined,
                    content: page.content,
                  });
                  await update.mutateAsync({ id: tpl.id, is_template: true });
                  toast.success("Saved as template");
                }}
              >
                <BookmarkPlus className="mr-2 h-4 w-4" /> Save as template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => update.mutate({ id: page.id, is_archived: !page.is_archived })}>
                <Archive className="mr-2 h-4 w-4" /> {page.is_archived ? "Unarchive" : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: "Delete this page?",
                    description: "This cannot be undone. Subpages will be deleted too.",
                    confirmLabel: "Delete",
                    tone: "destructive",
                  });
                  if (!ok) return;
                  await del.mutateAsync(page.id);
                  toast.success("Page deleted");
                  onClose?.();
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete page
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto">
        <PageCoverBand page={page} />
        <div className="mx-auto -mt-12 w-full max-w-3xl px-4 pb-10 lg:px-8">
          <div className="mb-6 flex items-end gap-3">
            <div className="group relative">
              <input
                value={icon}
                onChange={(e) => saveIcon(e.target.value.slice(0, 4))}
                placeholder="📄"
                className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-card text-center text-4xl shadow-sm outline-none transition-all hover:scale-105 hover:shadow-md focus:ring-2 focus:ring-primary/40"
                aria-label="Page icon"
              />
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              className="h-auto border-0 bg-transparent px-0 pb-1 text-4xl font-bold leading-tight tracking-tight shadow-none focus-visible:ring-0"
              placeholder="Untitled"
            />
          </div>
          {page.page_type === "canvas" ? (
            <CanvasEditor
              key={page.id}
              pageId={page.id}
              initial={(page.content as CanvasScene | null) ?? null}
              onChange={(scene: CanvasScene) => saveContent(scene)}
            />
          ) : page.page_type === "plan" ? (
            <PlanEditor
              key={page.id}
              initial={page.content}
              onChange={(plan: PlanContent) => saveContent(plan)}
            />
          ) : (
            <>
              <PageRichEditor
                key={page.id}
                content={page.content}
                onChange={(json) => {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  debounceRef.current = setTimeout(() => saveContent(json), 700);
                }}
                onAiAction={handleAi}
                placeholder="Start writing, or type / for commands…"
                defaultProjectId={page.scope === "project" ? page.scope_id : null}
                pageScope={page.scope === "project" ? "project" : "workspace"}
                pageScopeId={page.scope === "project" ? page.scope_id : null}
              />
              <PageMetaFooter page={page} />
              <BacklinksPanel pageId={page.id} />
            </>
          )}
        </div>
      </div>
      </div>
      {page.page_type !== "canvas" && page.page_type !== "plan" && !aiOpen && !attribOpen && (
        <PageTocRail content={page.content} scrollContainerRef={scrollRef} />
      )}
      {aiOpen && (
        <div className="hidden h-full w-[360px] shrink-0 lg:block">
          <PageAiPanel
            page={page}
            onClose={() => setAiOpen(false)}
            onApplyContent={({ title: nt, content }) => {
              if (nt) setTitle(nt);
              update.mutate({ id: page.id, title: nt ?? title, content });
            }}
            onVersionsChanged={() => setVersionsRefresh((n) => n + 1)}
          />
        </div>
      )}
      {attribOpen && (
        <div className="hidden h-full w-[320px] shrink-0 lg:block">
          <BlockAttributionPanel pageId={page.id} />
        </div>
      )}
      <PageVersionsDrawer
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        pageId={page.id}
        refreshKey={versionsRefresh}
        onRestored={() => setVersionsRefresh((n) => n + 1)}
      />
    </div>
  );
}

function ContextBadge({ page }: { page: Page }) {
  const { data: projects = [] } = useProjects();
  const { data: folders = [] } = useFolders();
  if (page.scope === "workspace" || !page.scope_id) {
    return (
      <Badge variant="outline" className="gap-1">
        <Globe className="h-3 w-3" /> Workspace
      </Badge>
    );
  }
  if (page.scope === "project") {
    const proj = projects.find((p) => p.id === page.scope_id);
    return (
      <Badge variant="outline" className="gap-1">
        <span className="h-2 w-2 rounded-sm" style={{ background: proj?.color ?? "hsl(var(--primary))" }} />
        {proj?.name ?? "Project"}
      </Badge>
    );
  }
  if (page.scope === "folder") {
    const f = folders.find((x) => x.id === page.scope_id);
    return (
      <Badge variant="outline" className="gap-1">
        <FolderIcon className="h-3 w-3" /> {f?.name ?? "Folder"}
      </Badge>
    );
  }
  if (page.scope === "task") {
    return (
      <Badge variant="outline" className="gap-1">
        <ListTodo className="h-3 w-3" /> Task
      </Badge>
    );
  }
  return null;
}
