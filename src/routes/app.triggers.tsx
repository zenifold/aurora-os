import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAiAgents } from "@/hooks/use-ai";
import {
  listAgentTriggers,
  upsertAgentTrigger,
  deleteAgentTrigger,
  runTriggerNow,
  draftTriggerFromPrompt,
} from "@/server/agents.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Zap, Clock, Activity, Plus, Play, Trash2, Loader2, Sparkles, Wand2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";

export const Route = createFileRoute("/app/triggers")({
  component: TriggersPage,
});

const EVENT_NAMES = [
  "task.created",
  "task.overdue",
  "task.completed",
  "project.status_changed",
  "milestone.due_soon",
  "invoice.sent",
  "client.message_received",
];

const INTERVALS = [
  { label: "Every 15 minutes", value: 15 },
  { label: "Every hour", value: 60 },
  { label: "Every 4 hours", value: 240 },
  { label: "Every 12 hours", value: 720 },
  { label: "Daily", value: 1440 },
  { label: "Weekly", value: 10080 },
];

type TriggerRow = {
  id: string;
  name: string;
  trigger_type: "schedule" | "event";
  config: Record<string, unknown>;
  goal_template: string;
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  next_run_at: string | null;
  agent_id: string;
  agent?: { name: string; avatar_emoji?: string } | null;
};

function TriggersPage() {
  const wsId = useWorkspaceStore((s) => s.current?.id);
  const qc = useQueryClient();
  const fetchTriggers = useServerFn(listAgentTriggers);
  const upsert = useServerFn(upsertAgentTrigger);
  const removeTrigger = useServerFn(deleteAgentTrigger);
  const runNow = useServerFn(runTriggerNow);

  const { data: agents = [] } = useAiAgents();
  const [editing, setEditing] = useState<Partial<TriggerRow> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    enabled: !!wsId,
    queryKey: ["agent-triggers", wsId],
    queryFn: () => fetchTriggers({ data: { workspace_id: wsId! } }),
    refetchInterval: 30000,
  });
  const triggers: TriggerRow[] = q.data?.ok ? (q.data.triggers as TriggerRow[]) : [];

  const schedules = useMemo(() => triggers.filter((t) => t.trigger_type === "schedule"), [triggers]);
  const events = useMemo(() => triggers.filter((t) => t.trigger_type === "event"), [triggers]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["agent-triggers", wsId] });

  const handleRun = async (id: string) => {
    setBusy(id);
    try {
      const r = await runNow({ data: { id } });
      if (r.ok) toast.success("Trigger fired");
      else toast.error(r.error);
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this trigger?")) return;
    await removeTrigger({ data: { id } });
    toast.success("Trigger removed");
    refresh();
  };

  return (
    <div className="flex h-full flex-col animate-page-in">
      <header className="border-b border-border px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Agent triggers
            </h1>
            <p className="text-sm text-muted-foreground">
              Run agents on a schedule or when workspace events happen.
            </p>
          </div>
          <Dialog open={!!editing} onOpenChange={(o) => setEditing(o ? (editing ?? { trigger_type: "schedule" }) : null)}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing({ trigger_type: "schedule", is_active: true, config: { interval_minutes: 60 } })}>
                <Plus className="mr-2 h-4 w-4" /> New trigger
              </Button>
            </DialogTrigger>
            <TriggerEditor
              value={editing}
              agents={agents}
              wsId={wsId}
              onClose={() => setEditing(null)}
              onSave={async (payload) => {
                if (!wsId) return;
                const r = await upsert({ data: { workspace_id: wsId, ...payload } as never });
                if (r.ok) {
                  toast.success("Trigger saved");
                  setEditing(null);
                  refresh();
                } else toast.error(r.error);
              }}
            />
          </Dialog>
        </div>
      </header>

      <div className="flex-1 space-y-8 overflow-auto p-6">
        <Section
          title="Scheduled"
          icon={<Clock className="h-4 w-4" />}
          empty="No schedules yet. Set an agent to run daily, hourly, or on any cadence."
          rows={schedules}
          onEdit={setEditing}
          onRun={handleRun}
          onDelete={handleDelete}
          busy={busy}
        />
        <Section
          title="Event-driven"
          icon={<Activity className="h-4 w-4" />}
          empty="No event triggers. Fire an agent when tasks go overdue, status flips, or invoices send."
          rows={events}
          onEdit={setEditing}
          onRun={handleRun}
          onDelete={handleDelete}
          busy={busy}
        />
        <RecentEvents wsId={wsId} />
      </div>
    </div>
  );
}

function RecentEvents({ wsId }: { wsId?: string }) {
  const q = useQuery({
    enabled: !!wsId,
    queryKey: ["agent-event-log", wsId],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("agent_event_log")
        .select("id, event_name, payload, triggers_matched, dispatched_at, created_at")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    refetchInterval: 15000,
  });
  const rows = q.data ?? [];
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Activity className="h-4 w-4" /> Recent events · {rows.length}
      </h2>
      {rows.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Activity} title="No events yet. Create a project, change a status, or complete a task to see activity here." />
        </Card>
      ) : (
        <Card className="surface-card divide-y divide-border">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">{r.event_name}</Badge>
                  {r.triggers_matched ? (
                    <Badge className="text-xs">{r.triggers_matched} fired</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">no triggers matched</span>
                  )}
                </div>
                <p className="mt-1 line-clamp-1 font-mono text-xs text-muted-foreground">
                  {JSON.stringify(r.payload)}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </span>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}


function Section({
  title,
  icon,
  empty,
  rows,
  onEdit,
  onRun,
  onDelete,
  busy,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  rows: TriggerRow[];
  onEdit: (t: TriggerRow) => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
  busy: string | null;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {title} · {rows.length}
      </h2>
      {rows.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Zap} title={empty} />
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((t) => (
            <Card key={t.id} className="surface-card flex flex-wrap items-center gap-4 p-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="icon-tile">{t.agent?.avatar_emoji ?? "🤖"}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{t.name}</p>
                    {!t.is_active && <Badge variant="outline">Paused</Badge>}
                    {t.last_run_status && (
                      <Badge variant="outline" className="text-xs">
                        {t.last_run_status}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.agent?.name ?? "Agent"} ·{" "}
                    {t.trigger_type === "schedule"
                      ? `every ${(t.config as { interval_minutes?: number })?.interval_minutes ?? "?"} min`
                      : `on ${(t.config as { event_name?: string })?.event_name ?? "event"}`}
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {t.next_run_at && t.trigger_type === "schedule" && (
                  <div>Next: {formatDistanceToNow(new Date(t.next_run_at), { addSuffix: true })}</div>
                )}
                {t.last_run_at && (
                  <div>Last: {formatDistanceToNow(new Date(t.last_run_at), { addSuffix: true })}</div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => onRun(t.id)} disabled={busy === t.id}>
                  {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onEdit(t)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(t.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function TriggerEditor({
  value,
  agents,
  wsId,
  onClose,
  onSave,
}: {
  value: Partial<TriggerRow> | null;
  agents: { id: string; name: string }[];
  wsId: string | undefined;
  onClose: () => void;
  onSave: (payload: Partial<TriggerRow>) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<TriggerRow>>(value ?? { trigger_type: "schedule", is_active: true, config: {} });
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const draftFn = useServerFn(draftTriggerFromPrompt);

  if (!value) return null;

  const update = (patch: Partial<TriggerRow>) => setForm((f) => ({ ...f, ...patch }));
  const updateConfig = (patch: Record<string, unknown>) =>
    setForm((f) => ({ ...f, config: { ...(f.config ?? {}), ...patch } }));

  const draftWithAi = async () => {
    if (!wsId || !aiPrompt.trim()) return;
    setAiBusy(true);
    setAiRationale(null);
    try {
      const r = await draftFn({ data: { workspace_id: wsId, prompt: aiPrompt.trim() } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const d = r.draft;
      setForm((f) => ({
        ...f,
        name: d.name,
        trigger_type: d.trigger_type,
        config: d.config,
        goal_template: d.goal_template,
        agent_id: d.agent_id ?? f.agent_id,
        is_active: true,
      }));
      setAiRationale(d.rationale || null);
      toast.success("Draft ready — review and save");
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async () => {
    if (!form.name || !form.agent_id || !form.goal_template) {
      toast.error("Name, agent, and goal are required");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {form.id ? "Edit trigger" : "New trigger"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        {!form.id && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              Describe it — AI will draft a trigger
            </div>
            <Textarea
              rows={2}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder='e.g. "Every weekday morning, summarize what is overdue across all projects and post it to my inbox."'
              className="bg-background text-sm"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                Review the draft below and tweak anything before saving.
              </p>
              <Button
                size="sm"
                onClick={draftWithAi}
                disabled={!aiPrompt.trim() || aiBusy}
                className="bg-aura-gradient text-primary-foreground hover:opacity-90"
              >
                {aiBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                Draft with AI
              </Button>
            </div>
            {aiRationale && (
              <p className="rounded border border-border bg-background/60 p-2 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Why: </span>{aiRationale}
              </p>
            )}
          </div>
        )}
        <div className="grid gap-2">
          <Label>Name</Label>
          <Input
            value={form.name ?? ""}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Daily standup digest"
          />
        </div>
        <div className="grid gap-2">
          <Label>Agent</Label>
          <Select value={form.agent_id} onValueChange={(v) => update({ agent_id: v })}>
            <SelectTrigger><SelectValue placeholder="Choose agent" /></SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Type</Label>
          <Select
            value={form.trigger_type}
            onValueChange={(v) => update({ trigger_type: v as "schedule" | "event", config: {} })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="schedule">Schedule</SelectItem>
              <SelectItem value="event">Event</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.trigger_type === "schedule" ? (
          <div className="grid gap-2">
            <Label>Cadence</Label>
            <Select
              value={String((form.config as { interval_minutes?: number })?.interval_minutes ?? 60)}
              onValueChange={(v) => updateConfig({ interval_minutes: Number(v) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVALS.map((i) => (
                  <SelectItem key={i.value} value={String(i.value)}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label>Event</Label>
            <Select
              value={(form.config as { event_name?: string })?.event_name ?? ""}
              onValueChange={(v) => updateConfig({ event_name: v })}
            >
              <SelectTrigger><SelectValue placeholder="Choose event" /></SelectTrigger>
              <SelectContent>
                {EVENT_NAMES.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              You can reference payload values in the goal with <code>{`{{key}}`}</code>.
            </p>
          </div>
        )}

        <div className="grid gap-2">
          <Label>Goal template</Label>
          <Textarea
            rows={4}
            value={form.goal_template ?? ""}
            onChange={(e) => update({ goal_template: e.target.value })}
            placeholder="Summarize what's overdue and draft a status update for project {{project_name}}"
          />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <Label>Active</Label>
          <Switch checked={!!form.is_active} onCheckedChange={(v) => update({ is_active: v })} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save trigger
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
