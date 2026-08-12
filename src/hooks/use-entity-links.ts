import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  ENTITY_KINDS,
  entityKindDef,
  type EntityKind,
} from "@/lib/entity-link-types";

export interface EntityLinkRow {
  id: string;
  workspace_id: string;
  from_kind: string;
  from_id: string;
  to_kind: string;
  to_id: string;
  relation: string | null;
  note: string | null;
  created_at: string;
}

export interface ResolvedEntityLink extends EntityLinkRow {
  /** The "other side" of the link relative to the anchor record. */
  other: {
    kind: EntityKind;
    id: string;
    title: string;
    subtitle: string | null;
    href: string | null;
    icon: string;
  };
  direction: "outgoing" | "incoming";
}

/**
 * Fetch every entity_link where the given record appears on either side,
 * then resolve the "other" object's title for display.
 */
export function useEntityLinks(kind: EntityKind | null, id: string | null) {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["entity-links", ws?.id, kind, id],
    enabled: !!ws && !!kind && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entity_links")
        .select("*")
        .eq("workspace_id", ws!.id)
        .or(
          `and(from_kind.eq.${kind},from_id.eq.${id}),and(to_kind.eq.${kind},to_id.eq.${id})`,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as EntityLinkRow[];

      // Group "other side" ids by kind so we can resolve titles in one query each.
      const byKind = new Map<EntityKind, Set<string>>();
      for (const r of rows) {
        const isOutgoing = r.from_kind === kind && r.from_id === id;
        const otherKind = (isOutgoing ? r.to_kind : r.from_kind) as EntityKind;
        const otherId = isOutgoing ? r.to_id : r.from_id;
        if (!entityKindDef(otherKind)) continue;
        if (!byKind.has(otherKind)) byKind.set(otherKind, new Set());
        byKind.get(otherKind)!.add(otherId);
      }

      const lookup = new Map<string, { title: string; subtitle: string | null }>();
      await Promise.all(
        Array.from(byKind.entries()).map(async ([k, ids]) => {
          const def = ENTITY_KINDS[k];
          const cols = [
            "id",
            def.titleColumn,
            def.subtitleColumn ?? null,
          ]
            .filter(Boolean)
            .join(", ");
          const { data: recs } = await supabase
            .from(def.table as never)
            .select(cols)
            .in("id", Array.from(ids));
          for (const row of (recs ?? []) as Array<Record<string, unknown>>) {
            const rid = String(row.id);
            lookup.set(`${k}:${rid}`, {
              title: String(row[def.titleColumn] ?? "Untitled"),
              subtitle: def.subtitleColumn
                ? row[def.subtitleColumn] != null
                  ? String(row[def.subtitleColumn])
                  : null
                : null,
            });
          }
        }),
      );

      const resolved: ResolvedEntityLink[] = rows.map((r) => {
        const isOutgoing = r.from_kind === kind && r.from_id === id;
        const otherKind = (isOutgoing ? r.to_kind : r.from_kind) as EntityKind;
        const otherId = isOutgoing ? r.to_id : r.from_id;
        const def = entityKindDef(otherKind);
        const meta = lookup.get(`${otherKind}:${otherId}`);
        return {
          ...r,
          direction: isOutgoing ? "outgoing" : "incoming",
          other: {
            kind: otherKind,
            id: otherId,
            title: meta?.title ?? "Untitled",
            subtitle: meta?.subtitle ?? null,
            href: def?.href(otherId) ?? null,
            icon: def?.icon ?? "🔗",
          },
        };
      });
      return resolved;
    },
  });

  useEffect(() => {
    if (!ws || !kind || !id) return;
    const channel = supabase
      .channel(`entity-links-${kind}-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entity_links" },
        () => qc.invalidateQueries({ queryKey: ["entity-links", ws.id, kind, id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ws, kind, id, qc]);

  return query;
}

export function useCreateEntityLink() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      from_kind: EntityKind;
      from_id: string;
      to_kind: EntityKind;
      to_id: string;
      relation?: string | null;
      note?: string | null;
    }) => {
      if (!ws) throw new Error("No workspace");
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("entity_links")
        .insert({
          workspace_id: ws.id,
          from_kind: input.from_kind,
          from_id: input.from_id,
          to_kind: input.to_kind,
          to_id: input.to_id,
          relation: input.relation ?? null,
          note: input.note ?? null,
          created_by: auth.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entity-links"] });
    },
  });
}

export function useDeleteEntityLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entity_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entity-links"] }),
  });
}

/**
 * Lightweight search across a single object kind, scoped to the current
 * workspace. Returns up to `limit` matches ordered by recency.
 */
export function useEntitySearch(kind: EntityKind, query: string, limit = 8) {
  const ws = useWorkspaceStore((s) => s.current);
  const def = useMemo(() => ENTITY_KINDS[kind], [kind]);
  return useQuery({
    queryKey: ["entity-search", ws?.id, kind, query],
    enabled: !!ws && !!def,
    queryFn: async () => {
      let q = supabase
        .from(def.table as never)
        .select(
          `id, ${def.titleColumn}${def.subtitleColumn ? `, ${def.subtitleColumn}` : ""}`,
        );
      if (def.workspaceColumn) q = q.eq(def.workspaceColumn, ws!.id);
      if (query.trim()) q = q.ilike(def.titleColumn, `%${query.trim()}%`);
      q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        title: String(r[def.titleColumn] ?? "Untitled"),
        subtitle: def.subtitleColumn
          ? r[def.subtitleColumn] != null
            ? String(r[def.subtitleColumn])
            : null
          : null,
      }));
    },
  });
}
