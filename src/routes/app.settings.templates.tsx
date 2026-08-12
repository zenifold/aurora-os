import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2, Pencil, GripVertical, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useVocabulary } from "@/hooks/use-vocabulary";
import {
  listProjectTemplates,
  upsertProjectTemplate,
  deleteProjectTemplate,
  seedStarterTemplates,
} from "@/lib/templates.functions";
import { listTemplatePhases, replaceTemplatePhases } from "@/lib/phases.functions";

export const Route = createFileRoute("/app/settings/templates")({ component: TemplatesSettings });

const CATEGORIES = ["web_build", "retainer", "consulting", "implementation", "custom"] as const;
const KINDS = ["milestone", "task", "raid", "doc_folder", "channel", "meeting", "automation", "intake_form", "role_slot"] as const;

type Item = {
  id?: string;
  kind: typeof KINDS[number];
  title: string;
  payload?: Record<string, unknown>;
  order_index?: number;
  phase_key?: string | null;
};
type Phase = {
  key: string;
  name: string;
  color?: string | null;
  owner_role?: string | null;
  target_days?: number | null;
  is_terminal?: boolean;
  entry_criteria?: string[];
  exit_criteria?: string[];
};
type Template = {
  id: string;
  name: string;
  description: string | null;
  category: typeof CATEGORIES[number];
  default_duration_days: number | null;
  is_active: boolean;
  items: Item[];
};

const PHASE_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

function slugifyKey(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "phase";
}

function TemplatesSettings() {
  const ws = useWorkspaceStore((s) => s.current);
  const vocab = useVocabulary();
  const qc = useQueryClient();
  const listFn = useServerFn(listProjectTemplates);
  const upsertFn = useServerFn(upsertProjectTemplate);
  const deleteFn = useServerFn(deleteProjectTemplate);
  const seedFn = useServerFn(seedStarterTemplates);
  const listPhasesFn = useServerFn(listTemplatePhases);
  const replacePhasesFn = useServerFn(replaceTemplatePhases);

  const { data = [], isLoading } = useQuery({
    queryKey: ["project-templates", ws?.id],
    queryFn: () => listFn({ data: { workspace_id: ws!.id } }),
    enabled: !!ws?.id,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["project-templates", ws?.id] });

  const seedMut = useMutation({
    mutationFn: () => seedFn({ data: { workspace_id: ws!.id } }),
    onSuccess: () => { invalidate(); toast.success("Starter templates added"); },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Template deleted"); },
  });

  const [editing, setEditing] = useState<Partial<Template> | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);

  // Load phases when editing an existing template.
  useEffect(() => {
    if (editing?.id) {
      listPhasesFn({ data: { template_id: editing.id } })
        .then((rows) =>
          setPhases(
            (rows ?? []).map((r) => ({
              key: r.key,
              name: r.name,
              color: r.color,
              owner_role: r.owner_role,
              target_days: r.target_days,
              is_terminal: r.is_terminal,
              entry_criteria: Array.isArray(r.entry_criteria) ? (r.entry_criteria as string[]) : [],
              exit_criteria: Array.isArray(r.exit_criteria) ? (r.exit_criteria as string[]) : [],
            })),
          ),
        )
        .catch(() => setPhases([]));
    } else {
      setPhases([]);
    }
  }, [editing?.id, listPhasesFn]);

  const openNew = () => {
    setEditing({ name: "", description: "", category: "custom", default_duration_days: 30, is_active: true });
    setItems([]);
    setPhases([]);
  };
  const openEdit = (t: Template) => {
    setEditing(t);
    setItems((t.items ?? []).map((i, idx) => ({ ...i, order_index: i.order_index ?? idx })));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const saved = await upsertFn({
        data: {
          id: editing?.id,
          workspace_id: ws!.id,
          name: editing!.name!,
          description: editing?.description ?? null,
          category: editing?.category,
          default_duration_days: editing?.default_duration_days ?? 30,
          is_active: editing?.is_active ?? true,
          items: items.map((it, idx) => ({
            ...it,
            order_index: idx,
            payload: { ...(it.payload ?? {}), phase_key: it.phase_key ?? null },
          })),
        },
      });
      // Save phases against the (possibly newly created) template id.
      await replacePhasesFn({
        data: {
          template_id: saved.id,
          phases: phases.map((p, idx) => ({
            key: p.key,
            name: p.name,
            order_index: idx,
            color: p.color ?? null,
            owner_role: p.owner_role ?? null,
            target_days: p.target_days ?? null,
            is_terminal: p.is_terminal ?? false,
            entry_criteria: p.entry_criteria ?? [],
            exit_criteria: p.exit_criteria ?? [],
          })),
        },
      });
      return saved;
    },
    onSuccess: () => { setEditing(null); invalidate(); toast.success("Template saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPhase = () => {
    const base = `${vocab.phase.singular} ${phases.length + 1}`;
    let key = slugifyKey(base);
    let n = 1;
    while (phases.some((p) => p.key === key)) {
      key = slugifyKey(`${base}-${++n}`);
    }
    setPhases([
      ...phases,
      {
        key,
        name: base,
        color: PHASE_COLORS[phases.length % PHASE_COLORS.length],
        target_days: null,
        is_terminal: false,
        entry_criteria: [],
        exit_criteria: [],
      },
    ]);
  };

  const updatePhase = (idx: number, patch: Partial<Phase>) => {
    setPhases(phases.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const movePhase = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= phases.length) return;
    const next = [...phases];
    [next[idx], next[target]] = [next[target], next[idx]];
    setPhases(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">{vocab.engagement.singular} templates</h2>
          <p className="text-sm text-muted-foreground">
            Reusable blueprints for new {vocab.engagement.plural.toLowerCase()} and onboardings — define {vocab.phase.plural.toLowerCase()}, work items, and team shape.
          </p>
        </div>
        <div className="flex gap-2">
          {data.length === 0 && (
            <Button variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
              <Sparkles className="h-4 w-4 mr-1" /> Seed starters
            </Button>
          )}
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New template</Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {data.map((t) => (
          <Card key={t.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline">{t.category}</Badge>
                  <Badge variant="secondary">{t.items?.length ?? 0} items</Badge>
                  {!t.is_active && <Badge variant="destructive">inactive</Badge>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(t as Template)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this template?")) delMut.mutate(t.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
          </Card>
        ))}
        {!isLoading && data.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground col-span-full">
            No templates yet. Seed starters or create one.
          </Card>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit template" : "New template"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="phases">
                  <Layers className="h-3.5 w-3.5 mr-1" />
                  {vocab.phase.plural} <span className="ml-1 text-xs opacity-60">({phases.length})</span>
                </TabsTrigger>
                <TabsTrigger value="items">Items <span className="ml-1 text-xs opacity-60">({items.length})</span></TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} /></div>
                  <div>
                    <Label>Category</Label>
                    <Select value={editing.category ?? "custom"} onValueChange={(v) => setEditing({ ...editing, category: v as typeof CATEGORIES[number] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Default duration (days)</Label>
                    <Input type="number" value={editing.default_duration_days ?? 30} onChange={(e) => setEditing({ ...editing, default_duration_days: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="phases" className="space-y-3 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Define the ordered {vocab.phase.plural.toLowerCase()} every {vocab.engagement.singular.toLowerCase()} created from this template will move through.
                  </p>
                  <Button size="sm" variant="outline" onClick={addPhase}>
                    <Plus className="h-3 w-3 mr-1" /> Add {vocab.phase.singular.toLowerCase()}
                  </Button>
                </div>
                <div className="space-y-2">
                  {phases.map((p, idx) => (
                    <Card key={idx} className="p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => movePhase(idx, -1)} disabled={idx === 0}>
                            <GripVertical className="h-4 w-4" />
                          </button>
                        </div>
                        <span className="text-xs text-muted-foreground w-5 text-center">{idx + 1}</span>
                        <input
                          type="color"
                          value={p.color ?? PHASE_COLORS[idx % PHASE_COLORS.length]}
                          onChange={(e) => updatePhase(idx, { color: e.target.value })}
                          className="h-7 w-7 rounded border bg-background"
                          aria-label="Color"
                        />
                        <Input
                          placeholder="Name"
                          value={p.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            // auto-update key from name if user hasn't customized it
                            const autoKey = slugifyKey(p.name);
                            const next: Partial<Phase> = { name };
                            if (p.key === autoKey || !p.key) next.key = slugifyKey(name);
                            updatePhase(idx, next);
                          }}
                          className="flex-1"
                        />
                        <Input
                          placeholder="key"
                          value={p.key}
                          onChange={(e) => updatePhase(idx, { key: slugifyKey(e.target.value) })}
                          className="w-36 font-mono text-xs"
                        />
                        <Button size="icon" variant="ghost" onClick={() => setPhases(phases.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pl-9">
                        <div>
                          <Label className="text-xs">Owner role</Label>
                          <Input
                            placeholder="e.g. delivery"
                            value={p.owner_role ?? ""}
                            onChange={(e) => updatePhase(idx, { owner_role: e.target.value || null })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Target (days)</Label>
                          <Input
                            type="number"
                            value={p.target_days ?? ""}
                            onChange={(e) => updatePhase(idx, { target_days: e.target.value === "" ? null : parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <Switch
                            checked={p.is_terminal ?? false}
                            onCheckedChange={(v) => updatePhase(idx, { is_terminal: v })}
                          />
                          <Label className="text-xs">Terminal {vocab.phase.singular.toLowerCase()}</Label>
                        </div>
                      </div>
                      <div className="pl-9">
                        <Label className="text-xs">Exit criteria (one per line)</Label>
                        <Textarea
                          rows={2}
                          placeholder="e.g. Scope signed off&#10;Budget approved"
                          value={(p.exit_criteria ?? []).join("\n")}
                          onChange={(e) =>
                            updatePhase(idx, {
                              exit_criteria: e.target.value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      </div>
                    </Card>
                  ))}
                  {phases.length === 0 && (
                    <Card className="p-6 text-center text-sm text-muted-foreground">
                      No {vocab.phase.plural.toLowerCase()} yet. {vocab.engagement.plural} using this template will be freeform until you add some.
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="items" className="space-y-2 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Pre-filled work items (milestones, tasks, channels) — optionally bound to a {vocab.phase.singular.toLowerCase()}.</p>
                  <Button size="sm" variant="outline" onClick={() => setItems([...items, { kind: "task", title: "", payload: {}, phase_key: null }])}>
                    <Plus className="h-3 w-3 mr-1" /> Add item
                  </Button>
                </div>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Select value={it.kind} onValueChange={(v) => {
                        const next = [...items]; next[idx] = { ...it, kind: v as typeof KINDS[number] }; setItems(next);
                      }}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k.replace("_", " ")}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input
                        placeholder="Title"
                        value={it.title}
                        onChange={(e) => { const next = [...items]; next[idx] = { ...it, title: e.target.value }; setItems(next); }}
                      />
                      <Select
                        value={it.phase_key ?? "__none"}
                        onValueChange={(v) => {
                          const next = [...items];
                          next[idx] = { ...it, phase_key: v === "__none" ? null : v };
                          setItems(next);
                        }}
                      >
                        <SelectTrigger className="w-40"><SelectValue placeholder={vocab.phase.singular} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">— No {vocab.phase.singular.toLowerCase()} —</SelectItem>
                          {phases.map((p) => (
                            <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {it.kind === "milestone" && (
                        <Input
                          placeholder="Day"
                          type="number"
                          className="w-20"
                          value={(it.payload?.offset_days as number) ?? 0}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...it, payload: { ...(it.payload ?? {}), offset_days: parseInt(e.target.value) || 0 } };
                            setItems(next);
                          }}
                        />
                      )}
                      <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-xs text-muted-foreground">No items yet.</p>}
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!editing?.name || saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
