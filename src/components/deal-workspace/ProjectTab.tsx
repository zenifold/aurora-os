import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, KanbanSquare, Zap, CalendarRange, Flag, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  listDealTasks, createDealTask, updateDealTask, deleteDealTask,
  listDealSprints, createDealSprint, updateDealSprint, deleteDealSprint,
  listDealPhases, listDealMilestones,
  type DealTask, type DealSprint, type DealPhase, type DealMilestone,
} from "@/lib/deal-workspace.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUSES: { id: DealTask["status"]; label: string; tone: string }[] = [
  { id: "todo", label: "To do", tone: "bg-muted" },
  { id: "in_progress", label: "In progress", tone: "bg-blue-500/10" },
  { id: "review", label: "Review", tone: "bg-amber-500/10" },
  { id: "done", label: "Done", tone: "bg-emerald-500/10" },
  { id: "blocked", label: "Blocked", tone: "bg-destructive/10" },
];

const PRIORITY_TONE: Record<DealTask["priority"], string> = {
  low: "text-muted-foreground",
  medium: "text-foreground",
  high: "text-amber-600 dark:text-amber-400",
  urgent: "text-destructive",
};

export function ProjectTab({ dealId }: { dealId: string }) {
  return (
    <Tabs defaultValue="board" className="space-y-4">
      <div className="-mx-3 sm:mx-0 overflow-x-auto no-scrollbar px-3 sm:px-0">
        <TabsList className="w-max">
          <TabsTrigger value="board"><KanbanSquare className="h-4 w-4 mr-1.5" />Board</TabsTrigger>
          <TabsTrigger value="sprints"><Zap className="h-4 w-4 mr-1.5" />Sprints</TabsTrigger>
          <TabsTrigger value="timeline"><CalendarRange className="h-4 w-4 mr-1.5" />Timeline</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="board" className="mt-0"><BoardView dealId={dealId} /></TabsContent>
      <TabsContent value="sprints" className="mt-0"><SprintsView dealId={dealId} /></TabsContent>
      <TabsContent value="timeline" className="mt-0"><TimelineView dealId={dealId} /></TabsContent>
    </Tabs>
  );
}

// ---------- shared hooks ----------
function useProjectData(dealId: string) {
  const listTasks = useServerFn(listDealTasks);
  const listSprints = useServerFn(listDealSprints);
  const listPhases = useServerFn(listDealPhases);
  const listMilestones = useServerFn(listDealMilestones);
  const { data: tasks = [] } = useQuery({ queryKey: ["deal-tasks", dealId], queryFn: () => listTasks({ data: { deal_id: dealId } }) });
  const { data: sprints = [] } = useQuery({ queryKey: ["deal-sprints", dealId], queryFn: () => listSprints({ data: { deal_id: dealId } }) });
  const { data: phases = [] } = useQuery({ queryKey: ["deal-phases", dealId], queryFn: () => listPhases({ data: { deal_id: dealId } }) });
  const { data: milestones = [] } = useQuery({ queryKey: ["deal-milestones", dealId], queryFn: () => listMilestones({ data: { deal_id: dealId } }) });
  return { tasks: tasks as DealTask[], sprints: sprints as DealSprint[], phases: phases as DealPhase[], milestones: milestones as DealMilestone[] };
}

// ---------- Board (Kanban) ----------
function BoardView({ dealId }: { dealId: string }) {
  const { tasks, sprints, phases, milestones } = useProjectData(dealId);
  const update = useServerFn(updateDealTask);
  const qc = useQueryClient();
  const [filterSprint, setFilterSprint] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DealTask | null>(null);

  const filtered = filterSprint === "all"
    ? tasks
    : filterSprint === "none"
      ? tasks.filter(t => !t.sprint_id)
      : tasks.filter(t => t.sprint_id === filterSprint);

  const onDrop = async (taskId: string, status: DealTask["status"]) => {
    await update({ data: { id: taskId, status } });
    qc.invalidateQueries({ queryKey: ["deal-tasks", dealId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filterSprint} onValueChange={setFilterSprint}>
          <SelectTrigger className="flex-1 min-w-[160px] sm:w-56 sm:flex-none h-9"><SelectValue placeholder="All tasks" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tasks</SelectItem>
            <SelectItem value="none">Unassigned to sprint</SelectItem>
            {sprints.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New task
        </Button>
        <div className="text-xs text-muted-foreground w-full sm:w-auto sm:ml-2">{filtered.length} task{filtered.length === 1 ? "" : "s"}</div>
      </div>

      {/* Mobile: horizontal snap rail. Desktop: grid. */}
      <div className="-mx-3 sm:mx-0 flex md:grid md:grid-cols-3 lg:grid-cols-5 gap-3 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none no-scrollbar px-3 sm:px-0 pb-2">
        {STATUSES.map(col => {
          const items = filtered.filter(t => t.status === col.id);
          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/plain");
                if (id) onDrop(id, col.id);
              }}
              className={cn(
                "rounded-lg border border-border/60 p-2 min-h-[200px]",
                "shrink-0 w-[85vw] sm:w-[60vw] md:w-auto snap-center",
                col.tone,
              )}
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</div>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(t => (
                  <TaskCard key={t.id} task={t} phases={phases} milestones={milestones} sprints={sprints}
                    onClick={() => { setEditing(t); setOpen(true); }} />
                ))}
                {items.length === 0 && <div className="text-xs text-muted-foreground italic px-1 py-3">No tasks</div>}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog dealId={dealId} open={open} onOpenChange={setOpen} task={editing}
        phases={phases} milestones={milestones} sprints={sprints} />
    </div>
  );
}

function TaskCard({ task, phases, milestones, sprints, onClick }: {
  task: DealTask; phases: DealPhase[]; milestones: DealMilestone[]; sprints: DealSprint[]; onClick: () => void;
}) {
  const phase = phases.find(p => p.id === task.phase_id);
  const sprint = sprints.find(s => s.id === task.sprint_id);
  const milestone = milestones.find(m => m.id === task.milestone_id);
  return (
    <Card
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      onClick={onClick}
      className="p-2.5 cursor-pointer hover:shadow-md transition-shadow space-y-1.5"
    >
      <div className="text-sm font-medium leading-snug">{task.title}</div>
      <div className="flex flex-wrap gap-1 items-center">
        {task.priority !== "medium" && (
          <Badge variant="outline" className={cn("text-[10px] h-4 px-1", PRIORITY_TONE[task.priority])}>{task.priority}</Badge>
        )}
        {phase && <Badge variant="secondary" className="text-[10px] h-4 px-1">{phase.name}</Badge>}
        {sprint && <Badge variant="outline" className="text-[10px] h-4 px-1"><Zap className="h-2.5 w-2.5 mr-0.5" />{sprint.name}</Badge>}
        {milestone && <Badge variant="outline" className="text-[10px] h-4 px-1"><Flag className="h-2.5 w-2.5 mr-0.5" />{milestone.title}</Badge>}
        {task.estimate_hours != null && (
          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{task.estimate_hours}h</span>
        )}
        {task.due_date && (
          <span className="text-[10px] text-muted-foreground">due {new Date(task.due_date).toLocaleDateString()}</span>
        )}
      </div>
    </Card>
  );
}

function TaskDialog({ dealId, open, onOpenChange, task, phases, milestones, sprints }: {
  dealId: string; open: boolean; onOpenChange: (v: boolean) => void; task: DealTask | null;
  phases: DealPhase[]; milestones: DealMilestone[]; sprints: DealSprint[];
}) {
  const create = useServerFn(createDealTask);
  const update = useServerFn(updateDealTask);
  const remove = useServerFn(deleteDealTask);
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["deal-tasks", dealId] });

  const [form, setForm] = useState(() => initForm(task));
  // reset when task changes
  useMemoReset(task, () => setForm(initForm(task)));

  const save = async () => {
    if (!form.title.trim()) return;
    if (task) {
      await update({ data: { id: task.id, ...form, estimate_hours: form.estimate_hours === "" ? null : Number(form.estimate_hours) } as any });
    } else {
      await create({ data: { deal_id: dealId, ...form, estimate_hours: form.estimate_hours === "" ? null : Number(form.estimate_hours) } as any });
    }
    toast.success(task ? "Updated" : "Created");
    inv();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea placeholder="Description (optional)" rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.phase_id ?? "_none"} onValueChange={(v) => setForm({ ...form, phase_id: v === "_none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Phase" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— No phase —</SelectItem>
                {phases.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.sprint_id ?? "_none"} onValueChange={(v) => setForm({ ...form, sprint_id: v === "_none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Sprint" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Backlog —</SelectItem>
                {sprints.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.milestone_id ?? "_none"} onValueChange={(v) => setForm({ ...form, milestone_id: v === "_none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Milestone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— No milestone —</SelectItem>
                {milestones.map(m => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Estimate (hrs)" value={form.estimate_hours} onChange={(e) => setForm({ ...form, estimate_hours: e.target.value })} />
            <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value || null })} />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          {task && (
            <Button variant="ghost" className="text-destructive sm:mr-auto" onClick={async () => {
              await remove({ data: { id: task.id } }); inv(); onOpenChange(false); toast.success("Deleted");
            }}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>{task ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function initForm(task: DealTask | null) {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: (task?.status ?? "todo") as DealTask["status"],
    priority: (task?.priority ?? "medium") as DealTask["priority"],
    phase_id: task?.phase_id ?? null,
    sprint_id: task?.sprint_id ?? null,
    milestone_id: task?.milestone_id ?? null,
    estimate_hours: (task?.estimate_hours ?? "") as number | string,
    due_date: task?.due_date ?? null,
  };
}

// reset helper without external dep
function useMemoReset<T>(key: T, fn: () => void) {
  useMemo(() => { fn(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
}

// ---------- Sprints ----------
function SprintsView({ dealId }: { dealId: string }) {
  const { tasks, sprints } = useProjectData(dealId);
  const create = useServerFn(createDealSprint);
  const update = useServerFn(updateDealSprint);
  const remove = useServerFn(deleteDealSprint);
  const updateTask = useServerFn(updateDealTask);
  const qc = useQueryClient();
  const inv = () => { qc.invalidateQueries({ queryKey: ["deal-sprints", dealId] }); qc.invalidateQueries({ queryKey: ["deal-tasks", dealId] }); };

  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const backlog = tasks.filter(t => !t.sprint_id);

  const assign = async (taskId: string, sprintId: string | null) => {
    await updateTask({ data: { id: taskId, sprint_id: sprintId } });
    inv();
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:flex-wrap">
          <Input placeholder="Sprint name (e.g. Sprint 1)" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-[180px]" />
          <div className="grid grid-cols-2 sm:flex gap-2">
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="sm:w-40" />
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="sm:w-40" />
          </div>
          <Button disabled={!name.trim()} onClick={async () => {
            await create({ data: { deal_id: dealId, name, start_date: start || null, end_date: end || null } });
            setName(""); setStart(""); setEnd(""); inv(); toast.success("Sprint created");
          }}><Plus className="h-4 w-4 mr-1" />Add sprint</Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {sprints.map(s => {
          const items = tasks.filter(t => t.sprint_id === s.id);
          const totalHours = items.reduce((a, t) => a + (Number(t.estimate_hours) || 0), 0);
          const done = items.filter(t => t.status === "done").length;
          return (
            <Card key={s.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                const id = e.dataTransfer.getData("text/plain");
                if (id) assign(id, s.id);
              }}
              className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{s.name}</h3>
                    <Select value={s.status} onValueChange={async (v) => { await update({ data: { id: s.id, status: v as any } }); inv(); }}>
                      <SelectTrigger className="h-6 text-xs w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(s.start_date || s.end_date) && (
                    <div className="text-xs text-muted-foreground">
                      {s.start_date ? new Date(s.start_date).toLocaleDateString() : "?"} → {s.end_date ? new Date(s.end_date).toLocaleDateString() : "?"}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={async () => { await remove({ data: { id: s.id } }); inv(); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>{items.length} task{items.length === 1 ? "" : "s"}</span>
                <span>{done}/{items.length} done</span>
                {totalHours > 0 && <span>{totalHours}h estimated</span>}
              </div>
              <div className="space-y-1">
                {items.map(t => (
                  <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-accent text-sm group">
                    <div className={cn("h-1.5 w-1.5 rounded-full",
                      t.status === "done" ? "bg-emerald-500" : t.status === "blocked" ? "bg-destructive" : t.status === "in_progress" ? "bg-blue-500" : "bg-muted-foreground")} />
                    <span className="flex-1 truncate">{t.title}</span>
                    {t.estimate_hours != null && <span className="text-[10px] text-muted-foreground">{t.estimate_hours}h</span>}
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-60 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      onClick={() => assign(t.id, null)}>
                      <AlertCircle className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {items.length === 0 && <p className="text-xs text-muted-foreground italic">Drop tasks from backlog</p>}
              </div>
            </Card>
          );
        })}

        <Card className="p-4 space-y-3 border-dashed">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-muted-foreground">Backlog</h3>
            <Badge variant="secondary">{backlog.length}</Badge>
          </div>
          <div className="space-y-1">
            {backlog.map(t => (
              <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                className="flex items-center gap-2 p-1.5 rounded hover:bg-accent text-sm cursor-grab">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                <span className="flex-1 truncate">{t.title}</span>
                {t.estimate_hours != null && <span className="text-[10px] text-muted-foreground">{t.estimate_hours}h</span>}
              </div>
            ))}
            {backlog.length === 0 && <p className="text-xs text-muted-foreground italic">All tasks are in sprints</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- Timeline ----------
function TimelineView({ dealId }: { dealId: string }) {
  const { phases, milestones, tasks, sprints } = useProjectData(dealId);

  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Flag className="h-4 w-4" />Milestones</h3>
        {milestones.length === 0 ? <p className="text-sm text-muted-foreground">No milestones yet.</p> : (
          <div className="relative pl-6 space-y-3 border-l-2 border-border">
            {[...milestones].sort((a, b) => (a.target_date ?? "").localeCompare(b.target_date ?? "")).map(m => {
              const linked = tasks.filter(t => t.milestone_id === m.id);
              const done = linked.filter(t => t.status === "done").length;
              return (
                <div key={m.id} className="relative">
                  <div className={cn("absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2",
                    m.status === "done" ? "bg-emerald-500 border-emerald-500" :
                    m.status === "at_risk" ? "bg-amber-500 border-amber-500" :
                    m.status === "missed" ? "bg-destructive border-destructive" :
                    "bg-background border-primary")} />
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{m.title}</span>
                    {m.target_date && <span className="text-xs text-muted-foreground">{new Date(m.target_date).toLocaleDateString()}</span>}
                  </div>
                  {linked.length > 0 && (
                    <p className="text-xs text-muted-foreground">{done}/{linked.length} task{linked.length === 1 ? "" : "s"} done</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Phases & sprints</h3>
        {phases.length === 0 && sprints.length === 0 ? <p className="text-sm text-muted-foreground">Add phases or sprints on the Plans/Sprints tab.</p> : (
          <div className="space-y-2">
            {phases.map((p, i) => {
              const phaseTasks = tasks.filter(t => t.phase_id === p.id);
              const done = phaseTasks.filter(t => t.status === "done").length;
              const pct = phaseTasks.length ? Math.round((done / phaseTasks.length) * 100) : 0;
              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span><span className="text-muted-foreground mr-2">{i + 1}.</span>{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.duration_weeks ? `${p.duration_weeks}w` : ""} · {done}/{phaseTasks.length}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {sprints.length > 0 && phases.length > 0 && <div className="border-t my-3" />}
            {sprints.map(s => {
              const sprintTasks = tasks.filter(t => t.sprint_id === s.id);
              const done = sprintTasks.filter(t => t.status === "done").length;
              const pct = sprintTasks.length ? Math.round((done / sprintTasks.length) * 100) : 0;
              return (
                <div key={s.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5"><Zap className="h-3 w-3" />{s.name}</span>
                    <span className="text-xs text-muted-foreground">{done}/{sprintTasks.length}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
