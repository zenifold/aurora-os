import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAiAgents } from "@/hooks/use-ai";
import { runAiAssignment } from "@/server/ai.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Check,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { AiAgent, AiTaskAssignment } from "@/hooks/use-ai";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/loading-scaffolds";

export const Route = createFileRoute("/app/agent-runs")({
  component: AgentRunsPage,
});

type Status = AiTaskAssignment["status"] | "all";

const STATUS_META: Record<
  AiTaskAssignment["status"],
  { label: string; icon: typeof Check; className: string }
> = {
  queued: { label: "Queued", icon: Clock, className: "bg-muted text-muted-foreground" },
  running: { label: "Running", icon: Loader2, className: "bg-blue-500/15 text-blue-500" },
  review_needed: { label: "Review", icon: Eye, className: "bg-amber-500/15 text-amber-600" },
  completed: { label: "Completed", icon: Check, className: "bg-emerald-500/15 text-emerald-600" },
  failed: { label: "Failed", icon: AlertTriangle, className: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Cancelled", icon: X, className: "bg-muted text-muted-foreground" },
};

interface RunRow extends AiTaskAssignment {
  task?: { id: string; title: string } | null;
  agent?: AiAgent | null;
}

function AgentRunsPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  const { data: agents = [] } = useAiAgents();
  const runFn = useServerFn(runAiAssignment);

  const [status, setStatus] = useState<Status>("all");
  const [agentId, setAgentId] = useState<string>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<RunRow | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["agent-runs", ws?.id, status, agentId],
    enabled: !!ws,
    queryFn: async () => {
      let query = supabase
        .from("ai_task_assignments")
        .select("*, task:tasks(id, title), agent:ai_agents(*)")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") query = query.eq("status", status);
      if (agentId !== "all") query = query.eq("agent_id", agentId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as RunRow[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!ws) return;
    const ch = supabase
      .channel(`agent-runs-${ws.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_task_assignments", filter: `workspace_id=eq.${ws.id}` },
        () => qc.invalidateQueries({ queryKey: ["agent-runs", ws.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [ws, qc]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.task?.title?.toLowerCase().includes(term) ||
        r.agent?.name?.toLowerCase().includes(term) ||
        r.output?.toLowerCase().includes(term) ||
        r.error_message?.toLowerCase().includes(term),
    );
  }, [rows, q]);

  const stats = useMemo(() => {
    const totals = { running: 0, review: 0, completed: 0, failed: 0, tokens: 0 };
    for (const r of rows) {
      if (r.status === "running" || r.status === "queued") totals.running++;
      else if (r.status === "review_needed") totals.review++;
      else if (r.status === "completed") totals.completed++;
      else if (r.status === "failed") totals.failed++;
      totals.tokens += r.tokens_used ?? 0;
    }
    return totals;
  }, [rows]);

  const retry = async (row: RunRow) => {
    setRetrying(row.id);
    try {
      // Create a new assignment that mirrors the failed one
      const { data: created, error } = await supabase
        .from("ai_task_assignments")
        .insert({
          workspace_id: row.workspace_id,
          task_id: row.task_id,
          agent_id: row.agent_id,
          instructions: row.instructions,
          
          status: "queued",
        })
        .select("id")
        .single();
      if (error) throw error;
      runFn({ data: { assignment_id: created.id } }).catch((e) =>
        toast.error(e instanceof Error ? e.message : "Run failed"),
      );
      toast.success("Re-queued");
      qc.invalidateQueries({ queryKey: ["agent-runs", ws?.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to retry");
    } finally {
      setRetrying(null);
    }
  };

  const cancel = async (row: RunRow) => {
    await supabase.from("ai_task_assignments").update({ status: "cancelled" }).eq("id", row.id);
    qc.invalidateQueries({ queryKey: ["agent-runs", ws?.id] });
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Agent runs</h1>
          <p className="text-sm text-muted-foreground">
            Monitor every AI agent execution across your workspace.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="In flight" value={stats.running} icon={Loader2} tone="blue" />
        <KpiCard label="Awaiting review" value={stats.review} icon={Eye} tone="amber" />
        <KpiCard label="Completed" value={stats.completed} icon={Check} tone="emerald" />
        <KpiCard label="Failed" value={stats.failed} icon={AlertTriangle} tone="rose" />
        <KpiCard label="Tokens used" value={stats.tokens.toLocaleString()} icon={Bot} tone="violet" />
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search task, agent, output…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="review_needed">Review</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.avatar_emoji ?? "🤖"} {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => qc.invalidateQueries({ queryKey: ["agent-runs"] })}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {isLoading ? "Loading…" : `${filtered.length} run${filtered.length === 1 ? "" : "s"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-3">
              <ListSkeleton rows={5} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No agent runs"
              description="Assign a task to an AI agent to see runs here."
              className="m-3 border-0 bg-transparent"
            />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((row) => {
                const meta = STATUS_META[row.status];
                const Icon = meta.icon;
                return (
                  <li
                    key={row.id}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-muted/40"
                    onClick={() => setSelected(row)}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-aura-purple/15 text-sm">
                      {row.agent?.avatar_emoji ?? "🤖"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {row.task?.title ?? "Deleted task"}
                        </span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {row.agent?.name ?? "Agent"}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}</span>
                        {row.tokens_used != null && <span>· {row.tokens_used} tok</span>}
                        {row.model_used && <span className="truncate">· {row.model_used}</span>}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        meta.className,
                      )}
                    >
                      <Icon className={cn("h-3 w-3", row.status === "running" && "animate-spin")} />
                      {meta.label}
                    </span>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {(row.status === "failed" || row.status === "cancelled") && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={retrying === row.id}
                          onClick={() => retry(row)}
                        >
                          {retrying === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                      {(row.status === "queued" || row.status === "running") && (
                        <Button size="sm" variant="ghost" onClick={() => cancel(row)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Detail */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-hidden sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span>{selected.agent?.avatar_emoji ?? "🤖"}</span>
                  {selected.agent?.name ?? "Agent"} run
                </SheetTitle>
                <SheetDescription className="truncate">
                  {selected.task?.title ?? "Deleted task"}
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="mt-4 h-[calc(100vh-9rem)] pr-3">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Meta label="Status" value={STATUS_META[selected.status].label} />
                    <Meta label="Model" value={selected.model_used ?? selected.agent?.model ?? "—"} />
                    <Meta label="Tokens" value={selected.tokens_used?.toLocaleString() ?? "—"} />
                    <Meta label="Iterations" value={String(selected.iterations ?? 0)} />
                    <Meta
                      label="Started"
                      value={
                        selected.started_at
                          ? formatDistanceToNow(new Date(selected.started_at), { addSuffix: true })
                          : "—"
                      }
                    />
                    <Meta
                      label="Completed"
                      value={
                        selected.completed_at
                          ? formatDistanceToNow(new Date(selected.completed_at), { addSuffix: true })
                          : "—"
                      }
                    />
                  </div>

                  {selected.instructions && (
                    <Section title="Instructions">
                      <pre className="whitespace-pre-wrap text-xs">{selected.instructions}</pre>
                    </Section>
                  )}

                  {selected.error_message && (
                    <Section title="Error" tone="destructive">
                      <pre className="whitespace-pre-wrap text-xs">{selected.error_message}</pre>
                    </Section>
                  )}

                  {selected.output && (
                    <Section title="Output">
                      <pre className="whitespace-pre-wrap text-xs">{selected.output}</pre>
                    </Section>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: typeof Check;
  tone: "blue" | "amber" | "emerald" | "rose" | "violet";
}) {
  const tones: Record<string, string> = {
    blue: "text-blue-500 bg-blue-500/10",
    amber: "text-amber-600 bg-amber-500/10",
    emerald: "text-emerald-600 bg-emerald-500/10",
    rose: "text-destructive bg-destructive/10",
    violet: "text-aura-purple bg-aura-purple/10",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate text-sm">{value}</div>
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "destructive";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        tone === "destructive"
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-muted/30",
      )}
    >
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}
