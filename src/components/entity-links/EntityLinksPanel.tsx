import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Link2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EntityLinkPicker } from "./EntityLinkPicker";
import {
  useDeleteEntityLink,
  useEntityLinks,
} from "@/hooks/use-entity-links";
import type { EntityKind } from "@/lib/entity-link-types";

interface Props {
  kind: EntityKind;
  id: string;
  /** Optional override for the heading. */
  title?: string;
  /** Optional kind allow-list passed through to the picker. */
  allowedKinds?: EntityKind[];
  /** Show a compact one-line layout for embedding in dense detail panels. */
  compact?: boolean;
}

/**
 * Drop-in panel that lists every linked record (in either direction) and lets
 * the user attach new ones. Embed anywhere a detail view exists.
 */
export function EntityLinksPanel({
  kind,
  id,
  title = "Related items",
  allowedKinds,
  compact,
}: Props) {
  const { data: links = [], isLoading } = useEntityLinks(kind, id);
  const navigate = useNavigate();
  const del = useDeleteEntityLink();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Group by other.kind for a tidier read.
  const grouped = useMemo(() => {
    const map = new Map<EntityKind, typeof links>();
    for (const l of links) {
      const k = l.other.kind;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(l);
    }
    return Array.from(map.entries());
  }, [links]);

  return (
    <div className={compact ? "space-y-2" : "rounded-lg border border-border bg-card p-4"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" /> {title}
          {links.length > 0 && <span>· {links.length}</span>}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Link
        </Button>
      </div>

      {isLoading ? (
        <div className="py-3 text-xs text-muted-foreground">Loading…</div>
      ) : links.length === 0 ? (
        <div className="py-3 text-xs text-muted-foreground">
          Nothing linked yet. Use <span className="font-medium">Link</span> to connect a task, deal, contact, page, invoice, and more.
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          {grouped.map(([k, items]) => (
            <div key={k}>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {items[0].other.icon} {k}
              </div>
              <ul className="space-y-1">
                {items.map((l) => {
                  const inner = (
                    <>
                      <span className="flex-1 truncate text-sm">{l.other.title}</span>
                      {l.relation && (
                        <Badge variant="outline" className="text-[10px]">
                          {l.relation}
                        </Badge>
                      )}
                      {l.direction === "incoming" && (
                        <Badge variant="secondary" className="text-[10px]">
                          incoming
                        </Badge>
                      )}
                    </>
                  );
                  return (
                    <li
                      key={l.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
                    >
                      {l.other.href ? (
                        <button
                          type="button"
                          onClick={() => navigate({ to: l.other.href! })}
                          className="flex flex-1 items-center gap-2 truncate text-left hover:underline"
                        >
                          {inner}
                        </button>
                      ) : (
                        <div className="flex flex-1 items-center gap-2 truncate">
                          {inner}
                        </div>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground"
                        onClick={() => del.mutate(l.id)}
                        title="Unlink"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <EntityLinkPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        fromKind={kind}
        fromId={id}
        allowedKinds={allowedKinds}
      />
    </div>
  );
}
