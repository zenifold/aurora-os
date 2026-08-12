import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, Pin, Sparkles, Wand2, Loader2, Menu, ArrowLeft, FolderTree, List as ListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { usePages, useCreatePage, useUpdatePage, useDeletePage } from "@/hooks/use-pages";
import { PAGE_TYPES, type Page, type PageType } from "@/lib/page-types";
import { PAGE_TEMPLATES, type PageTemplate } from "@/lib/page-templates";
import { PageEditor } from "@/components/pages/PageEditor";
import { PageTreeSidebar } from "@/components/pages/PageTreeSidebar";
import {
  PageDestinationPicker,
  DEFAULT_PAGE_DESTINATION,
  type PageDestination,
} from "@/components/pages/PageDestinationPicker";
import { CardGridSkeleton } from "@/components/ui/loading-scaffolds";
import { generatePage } from "@/server/page-ai.functions";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useIsMobile } from "@/hooks/use-mobile-breakpoint";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type PagesSearch = { p?: string };
export const Route = createFileRoute("/app/pages")({
  validateSearch: (s: Record<string, unknown>): PagesSearch =>
    typeof s.p === "string" ? { p: s.p } : {},
  component: PagesScreen,
});

function PagesScreen() {
  const { data: pages = [], isLoading } = usePages({ archived: false });
  const create = useCreatePage();
  const updatePage = useUpdatePage();
  const deletePage = useDeletePage();
  const [search, setSearch] = useState("");
  const { p: searchPageId } = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(searchPageId ?? null);
  useEffect(() => {
    if (searchPageId && searchPageId !== selectedId) setSelectedId(searchPageId);
  }, [searchPageId]);
  const [filter, setFilter] = useState<"all" | PageType | "pinned">("all");
  const [view, setView] = useState<"tree" | "list">("tree");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const [moveConfirm, setMoveConfirm] = useState<{
    id: string;
    parentId: string | null;
    movingTitle: string;
    fromLabel: string;
    toLabel: string;
    targetScope: Page["scope"];
    targetScopeId: string | null;
  } | null>(null);

  // New-page dialog state
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<PageType>("doc");
  const [newTemplateId, setNewTemplateId] = useState<string>("blank");
  const [destination, setDestination] = useState<PageDestination>(DEFAULT_PAGE_DESTINATION);

  const filtered = useMemo(() => {
    let list = pages;
    if (filter === "pinned") list = list.filter((p) => p.is_pinned);
    else if (filter !== "all") list = list.filter((p) => p.page_type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(q) || p.content_text.toLowerCase().includes(q),
      );
    }
    return list;
  }, [pages, search, filter]);

  const selected = pages.find((p) => p.id === selectedId) ?? null;

  const ws = useWorkspaceStore((s) => s.current);
  const generateFn = useServerFn(generatePage);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const openNewDialog = (type: PageType, templateId?: string) => {
    setNewType(type);
    setNewTemplateId(templateId ?? "blank");
    const tpl = templateId ? PAGE_TEMPLATES.find((t) => t.id === templateId) : undefined;
    setNewTitle(tpl?.label ?? "");
    setDestination((d) => d ?? DEFAULT_PAGE_DESTINATION);
    setNewOpen(true);
  };

  const submitNew = async () => {
    const tpl = newTemplateId !== "blank" ? PAGE_TEMPLATES.find((t) => t.id === newTemplateId) : undefined;
    const meta = PAGE_TYPES.find((t) => t.value === (tpl?.page_type ?? newType));
    const p = await create.mutateAsync({
      page_type: tpl?.page_type ?? newType,
      icon: tpl?.icon ?? meta?.icon,
      title: newTitle.trim() || tpl?.label || meta?.label || "Untitled",
      scope: destination.scope,
      scope_id: destination.scope_id,
      parent_page_id: destination.parent_page_id,
      content: tpl?.content,
    });
    setSelectedId(p.id);
    setMobileNavOpen(false);
    setNewOpen(false);
    setNewTitle("");
    setDestination(DEFAULT_PAGE_DESTINATION);
    toast.success(`Created in ${destination.label}`);
  };

  const generateFromAi = async () => {
    if (!ws || !aiPrompt.trim()) return;
    setAiBusy(true);
    try {
      const r = await generateFn({
        data: {
          workspace_id: ws.id,
          scope: destination.scope,
          scope_id: destination.scope_id ?? undefined,
          prompt: aiPrompt.trim(),
          page_type: "doc",
        } as never,
      });
      if ("error" in r && r.error) toast.error(r.error);
      else if ("page" in r && r.page) {
        toast.success("Page generated");
        setSelectedId((r.page as Page).id);
        setAiOpen(false);
        setAiPrompt("");
      }
    } finally {
      setAiBusy(false);
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <h2 className="flex-1 text-sm font-semibold">Pages</h2>
        <Dialog open={aiOpen} onOpenChange={setAiOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Generate page with AI" title="Generate with AI">
              <Wand2 className="h-4 w-4 text-primary" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate page with AI</DialogTitle>
              <DialogDescription>Describe the page and AI will draft it for you.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Save under</Label>
                <PageDestinationPicker value={destination} onChange={setDestination} />
              </div>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. PRD for a new client onboarding flow with 3 stages"
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAiOpen(false)}>Cancel</Button>
              <Button onClick={generateFromAi} disabled={aiBusy || !aiPrompt.trim()}>
                {aiBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button size="icon" variant="ghost" aria-label="New page" onClick={() => openNewDialog("doc")}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages…"
            className="h-8 pl-7 text-sm"
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All pages</SelectItem>
              <SelectItem value="pinned">
                <span className="mr-2">📌</span>Pinned
              </SelectItem>
              {PAGE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <span className="mr-2">{t.icon}</span>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-border">
            <button
              onClick={() => setView("tree")}
              className={cn("inline-flex h-8 items-center px-2 text-xs", view === "tree" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              title="Folder tree"
              aria-label="Folder tree view"
            >
              <FolderTree className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn("inline-flex h-8 items-center px-2 text-xs", view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              title="List"
              aria-label="List view"
            >
              <ListIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-3"><CardGridSkeleton count={4} /></div>
        ) : view === "tree" && !search.trim() && filter === "all" ? (
          <PageTreeSidebar
            pages={pages}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setMobileNavOpen(false);
            }}
            onAddSubpage={async (parentId) => {
              const parent = parentId ? pages.find((p) => p.id === parentId) : null;
              const p = await create.mutateAsync({
                page_type: "doc",
                title: "Untitled",
                scope: parent?.scope ?? "workspace",
                scope_id: parent?.scope_id ?? null,
                parent_page_id: parentId,
              });
              setSelectedId(p.id);
              setMobileNavOpen(false);
            }}
            onDelete={(id) => deletePage.mutate(id)}
            onTogglePin={(p) => updatePage.mutate({ id: p.id, is_pinned: !p.is_pinned })}
            onArchive={(p) => updatePage.mutate({ id: p.id, is_archived: !p.is_archived })}
            onMove={(id, parentId) => {
              const moving = pages.find((p) => p.id === id);
              if (!moving) return;
              const parent = parentId ? pages.find((p) => p.id === parentId) : null;
              const targetScope: Page["scope"] = parent?.scope ?? "workspace";
              const targetScopeId = parent?.scope_id ?? null;
              const crossContext =
                moving.scope !== targetScope || (moving.scope_id ?? null) !== targetScopeId;
              if (crossContext) {
                setMoveConfirm({
                  id,
                  parentId,
                  movingTitle: moving.title || "Untitled",
                  fromLabel: moving.scope === "workspace" ? "Workspace" : `${moving.scope}${moving.scope_id ? "" : ""}`,
                  toLabel: parent ? `${parent.title} (${parent.scope})` : "Workspace (top level)",
                  targetScope,
                  targetScopeId,
                });
                return;
              }
              updatePage.mutate({
                id,
                parent_page_id: parentId,
                scope: targetScope,
                scope_id: targetScopeId,
              });
            }}
          />
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No pages yet</div>
        ) : (
          <ul>
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    setSelectedId(p.id);
                    setMobileNavOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 border-b border-border/50 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                    selected?.id === p.id && "bg-muted",
                  )}
                >
                  <span className="text-base">{p.icon ?? "📄"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate font-medium">{p.title}</span>
                      {p.is_pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
                      {p.ai_managed && <Sparkles className="h-3 w-3 text-primary" />}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.content_text.slice(0, 80) || "Empty"} · {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-72 flex-col border-r border-border md:flex">{sidebar}</aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Pages</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1">
        <div className="flex items-center gap-2 border-b border-border p-2 md:hidden">
          {selected ? (
            <Button size="icon" variant="ghost" aria-label="Back to pages" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" variant="ghost" aria-label="Open pages list" onClick={() => setMobileNavOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex-1 truncate text-left text-sm font-medium"
          >
            {selected ? `${selected.icon ?? "📄"} ${selected.title}` : "Pages"}
          </button>
          <Button size="icon" variant="ghost" aria-label="Browse pages" onClick={() => setMobileNavOpen(true)}>
            <FolderTree className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="New page" onClick={() => openNewDialog("doc")}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {selected ? (
          <PageEditor page={selected} onClose={() => setSelectedId(null)} />
        ) : isMobile ? (
          <div className="h-full">{sidebar}</div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-3xl shadow-sm">
                📄
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">A home for every doc</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                PRDs, decision logs, runbooks, meeting notes — drafted by you or by AI, linked to live project data.
              </p>
            </div>
            <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
              {["prd", "decision_log", "runbook", "kickoff", "sprint_planning", "one_on_one"].map((tplId) => {
                const tpl = PAGE_TEMPLATES.find((t) => t.id === tplId);
                if (!tpl) return null;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => openNewDialog(tpl.page_type, tpl.id)}
                    className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <span className="text-2xl">{tpl.icon}</span>
                    <span className="text-sm font-medium leading-tight">{tpl.label}</span>
                    <span className="text-xs text-muted-foreground">Start from template</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => openNewDialog("doc")}>
                <Plus className="mr-2 h-4 w-4" /> Blank page
              </Button>
              <Button variant="outline" onClick={() => setAiOpen(true)}>
                <Wand2 className="mr-2 h-4 w-4 text-primary" /> Draft with AI
              </Button>
            </div>
          </div>
        )}
      </main>


      {/* New-page dialog with destination picker */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New page</DialogTitle>
            <DialogDescription>Pick a template, name it, and choose where to save it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Untitled"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Template</Label>
                <Select value={newTemplateId} onValueChange={setNewTemplateId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blank">Blank</SelectItem>
                    {PAGE_TEMPLATES.filter((t: PageTemplate) => t.id !== "journal").map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="mr-2">{t.icon}</span>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select
                  value={newType}
                  onValueChange={(v) => setNewType(v as PageType)}
                  disabled={newTemplateId !== "blank"}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="mr-2">{t.icon}</span>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Save under</Label>
              <PageDestinationPicker value={destination} onChange={setDestination} />
              <p className="text-[11px] text-muted-foreground">
                Choose a workspace, project, folder, page section, or task to attach this page to.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={submitNew} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!moveConfirm} onOpenChange={(o) => !o && setMoveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move page to a different context?</AlertDialogTitle>
            <AlertDialogDescription>
              {moveConfirm && (
                <>
                  You are moving <span className="font-medium text-foreground">"{moveConfirm.movingTitle}"</span> from{" "}
                  <span className="font-medium text-foreground">{moveConfirm.fromLabel}</span> into{" "}
                  <span className="font-medium text-foreground">{moveConfirm.toLabel}</span>. The page (and any subpages) will
                  inherit the new project, folder, or section.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!moveConfirm) return;
                updatePage.mutate({
                  id: moveConfirm.id,
                  parent_page_id: moveConfirm.parentId,
                  scope: moveConfirm.targetScope,
                  scope_id: moveConfirm.targetScopeId,
                });
                toast.success("Page moved");
                setMoveConfirm(null);
              }}
            >
              Move page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-xs transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
