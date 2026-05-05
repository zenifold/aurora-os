import { useEffect, useState } from "react";
import { Pin, Archive, Trash2, X, FileText, List as ListIcon, ListChecks } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NoteEditor } from "./NoteEditor";
import { NOTE_COLORS } from "@/lib/note-colors";
import { useUpdateNote, useDeleteNote, useTogglePin } from "@/hooks/use-notes";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { Note, NoteType } from "@/lib/types";

interface NoteEditorDialogProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_OPTIONS: { value: NoteType; label: string; icon: typeof FileText }[] = [
  { value: "freeform", label: "Freeform", icon: FileText },
  { value: "bullet_list", label: "Bullet list", icon: ListIcon },
  { value: "check_list", label: "Check list", icon: ListChecks },
];

export function NoteEditorDialog({ note, open, onOpenChange }: NoteEditorDialogProps) {
  const update = useUpdateNote();
  const del = useDeleteNote();
  const togglePin = useTogglePin();

  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState<unknown>(note?.content ?? null);
  const [color, setColor] = useState(note?.background_color ?? "#ffffff");
  const [type, setType] = useState<NoteType>(note?.note_type ?? "freeform");
  const [dirty, setDirty] = useState(false);

  // Sync state when note changes
  useEffect(() => {
    if (note) {
      setTitle(note.title ?? "");
      setContent(note.content);
      setColor(note.background_color);
      setType(note.note_type);
      setDirty(false);
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save
  useEffect(() => {
    if (!note || !dirty) return;
    const t = setTimeout(() => {
      update.mutate({
        id: note.id,
        title: title.trim() || null,
        content: content as never,
        background_color: color,
        note_type: type,
      });
      setDirty(false);
    }, 800);
    return () => clearTimeout(t);
  }, [title, content, color, type, dirty, note]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save on close
  const handleClose = (next: boolean) => {
    if (!next && note && dirty) {
      update.mutate({
        id: note.id,
        title: title.trim() || null,
        content: content as never,
        background_color: color,
        note_type: type,
      });
    }
    onOpenChange(next);
  };

  if (!note) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-[100vw] flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:w-auto sm:max-w-2xl sm:rounded-2xl"
        style={{ backgroundColor: color }}
      >
        {/* Toolbar */}
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 bg-black/[0.02] px-2 py-2 pt-safe sm:flex-nowrap sm:px-3">
            {/* Type */}
            <div className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-black/5 p-0.5">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = type === opt.value;
                return (
                  <Tooltip key={opt.value}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          setType(opt.value);
                          setDirty(true);
                        }}
                        className={cn(
                          "rounded p-2 transition-colors sm:p-1.5",
                          active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
                        )}
                      >
                        <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{opt.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Color picker — horizontally scrollable on tight widths */}
            <div className="order-3 -mx-2 flex w-full items-center gap-1 overflow-x-auto px-2 sm:order-none sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {NOTE_COLORS.map((c) => (
                <Tooltip key={c.hex}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setColor(c.hex);
                        setDirty(true);
                      }}
                      className={cn(
                        "h-6 w-6 shrink-0 rounded-full border border-slate-300 transition-transform hover:scale-110 sm:h-5 sm:w-5",
                        color.toLowerCase() === c.hex.toLowerCase() && "ring-2 ring-slate-500 ring-offset-1",
                      )}
                      style={{ backgroundColor: c.hex }}
                      aria-label={c.name}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{c.name}</TooltipContent>
                </Tooltip>
              ))}
            </div>

            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => togglePin.mutate(note)}
                    className={cn(
                      "rounded-md p-1.5 transition-colors hover:bg-black/5",
                      note.is_pinned ? "text-amber-600" : "text-slate-500",
                    )}
                  >
                    <Pin className="h-3.5 w-3.5" fill={note.is_pinned ? "currentColor" : "none"} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{note.is_pinned ? "Unpin" : "Pin"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      update.mutate({ id: note.id, is_archived: !note.is_archived });
                      onOpenChange(false);
                    }}
                    className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-black/5"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{note.is_archived ? "Unarchive" : "Archive"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this note?")) {
                        del.mutate(note.id);
                        onOpenChange(false);
                      }
                    }}
                    className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-black/5 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-black/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </TooltipProvider>

        {/* Title */}
        <div className="px-5 pt-4">
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            placeholder="Title"
            className="h-auto border-0 bg-transparent px-0 text-lg font-semibold text-slate-900 placeholder:text-slate-400 focus-visible:ring-0"
          />
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-5 pb-4 pt-2 text-slate-900">
          <NoteEditor
            content={content}
            noteType={type}
            onChange={(json) => {
              setContent(json);
              setDirty(true);
            }}
            placeholder={
              type === "check_list" ? "List item" : type === "bullet_list" ? "List item" : "Take a note…"
            }
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-black/5 bg-black/[0.02] px-3 py-2 text-[11px] text-slate-500">
          <span>Edited {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}</span>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleClose(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
