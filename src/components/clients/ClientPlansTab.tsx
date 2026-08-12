import { useMemo, useState } from "react";
import { format, parseISO, differenceInDays, startOfDay } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Sparkles, Calendar, Target, Trash2, Pin, ListTodo } from "lucide-react";
import {
  useClientPlans,
  useCreateClientPlan,
  useDeleteClientPlan,
  useUpdateClientPlan,
  usePlanTimelineData,
  type ClientPlan,
} from "@/hooks/use-client-plans";
import { cn } from "@/lib/utils";

type PlanProject = { id: string; name: string; color?: string | null };

interface Props {
  clientAccountId: string;
  projects: PlanProject[];
}


export function ClientPlansTab({ clientAccountId, projects }: Props) {
  const { data: plans = [], isLoading } = useClientPlans(clientAccountId);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ClientPlan | null>(null);
  const create = useCreateClientPlan(clientAccountId);

  const handleQuickCreate = async (kind: "all" | "active") => {
    const ids =
      kind === "all"
        ? projects.map((p) => p.id)
        : projects.map((p) => p.id);

    const plan = await create.mutateAsync({
      name: kind === "all" ? "All engagements roadmap" : "Active delivery plan",
      layout: "timeline",
      config: { project_ids: ids, group_by: "engagement" },
    });
    setSelected(plan);
  };

  if (selected) {
    return (
      <PlanDetail
        plan={selected}
        projects={projects}
        onBack={() => setSelected(null)}
        clientAccountId={clientAccountId}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Plans</h3>
          <p className="text-sm text-muted-foreground">
            Saved timelines and task views across this client's engagements.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleQuickCreate("active")}>
            <Sparkles className="h-4 w-4 mr-1.5" /> Quick: active delivery
          </Button>
          <NewPlanDialog
            open={open}
            onOpenChange={setOpen}
            projects={projects}
            clientAccountId={clientAccountId}
            onCreated={(p) => {
              setOpen(false);
              setSelected(p);
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading plans…</div>
      ) : plans.length === 0 ? (
        <Card className="p-8 text-center">
          <ListTodo className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <h4 className="font-medium mb-1">No plans yet</h4>
          <p className="text-sm text-muted-foreground mb-4">
            A plan is a saved timeline across one or more engagements. Use them for roadmaps,
            launch plans, or quarterly views.
          </p>
          <Button onClick={() => setOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> Create plan
          </Button>
        </Card>
      ) : (
        <div className="grid gap-2">
          {plans.map((p) => {
            const ids = (p.config?.project_ids ?? []) as string[];
            return (
              <Card
                key={p.id}
                className="p-3 hover:bg-muted/40 cursor-pointer flex items-center justify-between"
                onClick={() => setSelected(p)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {p.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
                    <span className="font-medium truncate">{p.name}</span>
                    <Badge variant="outline" className="text-xs capitalize">{p.layout}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {ids.length} engagement{ids.length === 1 ? "" : "s"} ·{" "}
                    {format(parseISO(p.updated_at), "MMM d")}
                    {p.description ? ` · ${p.description}` : ""}
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">Open →</Badge>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewPlanDialog({
  open,
  onOpenChange,
  projects,
  clientAccountId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  projects: PlanProject[];
  clientAccountId: string;
  onCreated: (p: ClientPlan) => void;
}) {
  const create = useCreateClientPlan(clientAccountId);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const submit = async () => {
    if (!name.trim()) return;
    const plan = await create.mutateAsync({
      name: name.trim(),
      description: desc.trim() || undefined,
      layout: "timeline",
      config: {
        project_ids: Array.from(picked.size > 0 ? picked : new Set(projects.map((p) => p.id))),
        group_by: "engagement",
      },
    });
    setName("");
    setDesc("");
    setPicked(new Set());
    onCreated(plan);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> New plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q3 delivery roadmap"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="What this plan tracks…"
            />
          </div>
          <div>
            <Label className="text-xs">Include engagements</Label>
            <div className="border rounded-md max-h-48 overflow-auto p-2 space-y-1">
              {projects.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">No engagements yet.</p>
              ) : (
                projects.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={picked.has(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Leave empty to include all engagements.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Creating…" : "Create plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanDetail({
  plan,
  projects,
  onBack,
  clientAccountId,
}: {
  plan: ClientPlan;
  projects: PlanProject[];
  onBack: () => void;
  clientAccountId: string;
}) {
  const ids = (plan.config?.project_ids ?? []) as string[];
  const projectIds = ids.length > 0 ? ids : projects.map((p) => p.id);
  const { data, isLoading } = usePlanTimelineData(projectIds);
  const update = useUpdateClientPlan(clientAccountId);
  const del = useDeleteClientPlan(clientAccountId);
  const [tab, setTab] = useState<"timeline" | "list">("timeline");

  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-1">
            ← Back to plans
          </Button>
          <h3 className="text-lg font-semibold truncate flex items-center gap-2">
            {plan.name}
            {plan.is_pinned && <Pin className="h-4 w-4 text-amber-500" />}
          </h3>
          {plan.description && (
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => update.mutate({ id: plan.id, is_pinned: !plan.is_pinned })}
          >
            <Pin className="h-4 w-4 mr-1.5" />
            {plan.is_pinned ? "Unpin" : "Pin"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`Delete plan "${plan.name}"?`)) {
                del.mutate(plan.id);
                onBack();
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "timeline" | "list")}>
        <TabsList>
          <TabsTrigger value="timeline">
            <Calendar className="h-3.5 w-3.5 mr-1.5" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="list">
            <ListTodo className="h-3.5 w-3.5 mr-1.5" /> List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading timeline…</div>
          ) : (
            <TimelineView
              projectIds={projectIds}
              projectsById={projectsById}
              milestones={data?.milestones ?? []}
              tasks={data?.tasks ?? []}
            />
          )}
        </TabsContent>
        <TabsContent value="list" className="mt-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <ListView
              projectsById={projectsById}
              milestones={data?.milestones ?? []}
              tasks={data?.tasks ?? []}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TimelineView({
  projectIds,
  projectsById,
  milestones,
  tasks,
}: {
  projectIds: string[];
  projectsById: Map<string, PlanProject>;
  milestones: Array<{ id: string; name: string; project_id: string; target_date: string | null; status: string }>;
  tasks: Array<{ id: string; title: string; project_id: string; due_date: string | null; start_date: string | null; status: string }>;
}) {
  const allDates: Date[] = [];
  milestones.forEach((m) => m.target_date && allDates.push(parseISO(m.target_date)));
  tasks.forEach((t) => {
    if (t.start_date) allDates.push(parseISO(t.start_date));
    if (t.due_date) allDates.push(parseISO(t.due_date));
  });

  if (allDates.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Nothing scheduled yet. Add milestones or task due dates to see them on the timeline.
      </Card>
    );
  }

  const min = startOfDay(new Date(Math.min(...allDates.map((d) => d.getTime()))));
  const max = startOfDay(new Date(Math.max(...allDates.map((d) => d.getTime()))));
  const totalDays = Math.max(differenceInDays(max, min) + 1, 7);
  const today = startOfDay(new Date());
  const todayOffset = ((differenceInDays(today, min) + 0.5) / totalDays) * 100;

  const pct = (d: string | null) => {
    if (!d) return null;
    return (differenceInDays(parseISO(d), min) / totalDays) * 100;
  };

  return (
    <Card className="p-4 overflow-hidden">
      <div className="flex justify-between text-xs text-muted-foreground mb-2">
        <span>{format(min, "MMM d, yyyy")}</span>
        <span>{totalDays} days</span>
        <span>{format(max, "MMM d, yyyy")}</span>
      </div>
      <div className="space-y-4">
        {projectIds.map((pid) => {
          const p = projectsById.get(pid);
          if (!p) return null;
          const projMs = milestones.filter((m) => m.project_id === pid);
          const projTasks = tasks.filter((t) => t.project_id === pid);
          return (
            <div key={pid}>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: p.color || "hsl(var(--primary))" }}
                />
                <span className="text-sm font-medium truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {projMs.length} milestone{projMs.length === 1 ? "" : "s"} ·{" "}
                  {projTasks.length} task{projTasks.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="relative h-12 rounded-md bg-muted/30 border">
                {/* today line */}
                {todayOffset >= 0 && todayOffset <= 100 && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-red-500/70 z-20"
                    style={{ left: `${todayOffset}%` }}
                    title="Today"
                  />
                )}
                {/* tasks as bars */}
                {projTasks.map((t, i) => {
                  const start = pct(t.start_date ?? t.due_date);
                  const end = pct(t.due_date);
                  if (start == null || end == null) return null;
                  const left = Math.min(start, end);
                  const width = Math.max(Math.abs(end - start), 0.8);
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "absolute h-1.5 rounded-sm",
                        t.status === "done"
                          ? "bg-emerald-500/60"
                          : t.status === "in_progress"
                            ? "bg-blue-500/70"
                            : "bg-muted-foreground/40",
                      )}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        top: `${8 + (i % 4) * 6}px`,
                      }}
                      title={`${t.title} · ${t.due_date ?? ""}`}
                    />
                  );
                })}
                {/* milestone diamonds */}
                {projMs.map((m) => {
                  const x = pct(m.target_date);
                  if (x == null) return null;
                  return (
                    <div
                      key={m.id}
                      className="absolute top-1/2 -translate-y-1/2 z-10"
                      style={{ left: `${x}%` }}
                      title={`${m.name} · ${m.target_date}`}
                    >
                      <Target className="h-3.5 w-3.5 -translate-x-1/2 text-amber-500 fill-amber-500/30" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ListView({
  projectsById,
  milestones,
  tasks,
}: {
  projectsById: Map<string, PlanProject>;
  milestones: Array<{ id: string; name: string; project_id: string; target_date: string | null; status: string }>;
  tasks: Array<{ id: string; title: string; project_id: string; due_date: string | null; status: string; priority: string | null }>;
}) {
  type Row = { kind: "milestone" | "task"; date: string | null; name: string; project_id: string; status: string };
  const rows: Row[] = [
    ...milestones.map((m) => ({
      kind: "milestone" as const,
      date: m.target_date,
      name: m.name,
      project_id: m.project_id,
      status: m.status,
    })),
    ...tasks.map((t) => ({
      kind: "task" as const,
      date: t.due_date,
      name: t.title,
      project_id: t.project_id,
      status: t.status,
    })),
  ].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  if (rows.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Nothing scheduled yet.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="text-left p-2 font-medium">Date</th>
            <th className="text-left p-2 font-medium">Type</th>
            <th className="text-left p-2 font-medium">Item</th>
            <th className="text-left p-2 font-medium">Engagement</th>
            <th className="text-left p-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const p = projectsById.get(r.project_id);
            return (
              <tr key={i} className="border-t hover:bg-muted/30">
                <td className="p-2 whitespace-nowrap">{r.date ?? "—"}</td>
                <td className="p-2">
                  {r.kind === "milestone" ? (
                    <Badge variant="outline" className="text-xs">
                      <Target className="h-3 w-3 mr-1" /> Milestone
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Task</Badge>
                  )}
                </td>
                <td className="p-2 truncate max-w-xs">{r.name}</td>
                <td className="p-2 truncate text-muted-foreground">{p?.name ?? "—"}</td>
                <td className="p-2">
                  <Badge variant="outline" className="text-xs capitalize">
                    {r.status.replace(/_/g, " ")}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
