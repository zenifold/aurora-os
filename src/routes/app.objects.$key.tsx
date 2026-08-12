// Block A · Phase 3 — generic record renderer with view switcher
// (table / kanban / gallery) and saved-view chips per object type.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useObjectTypeByKey,
  useObjectFields,
} from "@/hooks/use-object-types";
import {
  useCustomRecords,
  useCreateCustomRecord,
  useUpdateCustomRecord,
  useDeleteCustomRecord,
} from "@/hooks/use-custom-records";
import {
  useSavedViews,
  useCreateSavedView,
  useDeleteSavedView,
  useUpdateSavedView,
  type SavedView,
  type ViewKind,
} from "@/hooks/use-saved-views";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, MoreHorizontal, Trash2, Sliders, Settings, Table2, LayoutGrid,
  Image as ImageIcon, Save, Pin, PinOff, Share2, Users, Search, X,
} from "lucide-react";
import { CustomFieldInput, renderFieldValue } from "@/components/custom-fields/CustomFieldInput";
import { RecordDetailDrawer } from "@/components/custom-fields/RecordDetailDrawer";
import type { ObjectFieldDef, CustomRecord } from "@/lib/object-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/objects/$key")({
  component: ObjectListPage,
});

const KIND_ICONS: Record<ViewKind, typeof Table2> = {
  table: Table2,
  kanban: LayoutGrid,
  gallery: ImageIcon,
  calendar: Table2,
  timeline: Table2,
  board: LayoutGrid,
};

const SUPPORTED_KINDS: ViewKind[] = ["table", "kanban", "gallery"];

function ObjectListPage() {
  const { key } = Route.useParams();
  const { user } = useAuth();
  const { data: objectType, isLoading: ltype } = useObjectTypeByKey(key);
  const { data: fields = [] } = useObjectFields(objectType?.id ?? null);
  const { data: records = [], isLoading: lrecs } = useCustomRecords(objectType?.id ?? null);
  const { data: allViews = [] } = useSavedViews();
  const create = useCreateCustomRecord();
  const update = useUpdateCustomRecord();
  const remove = useDeleteCustomRecord();
  const createView = useCreateSavedView();
  const updateView = useUpdateSavedView();
  const deleteView = useDeleteSavedView();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [viewKind, setViewKind] = useState<ViewKind>("table");
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveShared, setSaveShared] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);


  const views = useMemo(
    () => allViews.filter((v) => v.object_type_id === (objectType?.id ?? null)),
    [allViews, objectType?.id],
  );

  const visibleFields = useMemo(
    () => fields.filter((f) => f.is_visible_in_table),
    [fields],
  );

  const statusValues = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => { if (r.status) set.add(r.status); });
    return Array.from(set);
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter !== "all" && (r.status ?? "") !== statusFilter) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, search, statusFilter]);

  if (!ltype && !objectType) {
    return (
      <div className="p-8">
        <h1 className="mb-2 text-2xl font-semibold">Object type not found</h1>
        <p className="text-muted-foreground">
          No object type with key <code className="font-mono">{key}</code> exists in this workspace.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/app/settings/object-types">Manage object types</Link>
        </Button>
      </div>
    );
  }

  const applyView = (v: SavedView) => {
    setActiveViewId(v.id);
    setViewKind(SUPPORTED_KINDS.includes(v.view_kind) ? v.view_kind : "table");
    // filters/sorts are reserved for richer phases; status filter persists for now.
  };

  const submit = async () => {
    if (!objectType || !title.trim()) return;
    await create.mutateAsync({
      object_type_id: objectType.id,
      title: title.trim(),
      values,
    });
    setTitle("");
    setValues({});
    setOpen(false);
  };

  const saveCurrentAsView = async () => {
    if (!objectType || !saveName.trim()) return;
    await createView.mutateAsync({
      name: saveName.trim(),
      object_type_id: objectType.id,
      view_kind: viewKind,
      is_shared: saveShared,
      scope: saveShared ? "workspace" : "mine",
    });
    setSaveName("");
    setSaveShared(false);
    setSaveOpen(false);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-3 border-b px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {objectType?.color && (
              <span
                className="h-3 w-3 rounded"
                style={{ backgroundColor: objectType.color }}
              />
            )}
            <div>
              <h1 className="text-xl font-semibold">{objectType?.plural_label ?? "Records"}</h1>
              {objectType?.description && (
                <p className="text-xs text-muted-foreground">{objectType.description}</p>
              )}
            </div>
            <Badge variant="outline">{filtered.length}{filtered.length !== records.length ? ` / ${records.length}` : ""}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/settings/fields"><Sliders className="mr-1 h-4 w-4" /> Fields</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/settings/object-types"><Settings className="mr-1 h-4 w-4" /> Object types</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" /> New {objectType?.label ?? "record"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>New {objectType?.label}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Untitled"
                      autoFocus
                    />
                  </div>
                  {fields.map((f) => (
                    <FieldRow
                      key={f.id}
                      field={f}
                      value={values[f.id]}
                      onChange={(v) => setValues((p) => ({ ...p, [f.id]: v }))}
                    />
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={submit} disabled={!title.trim()}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* View chips + toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={viewKind} onValueChange={(v) => setViewKind(v as ViewKind)}>
            <TabsList className="h-8">
              {SUPPORTED_KINDS.map((k) => {
                const Icon = KIND_ICONS[k];
                return (
                  <TabsTrigger key={k} value={k} className="h-7 gap-1 px-2 text-xs">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="capitalize">{k}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          <div className="mx-2 h-5 w-px bg-border" />

          {views.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {views.map((v) => (
                <button
                  key={v.id}
                  onClick={() => applyView(v)}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs",
                    activeViewId === v.id
                      ? "bg-aura-gradient-subtle font-medium"
                      : "bg-card hover:bg-muted",
                  )}
                  title={v.description ?? undefined}
                >
                  {v.is_shared && <Users className="h-3 w-3 text-muted-foreground" />}
                  {v.is_pinned && <Pin className="h-3 w-3 text-amber-500" />}
                  <span>{v.name}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{v.view_kind}</span>
                  {v.user_id === user?.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <span className="ml-1 cursor-pointer text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-3 w-3" />
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => updateView.mutate({ id: v.id, is_pinned: !v.is_pinned })}>
                          {v.is_pinned ? <><PinOff className="mr-2 h-4 w-4" /> Unpin</> : <><Pin className="mr-2 h-4 w-4" /> Pin to sidebar</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateView.mutate({ id: v.id, is_shared: !v.is_shared })}>
                          <Share2 className="mr-2 h-4 w-4" /> {v.is_shared ? "Make private" : "Share with workspace"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteView.mutate(v.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete view
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="h-8 w-48 pl-7 pr-7 text-sm"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {statusValues.length > 0 && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statusValues.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Save className="mr-1 h-3.5 w-3.5" /> Save view</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Save current view</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Name</Label>
                    <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. Open by priority" autoFocus />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Label className="text-sm">Share with workspace</Label>
                      <p className="text-xs text-muted-foreground">Teammates will see this view too.</p>
                    </div>
                    <Switch checked={saveShared} onCheckedChange={setSaveShared} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Saves layout: <strong className="capitalize">{viewKind}</strong>
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
                  <Button onClick={saveCurrentAsView} disabled={!saveName.trim()}>Save view</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {lrecs ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {records.length === 0
                ? `No ${objectType?.plural_label.toLowerCase() ?? "records"} yet.`
                : "No records match your filters."}
            </p>
            {records.length === 0 && (
              <Button onClick={() => setOpen(true)} size="sm">
                <Plus className="mr-1 h-4 w-4" /> Create the first one
              </Button>
            )}
          </div>
        ) : viewKind === "table" ? (
          <TableView
            records={filtered}
            visibleFields={visibleFields}
            onOpen={(id) => setSelectedId(id)}
            onArchive={(id) => update.mutate({ id, is_archived: true })}
            onDelete={(id) => remove.mutate(id)}
          />
        ) : viewKind === "kanban" ? (
          <KanbanView
            records={filtered}
            statuses={statusValues.length > 0 ? statusValues : ["todo", "in_progress", "done"]}
            onOpen={(id) => setSelectedId(id)}
            onStatusChange={(id, status) => update.mutate({ id, status })}
          />
        ) : (
          <GalleryView
            records={filtered}
            visibleFields={visibleFields.slice(0, 3)}
            color={objectType?.color ?? "#8b5cf6"}
            onOpen={(id) => setSelectedId(id)}
          />
        )}
      </div>

      <RecordDetailDrawer
        record={records.find((r) => r.id === selectedId) ?? null}
        open={!!selectedId}
        onOpenChange={(o) => !o && setSelectedId(null)}
        statuses={statusValues}
      />
    </div>
  );
}

function FieldRow({
  field, value, onChange,
}: {
  field: ObjectFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div>
      <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
        {field.name}
        {field.is_required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <CustomFieldInput field={field} value={value} onChange={onChange} />
      {field.help_text && (
        <p className="mt-1 text-xs text-muted-foreground">{field.help_text}</p>
      )}
    </div>
  );
}

function TableView({
  records, visibleFields, onArchive, onDelete, onOpen,
}: {
  records: CustomRecord[];
  visibleFields: ObjectFieldDef[];
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[28%]">Title</TableHead>
          <TableHead className="w-[10%]">Status</TableHead>
          {visibleFields.map((f) => <TableHead key={f.id}>{f.name}</TableHead>)}
          <TableHead className="w-[60px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((r) => (
          <TableRow
            key={r.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onOpen(r.id)}
          >
            <TableCell className="font-medium">{r.title}</TableCell>
            <TableCell>
              {r.status ? <Badge variant="outline">{r.status}</Badge> : <span className="text-muted-foreground">—</span>}
            </TableCell>
            {visibleFields.map((f) => (
              <TableCell key={f.id} className="text-sm">
                {renderFieldValue(f, (r.values ?? {})[f.id])}
              </TableCell>
            ))}
            <TableCell onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onArchive(r.id)}>Archive</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(r.id)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function KanbanView({
  records, statuses, onStatusChange, onOpen,
}: {
  records: CustomRecord[];
  statuses: string[];
  onStatusChange: (id: string, status: string) => void;
  onOpen: (id: string) => void;
}) {
  const columns = useMemo(() => {
    const map = new Map<string, CustomRecord[]>();
    statuses.forEach((s) => map.set(s, []));
    const unassigned: CustomRecord[] = [];
    records.forEach((r) => {
      const s = r.status ?? "";
      if (s && map.has(s)) map.get(s)!.push(r);
      else if (s) {
        map.set(s, [r]);
      } else unassigned.push(r);
    });
    const cols = Array.from(map.entries());
    if (unassigned.length > 0) cols.unshift(["(no status)", unassigned]);
    return cols;
  }, [records, statuses]);

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {columns.map(([status, items]) => (
        <div key={status} className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide">{status}</span>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{items.length}</Badge>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {items.map((r) => (
              <div
                key={r.id}
                onClick={() => onOpen(r.id)}
                className="cursor-pointer rounded-md border bg-card p-2 shadow-sm hover:border-primary/50"
              >
                <p className="text-sm font-medium">{r.title}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </span>
                  <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5">
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Move to</div>
                      {statuses.filter((s) => s !== r.status).map((s) => (
                        <DropdownMenuItem key={s} onClick={() => onStatusChange(r.id, s)}>{s}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">Empty</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function GalleryView({
  records, visibleFields, color, onOpen,
}: {
  records: CustomRecord[];
  visibleFields: ObjectFieldDef[];
  color: string;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {records.map((r) => (
        <div
          key={r.id}
          onClick={() => onOpen(r.id)}
          className="cursor-pointer overflow-hidden rounded-lg border bg-card transition hover:border-primary/50 hover:shadow-md"
        >
          <div className="h-1.5" style={{ backgroundColor: color }} />
          <div className="p-3">
            <p className="font-medium">{r.title}</p>
            {r.status && <Badge variant="outline" className="mt-1">{r.status}</Badge>}
            <dl className="mt-3 space-y-1 text-xs">
              {visibleFields.map((f) => (
                <div key={f.id} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{f.name}</dt>
                  <dd className="truncate text-right">{renderFieldValue(f, (r.values ?? {})[f.id])}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ))}
    </div>
  );
}
