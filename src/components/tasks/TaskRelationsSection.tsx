import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useTaskRelations,
  useCreateRelation,
  useDeleteRelation,
} from "@/hooks/use-task-relations";
import {
  RELATION_LABELS,
  STATUS_OPTIONS,
  type RelationType,
  type Task,
  type TaskRelation,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Link2, ArrowRightCircle, ArrowLeftCircle, Repeat, Equal } from "lucide-react";
import { Loader2 } from "lucide-react";

interface Props {
  task: Task;
}

const TYPE_ICON: Record<RelationType, typeof Link2> = {
  blocks: ArrowRightCircle,
  blocked_by: ArrowLeftCircle,
  relates_to: Link2,
  duplicates: Equal,
  follows: Repeat,
};

const TYPE_COLOR: Record<RelationType, string> = {
  blocks: "text-destructive",
  blocked_by: "text-destructive",
  relates_to: "text-muted-foreground",
  duplicates: "text-muted-foreground",
  follows: "text-primary",
};

export function TaskRelationsSection({ task }: Props) {
  const { data: relations = [], isLoading } = useTaskRelations(task.id);

  // Group relations by type for display
  const groups = new Map<RelationType, typeof relations>();
  for (const r of relations) {
    const arr = groups.get(r.relation_type as RelationType) ?? [];
    arr.push(r);
    groups.set(r.relation_type as RelationType, arr);
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Relations</h3>
          {relations.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
              {relations.length}
            </span>
          )}
        </div>
        <AddRelationPopover task={task} />
      </div>

      {isLoading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading relations…
        </div>
      ) : relations.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No related tasks. Link blockers or related work to map dependencies.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {(Object.keys(RELATION_LABELS) as RelationType[]).map((type) => {
            const list = groups.get(type);
            if (!list || list.length === 0) return null;
            return (
              <RelationGroup key={type} type={type} relations={list} currentTaskId={task.id} />
            );
          })}
        </div>
      )}
    </section>
  );
}

function RelationGroup({
  type,
  relations,
  currentTaskId,
}: {
  type: RelationType;
  relations: ReturnType<typeof useTaskRelations>["data"];
  currentTaskId: string;
}) {
  const Icon = TYPE_ICON[type];
  const colorClass = TYPE_COLOR[type];
  const remove = useDeleteRelation();

  return (
    <div className="rounded-md border border-border bg-muted/20">
      <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
        <Icon className={`h-3.5 w-3.5 ${colorClass}`} />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {RELATION_LABELS[type].label}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {(relations ?? []).map((r) => {
          const status = STATUS_OPTIONS.find((s) => s.value === r.other?.status);
          // Display direction: relations as stored may be outgoing or incoming
          // For "blocks": outgoing means current task blocks other; incoming means other blocks current.
          // We always show as "[type] [other task title]" from the perspective of the current task.
          const displayed = displayRelationFromCurrent(r, type, currentTaskId);
          return (
            <li key={r.id} className="group flex items-center gap-2 px-2.5 py-1.5">
              <span className="flex h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: status?.color ?? "#94a3b8" }} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {r.other?.title ?? "Untitled"}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {status?.label ?? r.other?.status ?? "—"}
              </span>
              {displayed.directionLabel && (
                <span className="shrink-0 text-[10px] text-muted-foreground italic">
                  {displayed.directionLabel}
                </span>
              )}
              <button
                onClick={() => remove.mutate(r as TaskRelation)}
                className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove relation"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function displayRelationFromCurrent(
  r: { isOutgoing: boolean },
  storedType: RelationType,
  _currentId: string,
): { directionLabel: string | null } {
  // For symmetric relations, no direction
  if (storedType === "relates_to" || storedType === "duplicates") return { directionLabel: null };
  // For blocks/blocked_by/follows, show inverse hint when incoming
  if (r.isOutgoing) return { directionLabel: null };
  if (storedType === "blocks") return { directionLabel: "(this task is blocked)" };
  if (storedType === "blocked_by") return { directionLabel: "(this task blocks)" };
  if (storedType === "follows") return { directionLabel: "(precedes)" };
  return { directionLabel: null };
}

function AddRelationPopover({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RelationType>("blocks");
  const [search, setSearch] = useState("");
  const create = useCreateRelation();

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["task-search", task.workspace_id, search],
    enabled: open && search.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status")
        .eq("workspace_id", task.workspace_id)
        .ilike("title", `%${search.trim()}%`)
        .neq("id", task.id)
        .limit(10);
      if (error) throw error;
      return (data ?? []) as { id: string; title: string; status: string }[];
    },
  });

  const onPick = async (otherId: string) => {
    await create.mutateAsync({
      workspaceId: task.workspace_id,
      sourceTaskId: task.id,
      targetTaskId: otherId,
      relationType: type,
    });
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add relation
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Relation type</label>
            <Select value={type} onValueChange={(v) => setType(v as RelationType)}>
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RELATION_LABELS) as RelationType[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {RELATION_LABELS[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Find a task</label>
            <Input
              autoFocus
              placeholder="Search by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div className="max-h-56 overflow-y-auto rounded border border-border">
            {search.trim().length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                Type to search…
              </p>
            ) : isFetching ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No tasks found.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {results.map((t) => {
                  const s = STATUS_OPTIONS.find((s) => s.value === t.status);
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => onPick(t.id)}
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: s?.color ?? "#94a3b8" }}
                        />
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {s?.label ?? t.status}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
