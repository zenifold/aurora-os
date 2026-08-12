import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Plus } from "lucide-react";
import { usePages, useCreatePage } from "@/hooks/use-pages";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (page: { id: string; title: string; icon: string | null }) => void;
  /** Used when creating a new page from this dialog. */
  defaultScope?: "workspace" | "project";
  defaultScopeId?: string | null;
}

export function WikiLinkPickerDialog({ open, onOpenChange, onPick, defaultScope = "workspace", defaultScopeId = null }: Props) {
  const { data: pages = [] } = usePages({});
  const create = useCreatePage();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = pages.filter((p) => !p.is_archived);
    if (!q) return base.slice(0, 30);
    return base.filter((p) => p.title.toLowerCase().includes(q)).slice(0, 30);
  }, [pages, query]);

  const hasExactMatch = useMemo(
    () => filtered.some((p) => p.title.toLowerCase() === query.trim().toLowerCase()),
    [filtered, query],
  );

  const handleCreate = async () => {
    const title = query.trim();
    if (!title) return;
    const p = await create.mutateAsync({
      scope: defaultScope,
      scope_id: defaultScopeId,
      title,
    });
    onPick({ id: p.id, title: p.title, icon: p.icon });
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQuery(""); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link a page</DialogTitle>
          <DialogDescription>Cross-reference any page in the workspace. Linked pages appear in each other&apos;s Backlinks.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Input
            autoFocus
            placeholder="Search pages or type a new title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-72 overflow-auto rounded-md border border-border">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No pages match.</div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => { onPick({ id: p.id, title: p.title, icon: p.icon }); onOpenChange(false); setQuery(""); }}
                    >
                      <span className="text-base">{p.icon ?? "📄"}</span>
                      <span className="flex-1 truncate">{p.title}</span>
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {query.trim() && !hasExactMatch && (
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" /> Create page &ldquo;{query.trim()}&rdquo;
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
