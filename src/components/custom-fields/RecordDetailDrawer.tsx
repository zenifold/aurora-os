// Block A · Phase 4 — record detail drawer with inline field editing
// and activity log. Phase 5 — relations tab for cross-object linking.
import { useEffect, useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { CustomFieldInput } from "@/components/custom-fields/CustomFieldInput";
import { useObjectFields, useObjectTypes } from "@/hooks/use-object-types";
import { useUpdateCustomRecord } from "@/hooks/use-custom-records";
import { useRecordActivity, useLogActivity } from "@/hooks/use-record-activity";
import {
  useRecordRelations, useSearchRecords,
  useAddRecordRelation, useRemoveRecordRelation,
} from "@/hooks/use-record-relations";
import type { CustomRecord, ObjectFieldDef } from "@/lib/object-types";
import { Activity, FileText, Check, Loader2, Link2, Plus, X, ArrowRight, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Props = {
  record: CustomRecord | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  statuses?: string[];
};

export function RecordDetailDrawer({ record, open, onOpenChange, statuses = [] }: Props) {
  const { data: fields = [] } = useObjectFields(record?.object_type_id ?? null);
  const update = useUpdateCustomRecord();
  const log = useLogActivity();
  const { data: activity = [] } = useRecordActivity(record?.id ?? null);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string>("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (record) {
      setTitle(record.title);
      setStatus(record.status ?? "");
      setValues((record.values as Record<string, unknown>) ?? {});
      setDirty(false);
    }
  }, [record?.id]);

  if (!record) return null;

  const setField = (id: string, v: unknown) => {
    setValues((p) => ({ ...p, [id]: v }));
    setDirty(true);
  };

  const save = async () => {
    if (!record) return;
    const changes: Record<string, unknown> = {};
    if (title !== record.title) changes.title = { from: record.title, to: title };
    if ((status || null) !== (record.status ?? null))
      changes.status = { from: record.status, to: status || null };
    const valueChanges: Record<string, unknown> = {};
    fields.forEach((f) => {
      const before = (record.values as Record<string, unknown>)?.[f.id];
      const after = values[f.id];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        valueChanges[f.name] = { from: before ?? null, to: after ?? null };
      }
    });
    if (Object.keys(valueChanges).length) changes.values = valueChanges;

    await update.mutateAsync({
      id: record.id,
      title,
      status: status || null,
      values: values as never,
    });
    if (Object.keys(changes).length > 0) {
      await log.mutateAsync({
        entity_type: "custom_record",
        entity_id: record.id,
        action: "updated",
        changes,
      });
    }
    setDirty(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="space-y-2">
          <SheetTitle>
            <Input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
              className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
              placeholder="Untitled"
            />
          </SheetTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Updated {formatDistanceToNow(new Date(record.updated_at), { addSuffix: true })}</span>
            {record.is_archived && <Badge variant="outline">Archived</Badge>}
          </div>
        </SheetHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details"><FileText className="mr-1.5 h-3.5 w-3.5" /> Details</TabsTrigger>
            <TabsTrigger value="relations"><Link2 className="mr-1.5 h-3.5 w-3.5" /> Relations</TabsTrigger>
            <TabsTrigger value="activity"><Activity className="mr-1.5 h-3.5 w-3.5" /> Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-4">
            <div>
              <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
              <div className="flex flex-wrap gap-1.5">
                {(statuses.length ? statuses : ["todo", "in_progress", "done"]).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatus(s === status ? "" : s); setDirty(true); }}
                    className={`rounded-md border px-2 py-0.5 text-xs ${
                      status === s ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom fields defined for this object type.</p>
            ) : (
              fields.map((f) => (
                <FieldEditor key={f.id} field={f} value={values[f.id]} onChange={(v) => setField(f.id, v)} />
              ))
            )}
          </TabsContent>

          <TabsContent value="relations" className="mt-4">
            <RelationsPanel recordId={record.id} />
          </TabsContent>



          <TabsContent value="activity" className="mt-4">
            {activity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="rounded-md border bg-card p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{a.action}</span>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {a.changes && Object.keys(a.changes).length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                        {Object.entries(a.changes).map(([k, v]) => (
                          <li key={k}>
                            <span className="font-mono">{k}</span>: {formatChange(v)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-0 mt-6 flex items-center justify-end gap-2 border-t bg-background py-3">
          <span className="mr-auto text-xs text-muted-foreground">
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={save} disabled={!dirty || update.isPending}>
            {update.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FieldEditor({ field, value, onChange }: { field: ObjectFieldDef; value: unknown; onChange: (v: unknown) => void; }) {
  return (
    <div>
      <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
        {field.name}
        {field.is_required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <CustomFieldInput field={field} value={value} onChange={onChange} />
      {field.help_text && <p className="mt-1 text-xs text-muted-foreground">{field.help_text}</p>}
    </div>
  );
}

function formatChange(v: unknown): string {
  if (v && typeof v === "object" && "from" in (v as object) && "to" in (v as object)) {
    const c = v as { from: unknown; to: unknown };
    return `${stringify(c.from)} → ${stringify(c.to)}`;
  }
  return stringify(v);
}

function stringify(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function RelationsPanel({ recordId }: { recordId: string }) {
  const { data: relations = [], isLoading } = useRecordRelations(recordId);
  const { data: objectTypes = [] } = useObjectTypes();
  const add = useAddRecordRelation();
  const remove = useRemoveRecordRelation();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { data: results = [], isFetching } = useSearchRecords(search, recordId);

  const typeMap = useMemo(() => {
    const m = new Map<string, { label: string; color: string | null }>();
    objectTypes.forEach((t) => m.set(t.id, { label: t.label, color: t.color }));
    return m;
  }, [objectTypes]);

  const existingIds = useMemo(
    () => new Set(relations.map((r) => r.other.id)),
    [relations],
  );

  const link = async (toId: string) => {
    await add.mutateAsync({ from_record_id: recordId, to_record_id: toId });
    setSearch("");
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="w-full justify-start">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Link a record
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records…"
            autoFocus
            className="h-8"
          />
          <div className="mt-2 max-h-64 overflow-y-auto">
            {search.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">Type to search…</p>
            ) : isFetching ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">Searching…</p>
            ) : results.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">No matches.</p>
            ) : (
              results
                .filter((r) => !existingIds.has(r.id))
                .map((r) => {
                  const t = typeMap.get(r.object_type_id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => link(r.id)}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="flex items-center gap-2 truncate">
                        {t?.color && (
                          <span className="h-2 w-2 shrink-0 rounded" style={{ backgroundColor: t.color }} />
                        )}
                        <span className="truncate">{r.title}</span>
                      </span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">{t?.label ?? "Record"}</Badge>
                    </button>
                  );
                })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : relations.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No linked records yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {relations.map((r) => {
            const t = typeMap.get(r.other.object_type_id);
            const Dir = r.direction === "outgoing" ? ArrowRight : ArrowLeft;
            return (
              <li
                key={r.id}
                className="group flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Dir className="h-3 w-3 shrink-0 text-muted-foreground" />
                  {t?.color && (
                    <span className="h-2 w-2 shrink-0 rounded" style={{ backgroundColor: t.color }} />
                  )}
                  <span className="truncate text-sm">{r.other.title}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{t?.label ?? "Record"}</Badge>
                </span>
                <button
                  onClick={() => remove.mutate(r.id)}
                  className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-destructive group-hover:opacity-100"
                  title="Unlink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

