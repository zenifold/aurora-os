import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Loader2,
  Trash2,
  CheckSquare,
  ListChecks,
  Plus,
  FileQuestion,
} from "lucide-react";
import {
  useScopeChecklist,
  useGenerateChecklist,
  useUpsertScopeItem,
  useDeleteScopeItem,
  useApplyChecklistToSow,
  type ScopeItem,
} from "@/hooks/use-scope-checklist";
import { useSalesDocuments } from "@/hooks/use-sales-documents";

const STATUSES: ScopeItem["status"][] = [
  "in_scope",
  "needs_clarification",
  "out_of_scope",
  "deferred",
  "done",
];
const PRIORITIES: ScopeItem["priority"][] = ["must_have", "should_have", "nice_to_have"];

const statusTone = (s: ScopeItem["status"]) =>
  s === "in_scope"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : s === "needs_clarification"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      : s === "out_of_scope"
        ? "bg-destructive/15 text-destructive"
        : "bg-muted text-muted-foreground";

export function ScopeChecklistPanel({ dealId, canApply = true }: { dealId: string; canApply?: boolean }) {
  const { data: items = [], isLoading } = useScopeChecklist(dealId);
  const { data: docs = [] } = useSalesDocuments(dealId);
  const gen = useGenerateChecklist(dealId);
  const upsert = useUpsertScopeItem(dealId);
  const del = useDeleteScopeItem(dealId);
  const apply = useApplyChecklistToSow(dealId);
  const [newReq, setNewReq] = useState("");

  const docName = (id: string | null) => docs.find((d) => d.id === id)?.name ?? null;
  const grouped = items.reduce<Record<string, ScopeItem[]>>((acc, it) => {
    (acc[it.area] ??= []).push(it);
    return acc;
  }, {});
  const inScope = items.filter((i) => i.status === "in_scope").length;
  const needsClar = items.filter((i) => i.status === "needs_clarification").length;
  const outScope = items.filter((i) => i.status === "out_of_scope").length;

  const addManual = () => {
    if (!newReq.trim()) return;
    upsert.mutate(
      {
        deal_id: dealId,
        patch: { requirement: newReq.trim(), area: "other", status: "in_scope", priority: "must_have" },
      },
      { onSuccess: () => setNewReq("") },
    );
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold flex items-center gap-1.5">
            <ListChecks className="h-4 w-4 text-primary" />
            Scope checklist
          </div>
          <div className="text-xs text-muted-foreground">
            Every requirement we'll commit to (or explicitly exclude) in the SOW. Generated
            from the discovery brief; editable before applying.
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => gen.mutate(items.length > 0)}
            disabled={gen.isPending}
          >
            {gen.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {items.length > 0 ? "Regenerate" : "Generate from brief"}
          </Button>
          {canApply && items.length > 0 && (
            <Button size="sm" onClick={() => apply.mutate()} disabled={apply.isPending}>
              {apply.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
              )}
              Apply to SOW
            </Button>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Badge variant="secondary">{items.length} total</Badge>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            {inScope} in scope
          </Badge>
          {needsClar > 0 && (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <FileQuestion className="mr-1 h-3 w-3" /> {needsClar} need clarification
            </Badge>
          )}
          {outScope > 0 && <Badge variant="outline">{outScope} out of scope</Badge>}
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No checklist yet. Generate it from the approved discovery brief.
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([area, list]) => (
            <div key={area} className="rounded border border-border">
              <div className="bg-muted/40 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {area.replace(/_/g, " ")} <span className="ml-1 normal-case text-muted-foreground">({list.length})</span>
              </div>
              <ul className="divide-y divide-border">
                {list.map((it) => (
                  <li key={it.id} className="space-y-1 p-2.5 text-xs">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground">{it.requirement}</div>
                        {it.details && (
                          <div className="mt-0.5 text-muted-foreground">{it.details}</div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {it.priority.replace("_", " ")}
                          </Badge>
                          {it.confidence != null && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(it.confidence * 100)}% conf
                            </span>
                          )}
                          {it.source_document_id && docName(it.source_document_id) && (
                            <span
                              className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                              title={it.source_snippet ?? undefined}
                            >
                              📎 {docName(it.source_document_id)}
                            </span>
                          )}
                          {it.ai_generated && (
                            <Badge variant="secondary" className="text-[9px]">
                              <Sparkles className="mr-0.5 h-2.5 w-2.5" /> AI
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Select
                          value={it.priority}
                          onValueChange={(v) =>
                            upsert.mutate({
                              id: it.id,
                              deal_id: dealId,
                              patch: { priority: v as ScopeItem["priority"] },
                            })
                          }
                        >
                          <SelectTrigger className="h-7 w-24 text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p} className="text-[10px] capitalize">
                                {p.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={it.status}
                          onValueChange={(v) =>
                            upsert.mutate({
                              id: it.id,
                              deal_id: dealId,
                              patch: { status: v as ScopeItem["status"] },
                            })
                          }
                        >
                          <SelectTrigger className={`h-7 w-32 text-[10px] ${statusTone(it.status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="text-[10px] capitalize">
                                {s.replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => del.mutate(it.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-t border-border pt-2">
        <Input
          placeholder="Add a manual requirement…"
          value={newReq}
          onChange={(e) => setNewReq(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addManual()}
          className="h-8 text-xs"
        />
        <Button size="sm" variant="outline" onClick={addManual} disabled={!newReq.trim() || upsert.isPending}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}
