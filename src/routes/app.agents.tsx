import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bot, Sparkles, Plus, Check, X, Loader2, Wand2, Brain, Trash2 } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import {
  listAgents,
  upsertAgent,
  listAgentExecutions,
  listPendingApprovals,
  decideApproval,
  briefAgent,
  executeAgent,
  seedDefaultTools,
  listAgentTools,
  listAgentMemories,
  deleteAgentMemory,
} from "@/server/agents.functions";

export const Route = createFileRoute("/app/agents")({
  component: AgentCommandCenter,
});

function AgentCommandCenter() {
  const ws = useWorkspaceStore((s) => s.current);
  const wsId = ws?.id;
  const qc = useQueryClient();

  const fetchAgents = useServerFn(listAgents);
  const fetchExecs = useServerFn(listAgentExecutions);
  const fetchApprovals = useServerFn(listPendingApprovals);
  const fetchTools = useServerFn(listAgentTools);
  const seedTools = useServerFn(seedDefaultTools);

  const agentsQ = useQuery({
    enabled: !!wsId,
    queryKey: ["agents", wsId],
    queryFn: () => fetchAgents({ data: { workspace_id: wsId! } }),
  });
  const execsQ = useQuery({
    enabled: !!wsId,
    queryKey: ["agent-execs", wsId],
    queryFn: () => fetchExecs({ data: { workspace_id: wsId!, limit: 25 } }),
    refetchInterval: 8000,
  });
  const apprQ = useQuery({
    enabled: !!wsId,
    queryKey: ["agent-approvals", wsId],
    queryFn: () => fetchApprovals({ data: { workspace_id: wsId! } }),
    refetchInterval: 10000,
  });
  const toolsQ = useQuery({
    enabled: !!wsId,
    queryKey: ["agent-tools", wsId],
    queryFn: () => fetchTools({ data: { workspace_id: wsId! } }),
  });

  const agents = agentsQ.data?.ok ? agentsQ.data.agents : [];
  const execs = execsQ.data?.ok ? execsQ.data.executions : [];
  const approvals = apprQ.data?.ok ? apprQ.data.approvals : [];
  const tools = toolsQ.data?.ok ? toolsQ.data.tools : [];

  const [editorOpen, setEditorOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefAgentId, setBriefAgentId] = useState<string>("");

  const onSeed = async () => {
    if (!wsId) return;
    const r = await seedTools({ data: { workspace_id: wsId } });
    if (r.ok) {
      toast.success(`Seeded ${r.count} tools`);
      qc.invalidateQueries({ queryKey: ["agent-tools", wsId] });
    } else toast.error(r.error);
  };

  if (!ws) return <div className="p-6 text-sm text-muted-foreground">Select a workspace</div>;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Agent Command Center</h1>
            <p className="text-xs text-muted-foreground">
              Your AI workforce — agents that observe, plan, and act
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tools.length === 0 && (
            <Button variant="outline" size="sm" onClick={onSeed}>
              <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Seed default tools
            </Button>
          )}
          <Button size="sm" onClick={() => setEditorOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New agent
          </Button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-12 gap-6 overflow-auto p-6">
        {/* Agents */}
        <section className="col-span-12 lg:col-span-5 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Agents</h2>
          {agentsQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {agents.length === 0 && !agentsQ.isLoading && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No agents yet. Create your first specialist.
            </Card>
          )}
          {agents.map((a: any) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                  {a.avatar_emoji ?? "🤖"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{a.name}</span>
                    {a.handle && (
                      <span className="text-xs text-muted-foreground">@{a.handle}</span>
                    )}
                    <StatusDot status={a.status} />
                  </div>
                  {a.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {a.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {a.autonomy_level}
                    </Badge>
                    {(a.capabilities ?? []).slice(0, 4).map((c: string) => (
                      <Badge key={c} variant="outline" className="text-[10px]">
                        {c}
                      </Badge>
                    ))}
                    {(a.capabilities?.length ?? 0) > 4 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{a.capabilities.length - 4}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBriefAgentId(a.id);
                    setBriefOpen(true);
                  }}
                >
                  Brief
                </Button>
              </div>
            </Card>
          ))}
        </section>

        {/* Approvals + Activity */}
        <section className="col-span-12 lg:col-span-7 space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Approval queue
              {approvals.length > 0 && (
                <Badge className="ml-2" variant="destructive">
                  {approvals.length}
                </Badge>
              )}
            </h2>
            {approvals.length === 0 && (
              <Card className="p-4 text-sm text-muted-foreground">
                Nothing waiting on you. Agents will queue actions here when they need approval.
              </Card>
            )}
            {approvals.map((ap: any) => (
              <ApprovalCard
                key={ap.id}
                approval={ap}
                onDone={() => qc.invalidateQueries({ queryKey: ["agent-approvals", wsId] })}
              />
            ))}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent activity</h2>
            <Card className="divide-y divide-border">
              {execs.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No agent runs yet.</div>
              )}
              {execs.map((e: any) => (
                <ExecutionRow key={e.id} exec={e} agents={agents} />
              ))}
            </Card>
            <div className="mt-2 text-right">
              <Link to="/app/agent-runs" className="text-xs text-muted-foreground hover:underline">
                View full history →
              </Link>
            </div>
          </div>

          <MemoriesPanel workspaceId={wsId!} />
        </section>
      </div>

      <AgentEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        workspaceId={wsId!}
        onSaved={() => qc.invalidateQueries({ queryKey: ["agents", wsId] })}
      />
      <BriefDialog
        open={briefOpen}
        onOpenChange={setBriefOpen}
        workspaceId={wsId!}
        agentId={briefAgentId}
        agents={agents}
        onSent={() => {
          qc.invalidateQueries({ queryKey: ["agent-execs", wsId] });
          qc.invalidateQueries({ queryKey: ["agents", wsId] });
        }}
      />
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    idle: "bg-muted-foreground/40",
    working: "bg-emerald-500 animate-pulse",
    blocked: "bg-amber-500",
    error: "bg-destructive",
  };
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${map[status] ?? map.idle}`}
      title={status}
    />
  );
}

function ApprovalCard({ approval, onDone }: { approval: any; onDone: () => void }) {
  const decide = useServerFn(decideApproval);
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);

  const act = async (decision: "approved" | "rejected") => {
    setBusy(decision);
    const r = await decide({ data: { id: approval.id, decision } });
    setBusy(null);
    if (r.ok) {
      toast.success(decision === "approved" ? "Approved" : "Rejected");
      onDone();
    } else toast.error(r.error);
  };

  return (
    <Card className="mb-2 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-base">
          {approval.agent?.avatar_emoji ?? "🤖"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{approval.agent?.name ?? "Agent"}</span>
            <Badge variant="outline" className="text-[10px]">
              {approval.tool_name}
            </Badge>
          </div>
          <p className="mt-1 text-sm">{approval.action_summary}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant="ghost" onClick={() => act("rejected")} disabled={!!busy}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => act("approved")} disabled={!!busy}>
            {busy === "approved" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ExecutionRow({ exec, agents }: { exec: any; agents: any[] }) {
  const agent = agents.find((a) => a.id === exec.agent_id);
  const run = useServerFn(executeAgent);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const time = new Date(exec.started_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const statusColor: Record<string, string> = {
    completed: "text-emerald-600",
    failed: "text-destructive",
    running: "text-blue-600",
    planning: "text-muted-foreground",
    blocked: "text-amber-600",
    awaiting_approval: "text-amber-600",
  };
  const canRun = exec.status === "planning" || exec.status === "failed";
  const onRun = async () => {
    setBusy(true);
    const r = await run({ data: { execution_id: exec.id } });
    setBusy(false);
    if (r.ok) {
      toast.success(`Agent ${r.status}`);
      qc.invalidateQueries({ queryKey: ["agent-execs"] });
      qc.invalidateQueries({ queryKey: ["agent-approvals"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
    } else toast.error(r.error);
  };
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <span className="text-base">{agent?.avatar_emoji ?? "🤖"}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate">
          <span className="font-medium">{agent?.name ?? "Agent"}</span>{" "}
          <span className="text-muted-foreground">— {exec.goal}</span>
        </div>
      </div>
      <span className={`text-xs ${statusColor[exec.status] ?? "text-muted-foreground"}`}>
        {exec.status}
      </span>
      <span className="text-xs text-muted-foreground">{time}</span>
      {canRun && (
        <Button size="sm" variant="outline" onClick={onRun} disabled={busy}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run"}
        </Button>
      )}
    </div>
  );
}

const CAPABILITY_OPTIONS = [
  "create_task",
  "send_email",
  "schedule_meeting",
  "query_database",
  "browse_web",
  "call_api",
  "generate_document",
  "analyze_data",
  "notify_human",
  "escalate",
];

function AgentEditorDialog({
  open,
  onOpenChange,
  workspaceId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  workspaceId: string;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertAgent);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [emoji, setEmoji] = useState("🤖");
  const [desc, setDesc] = useState("");
  const [autonomy, setAutonomy] = useState<"suggest" | "bounded" | "autonomous">("suggest");
  const [caps, setCaps] = useState<Set<string>>(new Set(["create_task", "notify_human"]));
  const [prompt, setPrompt] = useState(
    "You are a specialist agent in a creative agency workspace. Be concise. Use tools instead of asking the human when possible. Only escalate when truly blocked.",
  );
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setHandle("");
    setEmoji("🤖");
    setDesc("");
    setAutonomy("suggest");
    setCaps(new Set(["create_task", "notify_human"]));
  };

  const submit = async () => {
    if (!name.trim()) return toast.error("Name required");
    setBusy(true);
    const r = await save({
      data: {
        workspace_id: workspaceId,
        name: name.trim(),
        handle: handle.trim().replace(/^@/, "") || undefined,
        avatar_emoji: emoji,
        description: desc.trim() || undefined,
        autonomy_level: autonomy,
        capabilities: Array.from(caps),
        system_prompt: prompt,
      },
    });
    setBusy(false);
    if (r.ok) {
      toast.success("Agent created");
      reset();
      onOpenChange(false);
      onSaved();
    } else toast.error(r.error);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New agent</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[80px_1fr_1fr] gap-2">
            <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Planner" />
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@planner"
            />
          </div>
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Short description shown to humans"
            rows={2}
          />
          <div>
            <label className="mb-1 block text-xs font-medium">Autonomy</label>
            <Select value={autonomy} onValueChange={(v) => setAutonomy(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="suggest">Suggest — propose, human approves each</SelectItem>
                <SelectItem value="bounded">Bounded — act in guardrails, report after</SelectItem>
                <SelectItem value="autonomous">Autonomous — act unless blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Capabilities</label>
            <div className="flex flex-wrap gap-1.5">
              {CAPABILITY_OPTIONS.map((c) => {
                const active = caps.has(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      const next = new Set(caps);
                      if (active) next.delete(c);
                      else next.add(c);
                      setCaps(next);
                    }}
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">System prompt</label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Create agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BriefDialog({
  open,
  onOpenChange,
  workspaceId,
  agentId,
  agents,
  onSent,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  workspaceId: string;
  agentId: string;
  agents: any[];
  onSent: () => void;
}) {
  const brief = useServerFn(briefAgent);
  const run = useServerFn(executeAgent);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const agent = useMemo(() => agents.find((a) => a.id === agentId), [agents, agentId]);

  const submit = async () => {
    if (!goal.trim()) return;
    setBusy(true);
    const r = await brief({
      data: { workspace_id: workspaceId, agent_id: agentId, goal: goal.trim() },
    });
    if (r.ok && r.execution?.id) {
      toast.success("Agent briefed — running…");
      const exec = await run({ data: { execution_id: r.execution.id as string } });
      if (exec.ok) toast.success(`Agent ${exec.status}`);
      else toast.error(exec.error);
      setGoal("");
      onOpenChange(false);
      onSent();
    } else if (!r.ok) {
      toast.error(r.error);
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Brief {agent?.avatar_emoji} {agent?.name}
          </DialogTitle>
        </DialogHeader>
        <Textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="What should the agent do? e.g. 'Plan Sprint 24 based on last sprint's velocity'"
          rows={5}
          autoFocus
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !goal.trim()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Brief agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemoriesPanel({ workspaceId }: { workspaceId: string }) {
  const fetchMems = useServerFn(listAgentMemories);
  const removeMem = useServerFn(deleteAgentMemory);
  const qc = useQueryClient();
  const memQ = useQuery({
    enabled: !!workspaceId,
    queryKey: ["agent-memories", workspaceId],
    queryFn: () => fetchMems({ data: { workspace_id: workspaceId, limit: 30 } }),
    refetchInterval: 15000,
  });
  const memories = memQ.data?.ok ? memQ.data.memories : [];

  const onDelete = async (id: string) => {
    const r = await removeMem({ data: { id } });
    if (r.ok) {
      toast.success("Memory removed");
      qc.invalidateQueries({ queryKey: ["agent-memories", workspaceId] });
    } else toast.error(r.error);
  };

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Brain className="h-3.5 w-3.5" /> Agent memories
      </h2>
      <Card className="divide-y divide-border">
        {memories.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            Agents will record durable insights here as they work.
          </div>
        )}
        {memories.map((m: any) => (
          <div key={m.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
            <span className="text-base">{m.agent?.avatar_emoji ?? "🤖"}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {m.memory_type}
                </Badge>
                <span className="text-xs text-muted-foreground">{m.agent?.name}</span>
              </div>
              <p className="mt-0.5 text-sm">{m.content}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onDelete(m.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
