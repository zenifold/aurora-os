import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";
import { useState, useMemo } from "react";
import { useSavedViews, useDeleteSavedView, useUpdateSavedView } from "@/hooks/use-saved-views";
import { useObjectTypes } from "@/hooks/use-object-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Pin, PinOff, Share2, Trash2, Table2, LayoutGrid, Calendar as CalIcon, Image, GanttChart, ListTree } from "lucide-react";
import { VIEW_KIND_LABELS, type ViewKind } from "@/lib/object-types";

export const Route = createFileRoute("/app/settings/views")({
  component: () => (
    <RoleGuard min="member">
      <ViewsPage />
    </RoleGuard>
  ),
});

const VIEW_ICONS: Record<ViewKind, typeof Table2> = {
  table: Table2,
  kanban: LayoutGrid,
  calendar: CalIcon,
  gallery: Image,
  timeline: GanttChart,
  board: ListTree,
};

function ViewsPage() {
  const { data: views = [], isLoading } = useSavedViews();
  const { data: types = [] } = useObjectTypes();
  const update = useUpdateSavedView();
  const remove = useDeleteSavedView();
  const [filterType, setFilterType] = useState<string>("all");

  const typeMap = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])), [types]);

  const filtered = useMemo(() => {
    if (filterType === "all") return views;
    if (filterType === "_legacy") return views.filter((v) => !(v as unknown as { object_type_id?: string }).object_type_id);
    return views.filter(
      (v) => (v as unknown as { object_type_id?: string }).object_type_id === filterType,
    );
  }, [views, filterType]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Saved views</h2>
          <p className="text-sm text-muted-foreground">
            Reusable filtered views across object types. Pin views to keep them in your sidebar;
            share a view to make it visible to your whole workspace.
          </p>
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All object types</SelectItem>
            <SelectItem value="_legacy">Legacy (tasks)</SelectItem>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No saved views yet. Create one from any list or board.
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <ul className="divide-y">
            {filtered.map((v) => {
              const raw = v as unknown as {
                object_type_id?: string;
                view_kind?: ViewKind;
                is_shared?: boolean;
                description?: string | null;
              };
              const otId = raw.object_type_id;
              const ot = otId ? typeMap[otId] : null;
              const kind: ViewKind = (raw.view_kind as ViewKind) ?? "table";
              const KindIcon = VIEW_ICONS[kind] ?? Table2;
              return (
                <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                      <KindIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium truncate">{v.name}</div>
                        <Badge variant="outline">{VIEW_KIND_LABELS[kind]}</Badge>
                        {ot && (
                          <Badge
                            style={{ backgroundColor: (ot.color ?? "#8b5cf6") + "20", color: ot.color ?? "#8b5cf6" }}
                            className="border-0"
                          >
                            {ot.label}
                          </Badge>
                        )}
                        {!ot && !otId && <Badge variant="secondary">Tasks (legacy)</Badge>}
                        {raw.is_shared && (
                          <Badge variant="secondary" className="gap-1">
                            <Share2 className="h-3 w-3" /> Shared
                          </Badge>
                        )}
                        {v.is_pinned && (
                          <Badge variant="secondary" className="gap-1">
                            <Pin className="h-3 w-3" /> Pinned
                          </Badge>
                        )}
                      </div>
                      {raw.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {raw.description}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {(v.filters?.length ?? 0)} filter
                        {(v.filters?.length ?? 0) === 1 ? "" : "s"} ·{" "}
                        {(v.sorts?.length ?? 0)} sort
                        {(v.sorts?.length ?? 0) === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title={v.is_pinned ? "Unpin from sidebar" : "Pin to sidebar"}
                      onClick={() => update.mutate({ id: v.id, is_pinned: !v.is_pinned })}
                    >
                      {v.is_pinned ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" title="Open">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete view "${v.name}"?`)) remove.mutate(v.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
