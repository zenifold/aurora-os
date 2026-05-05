import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDivisions, useFolders } from "@/hooks/use-folders";
import { Folder as FolderIcon, FolderOpen, Search, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Folder } from "@/lib/folder-types";

export interface MoveTarget {
  division_id: string;
  folder_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Title of the dialog. */
  title?: string;
  /** Folders that are not selectable as targets (e.g. self + descendants when moving a folder). */
  excludeFolderIds?: string[];
  /** Current placement, highlighted in the picker. */
  current?: MoveTarget | null;
  onConfirm: (target: MoveTarget) => Promise<void> | void;
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  title = "Move",
  excludeFolderIds = [],
  current,
  onConfirm,
}: Props) {
  const { data: divisions = [] } = useDivisions();
  const { data: folders = [] } = useFolders();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<MoveTarget | null>(current ?? null);
  const [saving, setSaving] = useState(false);

  const excludeSet = useMemo(() => new Set(excludeFolderIds), [excludeFolderIds]);
  const q = query.trim().toLowerCase();

  const folderTree = useMemo(() => {
    // Build path label for each folder for searching
    const byId = new Map(folders.map((f) => [f.id, f]));
    const path = (f: Folder): string => {
      const chain: string[] = [f.name];
      let cur: Folder | undefined = f;
      while (cur?.parent_id) {
        const p = byId.get(cur.parent_id);
        if (!p) break;
        chain.unshift(p.name);
        cur = p;
      }
      return chain.join(" / ");
    };
    return folders.map((f) => ({ folder: f, path: path(f) }));
  }, [folders]);

  const handleConfirm = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await onConfirm(target);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search divisions and folders…"
            className="pl-8"
            autoFocus
          />
        </div>

        <ScrollArea className="h-80 rounded-md border">
          <div className="p-1">
            {divisions.map((d) => {
              const divisionFolders = folderTree.filter(
                (n) =>
                  n.folder.division_id === d.id &&
                  !excludeSet.has(n.folder.id) &&
                  (!q || n.path.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)),
              );
              const divisionMatches = !q || d.name.toLowerCase().includes(q) || divisionFolders.length > 0;
              if (!divisionMatches) return null;

              const rootSelected = target?.division_id === d.id && target?.folder_id === null;
              return (
                <div key={d.id} className="mb-2">
                  <button
                    type="button"
                    onClick={() => setTarget({ division_id: d.id, folder_id: null })}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      rootSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/60",
                    )}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded"
                      style={{ backgroundColor: `${d.color}22`, color: d.color }}
                    >
                      <Inbox className="h-3 w-3" />
                    </span>
                    <span className="font-medium">{d.name}</span>
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">root</span>
                  </button>

                  {divisionFolders.length > 0 && (
                    <div className="mt-0.5">
                      {divisionFolders
                        .sort((a, b) => a.path.localeCompare(b.path))
                        .map(({ folder, path }) => {
                          const isSelected =
                            target?.division_id === d.id && target?.folder_id === folder.id;
                          return (
                            <button
                              key={folder.id}
                              type="button"
                              onClick={() =>
                                setTarget({ division_id: d.id, folder_id: folder.id })
                              }
                              className={cn(
                                "ml-3 flex w-[calc(100%-0.75rem)] items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors",
                                isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/60",
                              )}
                            >
                              {isSelected ? (
                                <FolderOpen className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <FolderIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span className="truncate">{path}</span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!target || saving} onClick={handleConfirm}>
            {saving ? "Moving…" : "Move here"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
