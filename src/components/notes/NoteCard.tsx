import { useState } from "react";
import { Pin, MoreHorizontal, Archive, Trash2, ListChecks, List as ListIcon, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { docPreview, checklistProgress } from "./NoteEditor";
import type { Note } from "@/lib/types";
import { useTogglePin, useUpdateNote, useDeleteNote } from "@/hooks/use-notes";

interface NoteCardProps {
  note: Note;
  onClick?: () => void;
}

const TYPE_ICON = {
  freeform: FileText,
  bullet_list: ListIcon,
  check_list: ListChecks,
  sketch: FileText,
};

export function NoteCard({ note, onClick }: NoteCardProps) {
  const togglePin = useTogglePin();
  const update = useUpdateNote();
  const del = useDeleteNote();
  const [menuOpen, setMenuOpen] = useState(false);

  const Icon = TYPE_ICON[note.note_type];
  const preview = docPreview(note.content, 220);
  const progress = note.note_type === "check_list" ? checklistProgress(note.content) : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group break-inside-avoid mb-3 cursor-pointer rounded-2xl border border-slate-200/60 p-3 shadow-sm transition-all hover:shadow-md",
        "text-slate-900",
      )}
      style={{ backgroundColor: note.background_color }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          {note.title && <h3 className="truncate text-sm font-semibold leading-tight">{note.title}</h3>}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePin.mutate(note);
          }}
          className={cn(
            "rounded-md p-1 transition-colors hover:bg-black/5",
            note.is_pinned ? "text-amber-600" : "text-slate-400 lg:opacity-0 lg:group-hover:opacity-100",
          )}
          aria-label={note.is_pinned ? "Unpin" : "Pin"}
        >
          <Pin
            className="h-3.5 w-3.5"
            style={{ transform: note.is_pinned ? "rotate(-15deg)" : undefined }}
            fill={note.is_pinned ? "currentColor" : "none"}
          />
        </button>
      </div>

      {progress && (
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-slate-700">
          <span>
            {progress.done}/{progress.total}
          </span>
          <div className="h-1 w-12 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {preview ? (
        <p className="whitespace-pre-line break-words text-xs leading-relaxed text-slate-700 line-clamp-[8]">
          {preview}
        </p>
      ) : (
        !note.title && <p className="text-xs italic text-slate-400">Empty note</p>
      )}

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>{formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}</span>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-700 lg:opacity-0 lg:group-hover:opacity-100"
              aria-label="Note options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => update.mutate({ id: note.id, is_archived: !note.is_archived })}>
              <Archive className="mr-2 h-3.5 w-3.5" />
              {note.is_archived ? "Unarchive" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (confirm("Delete this note?")) del.mutate(note.id);
              }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
