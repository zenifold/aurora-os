import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";
import { confirmDialog } from "@/lib/dialogs";
import { useState } from "react";
import { toast } from "sonner";
import {
  useAutomations,
  useUpsertAutomation,
  useDeleteAutomation,
  useToggleAutomation,
  useAutomationRuns,
  actionRequiresAgent,
  type AiAutomation,
  type AutomationCondition,
  type ApplyAction,
  type ActionConfig,
} from "@/hooks/use-automations";
import { useAiAgents } from "@/hooks/use-ai";
import { useTeamMembers } from "@/hooks/use-team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, Plus, Trash2, Sparkles, History, X, Tag, MessageSquare, FileText, ArrowRightCircle, Flag, UserPlus, Webhook, Bell, CircleDashed, FlaskConical, Loader2, CheckCircle2, XCircle, Calendar, TagsIcon } from "lucide-react";
import { simulateAutomation } from "@/server/automation-simulate.functions";
import { useWorkspaceStore } from "@/stores/workspace-store";

export const Route = createFileRoute("/app/settings/automations")({
  component: () => (
    <RoleGuard min="manager">
      <AutomationsPage />
    </RoleGuard>
  ),
});

type Template = {
  name: string;
  description: string;
  trigger_event: AiAutomation["trigger_event"];
  conditions: AutomationCondition[];
  apply_action: ApplyAction;
  instructions_template?: string;
  agentSystemPrompt?: string;
  agentEmoji?: string;
  action_config?: ActionConfig;
};

const TEMPLATES: Template[] = [
  {
    name: "Smart Categorizer",
    description: "Auto-add tags based on task title and description",
    trigger_event: "task.created",
    conditions: [],
    apply_action: "tag",
    instructions_template:
      "Suggest 1-3 short, lowercase tags (no # symbol) for this task. Return ONLY the tags as a comma-separated list.\n\nTitle: {{title}}\nDescription: {{description}}",
    agentSystemPrompt:
      "You are a precise task categorization assistant. Always respond with ONLY a comma-separated list of 1-3 short lowercase tags. No explanations, no formatting.",
    agentEmoji: "🏷️",
  },
  {
    name: "Description Enricher",
    description: "Add a clear summary and acceptance criteria when description is missing",
    trigger_event: "task.created",
    conditions: [{ field: "description", op: "is_empty" }],
    apply_action: "description_append",
    instructions_template:
      "Write a 2-3 sentence task summary followed by 3 bullet acceptance criteria for the following task title:\n\n{{title}}",
    agentSystemPrompt:
      "You are a senior product manager. Produce concise task descriptions and clear acceptance criteria. Use Markdown. Be specific.",
    agentEmoji: "📝",
  },
  {
    name: "Done Reviewer",
    description: "Post a quick review comment when a task moves to Done",
    trigger_event: "task.status_changed",
    conditions: [{ field: "status", op: "changed_to", value: "done" }],
    apply_action: "comment",
    instructions_template:
      "The following task was just marked as done. Write a brief 2-sentence acknowledgement and one suggestion for follow-up work, if relevant.\n\nTitle: {{title}}\nDescription: {{description}}",
    agentSystemPrompt:
      "You are a friendly engineering lead reviewing completed work. Be encouraging but suggest meaningful follow-ups when relevant.",
    agentEmoji: "✅",
  },
  // No-AI templates
  {
    name: "Auto-prioritize urgent",
    description: "When a task title contains 'urgent', set priority to high — no AI required",
    trigger_event: "task.created",
    conditions: [{ field: "title", op: "contains", value: "urgent" }],
    apply_action: "set_priority",
    action_config: { priority: "high" },
  },
  {
    name: "Notify on done",
    description: "Ping the assignees when a task is moved to Done",
    trigger_event: "task.status_changed",
    conditions: [{ field: "status", op: "changed_to", value: "done" }],
    apply_action: "notify",
    action_config: { notify_message: "✅ {{title}} was marked done" },
  },
  {
    name: "Webhook on creation",
    description: "POST a JSON payload to your endpoint whenever a task is created",
    trigger_event: "task.created",
    conditions: [],
    apply_action: "webhook",
    action_config: { webhook_url: "https://example.com/webhook", webhook_method: "POST" },
  },
  {
    name: "Default 7-day deadline",
    description: "Set due date to 7 days out for newly created tasks without one",
    trigger_event: "task.created",
    conditions: [{ field: "due_date", op: "is_empty" }],
    apply_action: "set_due_date",
    action_config: { due_date_offset_days: 7 },
  },
  {
    name: "Clean up done tags",
    description: "Remove 'wip' or 'in-review' tags when a task moves to Done",
    trigger_event: "task.status_changed",
    conditions: [{ field: "status", op: "changed_to", value: "done" }],
    apply_action: "remove_tags",
    action_config: { tags: ["wip", "in-review"] },
  },
];

function AutomationsPage() {
  const { data: automations = [] } = useAutomations();
  const { data: agents = [] } = useAiAgents();
  const remove = useDeleteAutomation();
  const toggle = useToggleAutomation();

  const [editing, setEditing] = useState<AiAutomation | null>(null);
  const [creating, setCreating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [viewingRunsOf, setViewingRunsOf] = useState<AiAutomation | null>(null);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Zap className="h-5 w-5 text-primary" /> Automations
          </h1>
          <p className="text-sm text-muted-foreground">
            Trigger actions automatically when tasks change. Use AI agents for smart actions, or set
            simple rules without AI.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
            <Sparkles className="mr-1.5 h-4 w-4" /> Templates
          </Button>
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="bg-aura-gradient text-primary-foreground hover:opacity-90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> New automation
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {automations.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Zap className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No automations yet</p>
            <p className="text-xs text-muted-foreground">
              Start from a template or build your own rule.
            </p>
          </div>
        )}
        {automations.map((a) => {
          const agent = agents.find((ag) => ag.id === a.agent_id);
          return (
            <div
              key={a.id}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"
            >
              <Switch
                checked={a.is_active}
                onCheckedChange={(v) => toggle.mutate({ id: a.id, is_active: v })}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{a.name}</p>
                  <ActionBadge action={a.apply_action} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  When <span className="font-mono">{a.trigger_event}</span>
                  {a.conditions.length > 0 && ` · ${a.conditions.length} condition${a.conditions.length > 1 ? "s" : ""}`}
                  {agent && ` · runs ${agent.avatar_emoji ?? "🤖"} ${agent.name}`}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Ran {a.run_count} times
                  {a.last_run_at && ` · last ${new Date(a.last_run_at).toLocaleString()}`}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                <Button variant="ghost" size="sm" onClick={() => setViewingRunsOf(a)}>
                  <History className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={async () => {
                    const ok = await confirmDialog({
                      title: "Delete automation?",
                      description: `"${a.name}" will be removed and stop running.`,
                      confirmLabel: "Delete",
                      tone: "destructive",
                    });
                    if (ok) remove.mutate(a.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <AutomationDialog
        open={creating || !!editing}
        automation={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <TemplatesDialog
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
      />

      <RunsDialog
        automation={viewingRunsOf}
        onClose={() => setViewingRunsOf(null)}
      />
    </div>
  );
}

function ActionBadge({ action }: { action: ApplyAction }) {
  const map: Record<ApplyAction, { label: string; icon: typeof MessageSquare }> = {
    comment: { label: "AI comment", icon: MessageSquare },
    description_append: { label: "AI description", icon: FileText },
    tag: { label: "AI tags", icon: Tag },
    none: { label: "Log only", icon: History },
    set_status: { label: "Set status", icon: ArrowRightCircle },
    set_priority: { label: "Set priority", icon: Flag },
    add_tags: { label: "Add tags", icon: Tag },
    remove_tags: { label: "Remove tags", icon: TagsIcon },
    add_assignee: { label: "Assign", icon: UserPlus },
    set_due_date: { label: "Set due date", icon: Calendar },
    webhook: { label: "Webhook", icon: Webhook },
    notify: { label: "Notify", icon: Bell },
  };
  const { label, icon: Icon } = map[action] ?? { label: action, icon: CircleDashed };
  return (
    <Badge variant="secondary" className="gap-1 font-normal">
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
}

function AutomationDialog({
  open,
  automation,
  onClose,
}: {
  open: boolean;
  automation: AiAutomation | null;
  onClose: () => void;
}) {
  const upsert = useUpsertAutomation();
  const { data: agents = [] } = useAiAgents();
  const { data: members = [] } = useTeamMembers();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState<AiAutomation["trigger_event"]>("task.created");
  const [agentId, setAgentId] = useState<string>("");
  const [applyAction, setApplyAction] = useState<ApplyAction>("set_priority");
  const [instructionsTemplate, setInstructionsTemplate] = useState("");
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);
  const [actionConfig, setActionConfig] = useState<ActionConfig>({});

  const isEdit = !!automation;
  const needsAgent = actionRequiresAgent(applyAction);

  // Initialize form on open
  const [initKey, setInitKey] = useState<string | null>(null);
  const targetKey = automation?.id ?? "new";
  if (open && initKey !== targetKey) {
    setInitKey(targetKey);
    setName(automation?.name ?? "");
    setDescription(automation?.description ?? "");
    setTriggerEvent(automation?.trigger_event ?? "task.created");
    setAgentId(automation?.agent_id ?? agents[0]?.id ?? "");
    setApplyAction(automation?.apply_action ?? "set_priority");
    setInstructionsTemplate(automation?.instructions_template ?? "");
    setConditions(automation?.conditions ?? []);
    setActionConfig(automation?.action_config ?? {});
  }
  if (!open && initKey !== null) setInitKey(null);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (needsAgent && !agentId) {
      toast.error("Pick an AI agent for this action");
      return;
    }
    await upsert.mutateAsync({
      id: automation?.id,
      name: name.trim(),
      description: description.trim() || null,
      trigger_event: triggerEvent,
      agent_id: needsAgent ? agentId : null,
      apply_action: applyAction,
      instructions_template: needsAgent ? (instructionsTemplate.trim() || null) : null,
      conditions,
      action_config: actionConfig,
      is_active: automation?.is_active ?? true,
    });
    toast.success(isEdit ? "Automation updated" : "Automation created");
    onClose();
  };

  const updateCfg = (patch: Partial<ActionConfig>) => setActionConfig((c) => ({ ...c, ...patch }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit automation" : "New automation"}</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-prioritize urgent" />
          </div>
          <div className="grid gap-1.5">
            <Label>Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label>Trigger</Label>
            <Select value={triggerEvent} onValueChange={(v) => setTriggerEvent(v as AiAutomation["trigger_event"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="task.created">Task created</SelectItem>
                <SelectItem value="task.updated">Task updated</SelectItem>
                <SelectItem value="task.status_changed">Status changed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ConditionsEditor value={conditions} onChange={setConditions} />

          <div className="grid gap-1.5">
            <Label>Action</Label>
            <Select value={applyAction} onValueChange={(v) => setApplyAction(v as ApplyAction)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="set_priority">Set priority</SelectItem>
                <SelectItem value="set_status">Set status</SelectItem>
                <SelectItem value="set_due_date">Set due date</SelectItem>
                <SelectItem value="add_tags">Add tags</SelectItem>
                <SelectItem value="remove_tags">Remove tags</SelectItem>
                <SelectItem value="add_assignee">Assign to user</SelectItem>
                <SelectItem value="notify">Send notification</SelectItem>
                <SelectItem value="webhook">Call webhook (HTTP)</SelectItem>
                <SelectItem value="none">Log only (no action)</SelectItem>
                <SelectItem value="comment">AI: comment on task</SelectItem>
                <SelectItem value="description_append">AI: append to description</SelectItem>
                <SelectItem value="tag">AI: add tags</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              {needsAgent ? "Uses an AI agent to generate output." : "No AI required — runs deterministically."}
            </p>
          </div>

          {/* Action-specific config */}
          {applyAction === "set_priority" && (
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={actionConfig.priority ?? ""} onValueChange={(v) => updateCfg({ priority: v })}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {applyAction === "set_status" && (
            <div className="grid gap-1.5">
              <Label>Status (id or slug)</Label>
              <Input value={actionConfig.status ?? ""} onChange={(e) => updateCfg({ status: e.target.value })} placeholder="todo / in_progress / done" />
            </div>
          )}
          {(applyAction === "add_tags" || applyAction === "remove_tags") && (
            <div className="grid gap-1.5">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={(actionConfig.tags ?? []).join(", ")}
                onChange={(e) => updateCfg({ tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                placeholder="bug, urgent, frontend"
              />
            </div>
          )}
          {applyAction === "set_due_date" && (
            <div className="grid gap-2">
              <div className="grid gap-1.5">
                <Label>Days from now (e.g. 3 = in 3 days, -1 = yesterday)</Label>
                <Input
                  type="number"
                  value={actionConfig.due_date_offset_days ?? ""}
                  onChange={(e) => updateCfg({ due_date_offset_days: e.target.value === "" ? undefined : Number(e.target.value) })}
                  placeholder="3"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Or use a fixed date below (offset takes priority if both set).
              </p>
              <div className="grid gap-1.5">
                <Label>Fixed date</Label>
                <Input type="date" value={actionConfig.due_date ?? ""} onChange={(e) => updateCfg({ due_date: e.target.value })} />
              </div>
            </div>
          )}
          {applyAction === "add_assignee" && (
            <div className="grid gap-1.5">
              <Label>Assignee</Label>
              <Select value={actionConfig.assignee_id ?? ""} onValueChange={(v) => updateCfg({ assignee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pick teammate" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.role} · {m.user_id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {applyAction === "webhook" && (
            <div className="grid gap-2">
              <div className="grid gap-1.5">
                <Label>Webhook URL</Label>
                <Input
                  value={actionConfig.webhook_url ?? ""}
                  onChange={(e) => updateCfg({ webhook_url: e.target.value })}
                  placeholder="https://hooks.example.com/..."
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Method</Label>
                <Select
                  value={actionConfig.webhook_method ?? "POST"}
                  onValueChange={(v) => updateCfg({ webhook_method: v as "POST" | "PUT" | "PATCH" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Body includes <code>event</code>, <code>automation</code>, and full <code>task</code>.
              </p>
            </div>
          )}
          {applyAction === "notify" && (
            <div className="grid gap-1.5">
              <Label>Message (supports {`{{title}}`}, {`{{status}}`} variables)</Label>
              <Input
                value={actionConfig.notify_message ?? ""}
                onChange={(e) => updateCfg({ notify_message: e.target.value })}
                placeholder="✅ {{title}} was updated"
              />
              <p className="text-[10px] text-muted-foreground">
                Defaults to notifying the task's assignees.
              </p>
            </div>
          )}

          {needsAgent && (
            <>
              <div className="grid gap-1.5">
                <Label>Run agent</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.avatar_emoji ?? "🤖"} {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {agents.length === 0 && (
                  <p className="text-[10px] text-destructive">
                    Create an AI agent first in <strong>AI agents</strong>.
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label>Prompt template</Label>
                <Textarea
                  value={instructionsTemplate}
                  onChange={(e) => setInstructionsTemplate(e.target.value)}
                  rows={5}
                  placeholder="Use {{title}}, {{description}}, {{status}}, {{priority}}, {{tags}}"
                  className="font-mono text-xs"
                />
              </div>
            </>
          )}

          <SimulatorPanel conditions={conditions} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={save}
            disabled={upsert.isPending}
            className="bg-aura-gradient text-primary-foreground hover:opacity-90"
          >
            {isEdit ? "Save changes" : "Create automation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConditionsEditor({
  value,
  onChange,
}: {
  value: AutomationCondition[];
  onChange: (v: AutomationCondition[]) => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Conditions (all must match)</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...value, { field: "status", op: "eq", value: "" }])}
        >
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>
      {value.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No conditions — runs on every event.</p>
      )}
      {value.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select value={c.field} onValueChange={(v) => updateAt(i, { ...c, field: v })}>
            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="title">title</SelectItem>
              <SelectItem value="description">description</SelectItem>
              <SelectItem value="status">status</SelectItem>
              <SelectItem value="priority">priority</SelectItem>
              <SelectItem value="tags">tags</SelectItem>
            </SelectContent>
          </Select>
          <Select value={c.op} onValueChange={(v) => updateAt(i, { ...c, op: v as AutomationCondition["op"] })}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="eq">equals</SelectItem>
              <SelectItem value="neq">not equals</SelectItem>
              <SelectItem value="contains">contains</SelectItem>
              <SelectItem value="is_empty">is empty</SelectItem>
              <SelectItem value="is_not_empty">is not empty</SelectItem>
              <SelectItem value="changed_to">changed to</SelectItem>
            </SelectContent>
          </Select>
          {c.op !== "is_empty" && c.op !== "is_not_empty" && (
            <Input
              className="h-8 flex-1"
              value={(c.value as string) ?? ""}
              onChange={(e) => updateAt(i, { ...c, value: e.target.value })}
              placeholder="value"
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );

  function updateAt(i: number, next: AutomationCondition) {
    onChange(value.map((c, j) => (j === i ? next : c)));
  }
}

function TemplatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const upsert = useUpsertAutomation();
  const { data: agents = [] } = useAiAgents();

  const apply = async (t: Template) => {
    const needsAgent = actionRequiresAgent(t.apply_action);
    if (needsAgent && agents.length === 0) {
      toast.error("Create an AI agent first");
      return;
    }
    const agent = needsAgent
      ? (agents.find((a) => a.avatar_emoji === t.agentEmoji) ?? agents[0])
      : null;
    await upsert.mutateAsync({
      name: t.name,
      description: t.description,
      trigger_event: t.trigger_event,
      conditions: t.conditions,
      agent_id: agent?.id ?? null,
      apply_action: t.apply_action,
      instructions_template: t.instructions_template ?? null,
      action_config: t.action_config ?? {},
      is_active: true,
    });
    toast.success(`"${t.name}" automation created`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Automation templates</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => apply(t)}
              className="group flex items-start gap-3 rounded-lg border border-border p-3 text-left transition hover:border-primary/40 hover:bg-accent"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-aura-gradient-subtle text-lg">
                {t.agentEmoji ?? (actionRequiresAgent(t.apply_action) ? "🤖" : "⚡")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {t.trigger_event}
                  </Badge>
                  <ActionBadge action={t.apply_action} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RunsDialog({
  automation,
  onClose,
}: {
  automation: AiAutomation | null;
  onClose: () => void;
}) {
  const { data: runs = [] } = useAutomationRuns(automation?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [search, setSearch] = useState("");

  const filtered = runs.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${r.output ?? ""} ${r.error_message ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const successCount = runs.filter((r) => r.status === "success").length;
  const failedCount = runs.filter((r) => r.status === "failed").length;

  return (
    <Dialog open={!!automation} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Run history · {automation?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "success" | "failed")}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({runs.length})</SelectItem>
              <SelectItem value="success">Success ({successCount})</SelectItem>
              <SelectItem value="failed">Failed ({failedCount})</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search output / error…"
            className="h-8 max-w-xs"
          />
          {(statusFilter !== "all" || search) && (
            <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setSearch(""); }}>
              Clear
            </Button>
          )}
        </div>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {runs.length === 0 ? "No runs yet." : "No runs match filters."}
            </p>
          )}
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant={r.status === "success" ? "default" : r.status === "failed" ? "destructive" : "secondary"}
                  className="text-[10px]"
                >
                  {r.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                  {r.duration_ms != null && ` · ${r.duration_ms}ms`}
                  {r.tokens_used != null && ` · ${r.tokens_used} tok`}
                </span>
              </div>
              {r.output && (
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{r.output}</p>
              )}
              {r.error_message && (
                <p className="mt-2 text-xs text-destructive">{r.error_message}</p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SimulatorPanel({ conditions }: { conditions: AutomationCondition[] }) {
  const ws = useWorkspaceStore((s) => s.current);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    evaluated: number;
    matched: { id: string; title: string; status: string; project_id: string | null }[];
    misses: { id: string; title: string; failed: string }[];
    error: string | null;
  } | null>(null);

  const run = async () => {
    if (!ws) return;
    setLoading(true);
    try {
      const r = await simulateAutomation({ data: { workspace_id: ws.id, conditions: conditions as unknown[] } });
      setResult(r);
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Test rule</p>
            <p className="text-[11px] text-muted-foreground">Preview which existing tasks would match (last 200).</p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Run test"}
        </Button>
      </div>
      {open && result && (
        <div className="mt-3 space-y-2">
          {result.error && <p className="text-xs text-destructive">{result.error}</p>}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{result.matched.length} match</span>
            <span className="flex items-center gap-1 text-muted-foreground"><XCircle className="h-3.5 w-3.5" />{result.evaluated - result.matched.length} skipped</span>
            <span className="text-muted-foreground">of {result.evaluated} evaluated</span>
          </div>
          {result.matched.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Matched</p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-border bg-background p-2">
                {result.matched.slice(0, 20).map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <span className="truncate">{t.title}</span>
                    <Badge variant="outline" className="ml-2 text-[10px]">{t.status}</Badge>
                  </div>
                ))}
                {result.matched.length > 20 && (
                  <p className="text-[10px] text-muted-foreground">+ {result.matched.length - 20} more</p>
                )}
              </div>
            </div>
          )}
          {result.misses.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Sample misses</p>
              <div className="space-y-1 rounded border border-border bg-background p-2">
                {result.misses.map((m) => (
                  <div key={m.id} className="text-xs">
                    <span className="truncate">{m.title}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">failed: {m.failed}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
