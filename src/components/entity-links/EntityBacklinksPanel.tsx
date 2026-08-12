import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ENTITY_KINDS, type EntityKind } from "@/lib/entity-link-types";
import { BACKLINK_PROBES, type BacklinkProbe } from "@/lib/entity-backlinks";
import { Badge } from "@/components/ui/badge";

interface BacklinkRow {
  id: string;
  title: string;
  subtitle: string | null;
  probe: BacklinkProbe;
}

interface Props {
  kind: EntityKind;
  id: string;
  title?: string;
  /** Hide the panel entirely if no probes are configured for this kind. */
  hideWhenEmpty?: boolean;
}

/**
 * Read-only panel that auto-discovers every record referencing this anchor
 * via known FK columns. Complements EntityLinksPanel (which is for explicit
 * user-created links).
 */
export function EntityBacklinksPanel({ kind, id, title = "Referenced by", hideWhenEmpty }: Props) {
  const ws = useWorkspaceStore((s) => s.current);
  const navigate = useNavigate();
  const probes = useMemo(() => BACKLINK_PROBES[kind] ?? [], [kind]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["entity-backlinks", ws?.id, kind, id, probes.length],
    enabled: !!ws && !!id && probes.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        probes.map(async (probe) => {
          const cols = [
            "id",
            probe.titleColumn,
            probe.subtitleColumn ?? null,
          ]
            .filter(Boolean)
            .join(", ");
          let q = supabase
            .from(probe.table as never)
            .select(cols)
            .eq(probe.fkColumn, id)
            .limit(25);
          if (probe.workspaceColumn) q = q.eq(probe.workspaceColumn, ws!.id);
          const { data, error } = await q;
          if (error) return [] as BacklinkRow[];
          return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
            id: String(r.id),
            title: String(r[probe.titleColumn] ?? "Untitled"),
            subtitle: probe.subtitleColumn
              ? r[probe.subtitleColumn] != null
                ? String(r[probe.subtitleColumn])
                : null
              : null,
            probe,
          }));
        }),
      );
      return results.flat();
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { probe: BacklinkProbe; items: BacklinkRow[] }>();
    for (const r of rows) {
      const key = r.probe.groupLabel ?? ENTITY_KINDS[r.probe.asKind].plural;
      if (!map.has(key)) map.set(key, { probe: r.probe, items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.entries());
  }, [rows]);

  if (probes.length === 0 && hideWhenEmpty) return null;
  if (rows.length === 0 && hideWhenEmpty && !isLoading) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Inbox className="h-3.5 w-3.5" /> {title}
        {rows.length > 0 && <span>· {rows.length}</span>}
      </div>

      {isLoading ? (
        <div className="py-3 text-xs text-muted-foreground">Scanning…</div>
      ) : rows.length === 0 ? (
        <div className="py-3 text-xs text-muted-foreground">
          No records reference this {kind} yet.
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          {grouped.map(([label, { probe, items }]) => {
            const def = ENTITY_KINDS[probe.asKind];
            return (
              <div key={label}>
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {def.icon} {label} · {items.length}
                </div>
                <ul className="space-y-1">
                  {items.map((row) => {
                    const href = def.href(row.id);
                    const content = (
                      <>
                        <span className="flex-1 truncate text-sm">{row.title}</span>
                        {row.subtitle && (
                          <Badge variant="outline" className="text-[10px]">
                            {row.subtitle}
                          </Badge>
                        )}
                      </>
                    );
                    return (
                      <li
                        key={`${probe.table}:${row.id}`}
                        className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
                      >
                        {href ? (
                          <button
                            type="button"
                            onClick={() => navigate({ to: href })}
                            className="flex flex-1 items-center gap-2 truncate text-left hover:underline"
                          >
                            {content}
                          </button>
                        ) : (
                          <div className="flex flex-1 items-center gap-2 truncate">
                            {content}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
