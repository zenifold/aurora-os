import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Rocket,
  Trash2,
  Pencil,
  Flag,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  usePlaybooks,
  usePlaybook,
  useCreatePlaybook,
  useUpdatePlaybook,
  useDeletePlaybook,
  useUpsertPlaybookMilestone,
  useDeletePlaybookMilestone,
  useUpsertPlaybookTask,
  useDeletePlaybookTask,
} from "@/hooks/use-playbooks";
import { PLAYBOOK_KIND_META, type PlaybookKind, type PlaybookMilestone, type PlaybookTask } from "@/lib/playbook-types";
import { MILESTONE_TYPE_META, type MilestoneType } from "@/lib/milestone-types";

export const Route = createFileRoute("/app/settings/playbooks")({
  head: () => ({ meta: [{ title: "Project playbooks" }] }),
  component: PlaybooksPage,
});

function PlaybooksPage() {
  const { data: playbooks = [] } = usePlaybooks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  if (selectedId) {
    return <PlaybookDetail playbookId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Project playbooks</h2>
          <p className="text-xs text-muted-foreground">
            Reusable project blueprints. Apply one to spawn milestones and tasks with relative
            dates, in one click.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New playbook
        </Button>
      </div>

      {playbooks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Rocket className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">No playbooks yet</p>
            <p className="text-xs text-muted-foreground">
              Build one once, reuse it on every similar engagement.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Create your first playbook
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {playbooks.map((p) => {
            const meta = PLAYBOOK_KIND_META[p.kind as PlaybookKind] ?? PLAYBOOK_KIND_META.custom;
            return (
              <Card
                key={p.id}
                className="cursor-pointer p-4 transition hover:border-primary/40"
                onClick={() => setSelectedId(p.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Rocket className="h-4 w-4" style={{ color: p.color }} />
                      <h3 className="truncate text-sm font-semibold">{p.name}</h3>
                    </div>
                    {p.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className={meta.tone}>{meta.label}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{p.default_duration_days}d default</span>
                  <span>·</span>
                  <span>Used {p.usage_count}×</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreatePlaybookDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setCreateOpen(false);
          setSelectedId(id);
        }}
      />
    </div>
  );
}

function CreatePlaybookDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const create = useCreatePlaybook();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<PlaybookKind>("delivery");
  const [duration, setDuration] = useState(30);

  const submit = async () => {
    if (!name.trim()) return;
    const pb = await create.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      kind,
      default_duration_days: duration,
    });
    setName("");
    setDescription("");
    onCreated(pb.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New playbook</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Implementation kickoff" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as PlaybookKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PLAYBOOK_KIND_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Default duration (days)</Label>
              <Input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlaybookDetail({ playbookId, onBack }: { playbookId: string; onBack: () => void }) {
  const { data } = usePlaybook(playbookId);
  const update = useUpdatePlaybook();
  const del = useDeletePlaybook();
  const upsertMs = useUpsertPlaybookMilestone();
  const delMs = useDeletePlaybookMilestone();
  const upsertTask = useUpsertPlaybookTask();
  const delTask = useDeletePlaybookTask();

  const [msExpanded, setMsExpanded] = useState(true);
  const [taskExpanded, setTaskExpanded] = useState(true);
  const [editingMs, setEditingMs] = useState<Partial<PlaybookMilestone> | null>(null);
  const [editingTask, setEditingTask] = useState<Partial<PlaybookTask> | null>(null);

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading playbook…</div>;
  const { playbook, milestones, tasks } = data;

  const handleDelete = async () => {
    if (!confirm(`Delete playbook "${playbook.name}"? This cannot be undone.`)) return;
    await del.mutateAsync(playbook.id);
    onBack();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2 h-7 gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> All playbooks
          </Button>
          <Input
            className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            value={playbook.name}
            onChange={(e) => update.mutate({ id: playbook.id, name: e.target.value })}
          />
          <Textarea
            placeholder="Add a description…"
            className="border-0 px-0 text-xs shadow-none focus-visible:ring-0"
            value={playbook.description ?? ""}
            onChange={(e) => update.mutate({ id: playbook.id, description: e.target.value })}
            rows={2}
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleDelete} className="text-rose-600">
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
        </Button>
      </div>

      {/* Milestones */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 text-sm font-medium" onClick={() => setMsExpanded((v) => !v)}>
            {msExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <Flag className="h-4 w-4" />
            Milestones <span className="text-muted-foreground">({milestones.length})</span>
          </button>
          <Button size="sm" variant="outline" onClick={() => setEditingMs({ playbook_id: playbookId, name: "", milestone_type: "delivery", day_offset: 0, requires_signoff: false, order_index: milestones.length })}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {msExpanded && (
          <div className="mt-3 space-y-2">
            {milestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="secondary" className={MILESTONE_TYPE_META[m.milestone_type as MilestoneType].tone}>
                    {MILESTONE_TYPE_META[m.milestone_type as MilestoneType].label}
                  </Badge>
                  <span className="truncate text-sm">{m.name}</span>
                  {m.requires_signoff && <Badge variant="outline" className="text-[10px]">Sign-off</Badge>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Day +{m.day_offset}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingMs(m)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={() => delMs.mutate({ id: m.id, playbook_id: playbookId })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {milestones.length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">No milestones yet</p>
            )}
          </div>
        )}
      </Card>

      {/* Tasks */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 text-sm font-medium" onClick={() => setTaskExpanded((v) => !v)}>
            {taskExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <CheckSquare className="h-4 w-4" />
            Tasks <span className="text-muted-foreground">({tasks.length})</span>
          </button>
          <Button size="sm" variant="outline" onClick={() => setEditingTask({ playbook_id: playbookId, title: "", priority: "medium", task_type: "task", is_customer_task: false, order_index: tasks.length, tags: [] })}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {taskExpanded && (
          <div className="mt-3 space-y-2">
            {tasks.map((t) => {
              const ms = t.playbook_milestone_id ? milestones.find((m) => m.id === t.playbook_milestone_id) : null;
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    {t.is_customer_task && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Users className="h-3 w-3" /> Customer
                      </Badge>
                    )}
                    <span className="truncate text-sm">{t.title}</span>
                    {ms && <span className="truncate text-xs text-muted-foreground">· {ms.name}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {t.day_offset_due != null && <span>Due +{t.day_offset_due}d</span>}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTask(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={() => delTask.mutate({ id: t.id, playbook_id: playbookId })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {tasks.length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">No tasks yet</p>
            )}
          </div>
        )}
      </Card>

      {editingMs && (
        <MilestoneEditDialog
          value={editingMs}
          onClose={() => setEditingMs(null)}
          onSave={async (v) => {
            await upsertMs.mutateAsync(v as PlaybookMilestone & { playbook_id: string; name: string });
            setEditingMs(null);
          }}
        />
      )}
      {editingTask && (
        <TaskEditDialog
          value={editingTask}
          milestones={milestones}
          onClose={() => setEditingTask(null)}
          onSave={async (v) => {
            await upsertTask.mutateAsync(v as PlaybookTask & { playbook_id: string; title: string });
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}

function MilestoneEditDialog({
  value,
  onClose,
  onSave,
}: {
  value: Partial<PlaybookMilestone>;
  onClose: () => void;
  onSave: (v: Partial<PlaybookMilestone>) => void;
}) {
  const [v, setV] = useState(value);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{v.id ? "Edit milestone" : "Add milestone"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={v.name ?? ""} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={v.milestone_type ?? "delivery"} onValueChange={(x) => setV({ ...v, milestone_type: x as MilestoneType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MILESTONE_TYPE_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Day offset from start</Label>
              <Input
                type="number"
                value={v.day_offset ?? 0}
                onChange={(e) => setV({ ...v, day_offset: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Requires client sign-off</Label>
            <Switch
              checked={v.requires_signoff ?? false}
              onCheckedChange={(c) => setV({ ...v, requires_signoff: c })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(v)} disabled={!v.name?.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskEditDialog({
  value,
  milestones,
  onClose,
  onSave,
}: {
  value: Partial<PlaybookTask>;
  milestones: PlaybookMilestone[];
  onClose: () => void;
  onSave: (v: Partial<PlaybookTask>) => void;
}) {
  const [v, setV] = useState(value);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{v.id ? "Edit task" : "Add task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={v.title ?? ""} onChange={(e) => setV({ ...v, title: e.target.value })} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Day offset start</Label>
              <Input
                type="number"
                placeholder="—"
                value={v.day_offset_start ?? ""}
                onChange={(e) => setV({ ...v, day_offset_start: e.target.value === "" ? null : parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Day offset due</Label>
              <Input
                type="number"
                placeholder="—"
                value={v.day_offset_due ?? ""}
                onChange={(e) => setV({ ...v, day_offset_due: e.target.value === "" ? null : parseInt(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={v.priority ?? "medium"} onValueChange={(x) => setV({ ...v, priority: x as PlaybookTask["priority"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low", "medium", "high", "urgent"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Linked milestone</Label>
              <Select
                value={v.playbook_milestone_id ?? "_none"}
                onValueChange={(x) => setV({ ...v, playbook_milestone_id: x === "_none" ? null : x })}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {milestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Assignee role hint (optional)</Label>
            <Input
              placeholder="e.g. Lead consultant, Customer PM"
              value={v.assignee_role_hint ?? ""}
              onChange={(e) => setV({ ...v, assignee_role_hint: e.target.value || null })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Customer-side task</Label>
              <p className="text-[11px] text-muted-foreground">Will be flagged for the client portal</p>
            </div>
            <Switch
              checked={v.is_customer_task ?? false}
              onCheckedChange={(c) => setV({ ...v, is_customer_task: c })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(v)} disabled={!v.title?.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
