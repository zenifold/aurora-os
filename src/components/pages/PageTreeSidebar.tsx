import { useState } from "react";
import { confirmDialog } from "@/lib/dialogs";
import { ChevronRight, ChevronDown, Plus, MoreHorizontal, Trash2, FilePlus, Pin, PinOff, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { Page } from "@/lib/page-types";

interface Props {
  pages: Page[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddSubpage: (parentId: string | null) => void;
  onDelete: (id: string) => void;
  onTogglePin: (page: Page) => void;
  onArchive: (page: Page) => void;
  onMove: (id: string, newParentId: string | null) => void;
}

export function PageTreeSidebar({ pages, selectedId, onSelect, onAddSubpage, onDelete, onTogglePin, onArchive, onMove }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null | "root">(null);

  const byParent = new Map<string | null, Page[]>();
  for (const p of pages) {
    const k = p.parent_page_id ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(p);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || a.sort_order - b.sort_order || a.title.localeCompare(b.title));
  }

  const toggle = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const isDescendant = (ancestorId: string, candidateId: string): boolean => {
    let cur = pages.find((p) => p.id === candidateId);
    while (cur?.parent_page_id) {
      if (cur.parent_page_id === ancestorId) return true;
      cur = pages.find((p) => p.id === cur!.parent_page_id);
    }
    return false;
  };

  const renderNode = (page: Page, depth: number) => {
    const children = byParent.get(page.id) ?? [];
    const isOpen = expanded.has(page.id);
    const isSelected = page.id === selectedId;
    return (
      <div key={page.id}>
        <div
          draggable
          onDragStart={(e) => {
            setDragId(page.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            setDragId(null);
            setDropTargetId(null);
          }}
          onDragOver={(e) => {
            if (dragId && dragId !== page.id && !isDescendant(dragId, page.id)) {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
              if (dropTargetId !== page.id) setDropTargetId(page.id);
            }
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            if (dropTargetId === page.id) setDropTargetId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragId && dragId !== page.id && !isDescendant(dragId, page.id)) {
              onMove(dragId, page.id);
              setExpanded((s) => new Set(s).add(page.id));
            }
            setDragId(null);
            setDropTargetId(null);
          }}
          className={cn(
            "group flex items-center gap-1 rounded px-1 py-1 text-sm transition-colors hover:bg-muted/60",
            isSelected && "bg-muted",
            dropTargetId === page.id && "bg-primary/15 outline outline-2 outline-primary",
          )}
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          <button
            type="button"
            onClick={() => (children.length || page.page_type === "folder" ? toggle(page.id) : onSelect(page.id))}
            className="flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            {children.length > 0 || page.page_type === "folder" ? (
              isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <span className="block h-1 w-1 rounded-full bg-muted-foreground/40" />
            )}
          </button>
          <button
            type="button"
            onClick={() => (page.page_type === "folder" ? toggle(page.id) : onSelect(page.id))}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <span className="text-base leading-none">{page.icon ?? (page.page_type === "folder" ? "📁" : "📄")}</span>
            <span className={cn("truncate", page.page_type === "folder" && "font-medium")}>{page.title || "Untitled"}</span>
            {page.is_pinned && <Pin className="h-3 w-3 text-primary" />}
          </button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onAddSubpage(page.id);
              setExpanded((s) => new Set(s).add(page.id));
            }}
            aria-label="Add subpage"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
                aria-label="Page actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAddSubpage(page.id)}>
                <FilePlus className="mr-2 h-4 w-4" /> Add subpage
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTogglePin(page)}>
                {page.is_pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                {page.is_pinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              {page.parent_page_id && (
                <DropdownMenuItem onClick={() => onMove(page.id, null)}>
                  Move to top level
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onArchive(page)}>
                <Archive className="mr-2 h-4 w-4" /> {page.is_archived ? "Unarchive" : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: `Delete "${page.title}"?`,
                    description: "All subpages will also be permanently deleted.",
                    confirmLabel: "Delete",
                    tone: "destructive",
                  });
                  if (ok) onDelete(page.id);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isOpen && children.length > 0 && (
          <div>{children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  const roots = byParent.get(null) ?? [];

  return (
    <div
      className={cn(
        "flex-1 overflow-auto p-1 transition-colors",
        dropTargetId === "root" && "bg-primary/5 outline-dashed outline-2 outline-primary/40",
      )}
      onDragOver={(e) => {
        if (dragId) {
          e.preventDefault();
          if (dropTargetId !== "root") setDropTargetId("root");
        }
      }}
      onDragLeave={() => {
        if (dropTargetId === "root") setDropTargetId(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragId) onMove(dragId, null);
        setDragId(null);
        setDropTargetId(null);
      }}
    >
      {roots.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">No pages yet</div>
      ) : (
        roots.map((p) => renderNode(p, 0))
      )}
    </div>
  );
}
