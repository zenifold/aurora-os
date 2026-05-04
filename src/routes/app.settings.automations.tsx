import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  useAutomations,
  useUpsertAutomation,
  useDeleteAutomation,
  useToggleAutomation,
  useAutomationRuns,
  type AiAutomation,
  type AutomationCondition,
  type ApplyAction,
} from "@/hooks/use-automations";
import { useAiAgents } from "@/hooks/use-ai";
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
import { Zap, Plus, Trash2, Sparkles, History, X, Tag, MessageSquare, FileText } from "lucide-react";

export const Route = createFileRoute("/app/settings/automations")({
  component: AutomationsPage,
});

type Template = {
  name: string;
  description: string;
  trigger_event: AiAutomation["trigger_event"];
  conditions: AutomationCondition[];
  apply_action: ApplyAction;
  instructions_template: string;
  agentSystemPrompt: string;
  agentEmoji: string;
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
            Run AI agents automatically when tasks are created or updated.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
            <Sparkles className="mr-1.5 h-4 w-4" /> Templates
          </Button>
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            disabled={agents.length === 0}
            className="bg-aura-gradient text-primary-foreground hover:opacity-90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> New automation
          </Button>
        </div>
      </div>

      {agents.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Create at least one AI agent in <strong>AI agents</strong> before adding automations.
        </div>
      )}

      <div className="mt-6 space-y-2">
        {automations.length === 0 && agents.length > 0 && (
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
                  onClick={() => {
                    if (confirm(`Delete automation "${a.name}"?`)) remove.mutate(a.id);
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
  const map = {
    comment: { label: "Comment", icon: MessageSquare },
    description_append: { label: "Description", icon: FileText },
    tag: { label: "Tags", icon: Tag },
    none: { label: "Log only", icon: History },
  } as const;
  const { label, icon: Icon } = map[action];
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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState<AiAutomation["trigger_event"]>("task.created");
  const [agentId, setAgentId] = useState<string>("");
  const [applyAction, setApplyAction] = useState<ApplyAction>("comment");
  const [instructionsTemplate, setInstructionsTemplate] = useState("");
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);

  const isEdit = !!automation;

  // Initialize form on open
  const [initKey, setInitKey] = useState<string | null>(null);
  const targetKey = automation?.id ?? "new";
  if (open && initKey !== targetKey) {
    setInitKey(targetKey);
    setName(automation?.name ?? "");
    setDescription(automation?.description ?? "");
    setTriggerEvent(automation?.trigger_event ?? "task.created");
    setAgentId(automation?.agent_id ?? agents[0]?.id ?? "");
    setApplyAction(automation?.apply_action ?? "comment");
    setInstructionsTemplate(automation?.instructions_template ?? "");
    setConditions(automation?.conditions ?? []);
  }
  if (!open && initKey !== null) setInitKey(null);

  const save = async () => {
    if (!name.trim() || !agentId) {
      toast.error("Name and agent are required");
      return;
    }
    await upsert.mutateAsync({
      id: automation?.id,
      name: name.trim(),
      description: description.trim() || null,
      trigger_event: triggerEvent,
      agent_id: agentId,
      apply_action: applyAction,
      instructions_template: instructionsTemplate.trim() || null,
      conditions,
      is_active: automation?.is_active ?? true,
    });
    toast.success(isEdit ? "Automation updated" : "Automation created");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit automation" : "New automation"}</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-tag bugs" />
          </div>
          <div className="grid gap-1.5">
            <Label>Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            </div>
          </div>

          <ConditionsEditor value={conditions} onChange={setConditions} />

          <div className="grid gap-1.5">
            <Label>Apply output as</Label>
            <Select value={applyAction} onValueChange={(v) => setApplyAction(v as ApplyAction)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comment">Comment on task</SelectItem>
                <SelectItem value="description_append">Append to description</SelectItem>
                <SelectItem value="tag">Add as tags (comma-separated output)</SelectItem>
                <SelectItem value="none">Log only (don't apply)</SelectItem>
              </SelectContent>
            </Select>
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
            <p className="text-[10px] text-muted-foreground">
              Variables: <code>{`{{title}}`}</code> <code>{`{{description}}`}</code>{" "}
              <code>{`{{status}}`}</code> <code>{`{{priority}}`}</code>{" "}
              <code>{`{{tags}}`}</code>
            </p>
          </div>
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
    if (agents.length === 0) {
      toast.error("Create an AI agent first");
      return;
    }
    // Pick best agent: try matching by emoji else first
    const agent = agents.find((a) => a.avatar_emoji === t.agentEmoji) ?? agents[0];
    await upsert.mutateAsync({
      name: t.name,
      description: t.description,
      trigger_event: t.trigger_event,
      conditions: t.conditions,
      agent_id: agent.id,
      apply_action: t.apply_action,
      instructions_template: t.instructions_template,
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
                {t.agentEmoji}
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
  return (
    <Dialog open={!!automation} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Run history · {automation?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {runs.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No runs yet.</p>
          )}
          {runs.map((r) => (
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
