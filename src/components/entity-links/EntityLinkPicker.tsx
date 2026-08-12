import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ENTITY_KIND_LIST,
  type EntityKind,
} from "@/lib/entity-link-types";
import {
  useCreateEntityLink,
  useEntitySearch,
} from "@/hooks/use-entity-links";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromKind: EntityKind;
  fromId: string;
  /** Restrict picker to specific target kinds. Defaults to all. */
  allowedKinds?: EntityKind[];
  /** Pre-select a target kind. */
  defaultKind?: EntityKind;
}

/**
 * Universal dialog: pick any object in the workspace and link it to the
 * anchor record. Works for tasks, projects, deals, contacts, etc.
 */
export function EntityLinkPicker({
  open,
  onOpenChange,
  fromKind,
  fromId,
  allowedKinds,
  defaultKind,
}: Props) {
  const kinds = (allowedKinds ?? ENTITY_KIND_LIST.map((k) => k.kind)).filter(
    (k) => k !== fromKind,
  );
  const [kind, setKind] = useState<EntityKind>(defaultKind ?? kinds[0] ?? "task");
  const [query, setQuery] = useState("");
  const [relation, setRelation] = useState("");
  const create = useCreateEntityLink();
  const { data: results = [], isLoading } = useEntitySearch(kind, query);

  const handleLink = async (targetId: string) => {
    try {
      await create.mutateAsync({
        from_kind: fromKind,
        from_id: fromId,
        to_kind: kind,
        to_id: targetId,
        relation: relation.trim() || null,
      });
      toast.success("Linked");
      onOpenChange(false);
      setQuery("");
      setRelation("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to link";
      // Duplicate-link UNIQUE constraint message is friendlier as-is.
      toast.error(msg.includes("duplicate") ? "Already linked" : msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link a related item</DialogTitle>
          <DialogDescription>
            Cross-reference any object in the workspace. Links appear on both records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as EntityKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kinds.map((k) => {
                    const def = ENTITY_KIND_LIST.find((d) => d.kind === k)!;
                    return (
                      <SelectItem key={k} value={k}>
                        <span className="mr-1">{def.icon}</span>
                        {def.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Relation (optional)</Label>
              <Input
                placeholder="e.g. blocks, related to"
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Search</Label>
            <Input
              autoFocus
              placeholder={`Search ${kind}s…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="max-h-72 overflow-auto rounded-md border border-border">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No matches.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={create.isPending}
                      onClick={() => handleLink(r.id)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.title}</div>
                        {r.subtitle && (
                          <div className="truncate text-xs text-muted-foreground">
                            {r.subtitle}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
