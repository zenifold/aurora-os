import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, LayoutGrid, List as ListIcon, Pin, Archive, FileText, ListChecks, List as BulletIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNotes, useCreateNote } from "@/hooks/use-notes";
import { NoteCard } from "@/components/notes/NoteCard";
import { NoteEditorDialog } from "@/components/notes/NoteEditorDialog";
import { CardGridSkeleton } from "@/components/ui/loading-scaffolds";
import { docPreview } from "@/components/notes/NoteEditor";
import type { Note, NoteType } from "@/lib/types";

type FilterType = "all" | NoteType | "pinned";

export const Route = createFileRoute("/app/notes")({
  validateSearch: (s: Record<string, unknown>) => ({
    archived: s.archived === true || s.archived === "true",
    project: typeof s.project === "string" ? s.project : undefined,
  }),
  component: NotesPage,
});

function NotesPage() {
  const { archived, project } = Route.useSearch();
  const { data: notes = [], isLoading } = useNotes({ archived, projectId: project ?? null });
  const create = useCreateNote();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<Note | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (filter === "pinned" && !n.is_pinned) return false;
      if (filter !== "all" && filter !== "pinned" && n.note_type !== filter) return false;
      if (!q) return true;
      const hay = `${n.title ?? ""} ${docPreview(n.content, 1000)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notes, filter, search]);

  const pinned = filtered.filter((n) => n.is_pinned);
  const others = filtered.filter((n) => !n.is_pinned);

  const handleCreate = async (note_type: NoteType = "freeform") => {
    const created = await create.mutateAsync({ note_type, project_id: project ?? null });
    setSelected(created);
    setOpen(true);
  };

  const openNote = (n: Note) => {
    setSelected(n);
    setOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-6">
      {/* Header */}
      <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="flex items-center justify-between gap-2 sm:block">
          <div>
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              {archived ? "Archived notes" : "Notes"}
            </h1>
            <p className="text-[11px] text-muted-foreground sm:text-xs">
              {filtered.length} {filtered.length === 1 ? "note" : "notes"}
            </p>
          </div>
          {/* Mobile-only New button (in header row) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-aura-gradient hover:opacity-90 sm:hidden">
                <Plus className="mr-1 h-3.5 w-3.5" /> New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCreate("freeform")}>
                <FileText className="mr-2 h-3.5 w-3.5" /> Freeform note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreate("bullet_list")}>
                <BulletIcon className="mr-2 h-3.5 w-3.5" /> Bullet list
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreate("check_list")}>
                <ListChecks className="mr-2 h-3.5 w-3.5" /> Check list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes"
              className="h-9 w-full pl-7 text-sm sm:h-8 sm:w-48"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="hidden items-center rounded-md border border-border bg-background p-0.5 sm:inline-flex">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "rounded p-1.5 transition-colors",
                view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "rounded p-1.5 transition-colors",
                view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="List view"
            >
              <ListIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="hidden bg-aura-gradient hover:opacity-90 sm:inline-flex">
                <Plus className="mr-1 h-3.5 w-3.5" /> New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCreate("freeform")}>
                <FileText className="mr-2 h-3.5 w-3.5" /> Freeform note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreate("bullet_list")}>
                <BulletIcon className="mr-2 h-3.5 w-3.5" /> Bullet list
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreate("check_list")}>
                <ListChecks className="mr-2 h-3.5 w-3.5" /> Check list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter chips — horizontally scrollable on mobile */}
      <div className="mb-4 -mx-3 flex items-center gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {(
          [
            { id: "all", label: "All" },
            { id: "freeform", label: "Freeform" },
            { id: "check_list", label: "Check list" },
            { id: "bullet_list", label: "Bullet list" },
            { id: "pinned", label: "Pinned" },
          ] as { id: FilterType; label: string }[]
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
              filter === f.id
                ? "border-transparent bg-aura-gradient text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-aura-gradient-subtle">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold">
            {archived ? "No archived notes" : "Jot down ideas, lists, and thoughts"}
          </h3>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">
            {archived ? "Archived notes will appear here." : "Notes are pre-tasks. Convert them later."}
          </p>
          {!archived && (
            <Button size="sm" className="bg-aura-gradient hover:opacity-90" onClick={() => handleCreate("freeform")}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Create your first note
            </Button>
          )}
        </div>
      )}

      {!isLoading && pinned.length > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Pin className="h-3 w-3" /> Pinned
          </div>
          <NoteGrid notes={pinned} view={view} onClick={openNote} />
        </section>
      )}

      {!isLoading && others.length > 0 && (
        <section>
          {pinned.length > 0 && (
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Archive className="h-3 w-3" /> Others
            </div>
          )}
          <NoteGrid notes={others} view={view} onClick={openNote} />
        </section>
      )}

      <NoteEditorDialog note={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NoteGrid({ notes, view, onClick }: { notes: Note[]; view: "grid" | "list"; onClick: (n: Note) => void }) {
  if (view === "list") {
    return (
      <div className="space-y-2">
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} onClick={() => onClick(n)} />
        ))}
      </div>
    );
  }
  return (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4">
      {notes.map((n) => (
        <NoteCard key={n.id} note={n} onClick={() => onClick(n)} />
      ))}
    </div>
  );
}
