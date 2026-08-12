import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgentExecution } from "@/server/agents.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Clock,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/app/runs/$runId")({
  component: RunDetailPage,
});

type StepAction = {
  tool: string;
  status: string;
  summary: string;
  result?: unknown;
  error?: string;
};
type Step = { iteration: number; thought: string; actions: StepAction[] };

const STATUS_TONE: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-600",
  running: "bg-blue-500/15 text-blue-600",
  planning: "bg-blue-500/15 text-blue-600",
  awaiting_approval: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  failed: "bg-destructive/15 text-destructive",
};

function RunDetailPage() {
  const { runId } = Route.useParams();
  const fetchExec = useServerFn(getAgentExecution);
  const q = useQuery({
    queryKey: ["agent-execution", runId],
    queryFn: () => fetchExec({ data: { id: runId } }),
    refetchInterval: 5000,
  });

  if (q.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!q.data?.ok) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{q.data?.ok === false ? q.data.error : "Not found"}</p>
      </div>
    );
  }

  const exec = q.data.execution as {
    id: string;
    goal: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    trigger: string;
    error_message: string | null;
    actions: Step[] | null;
    result: { thought?: string; iterations?: number; total_actions?: number } | null;
    agent: { name: string; avatar_emoji?: string; handle?: string } | null;
    approvals: Array<{ id: string; tool_name: string; status: string; action_summary: string }>;
  };
  const trace: Step[] = Array.isArray(exec.actions) ? exec.actions : [];

  return (
    <div className="flex h-full flex-col animate-page-in">
      <header className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app/agent-runs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="icon-tile">{exec.agent?.avatar_emoji ?? "🤖"}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-semibold truncate">{exec.agent?.name ?? "Agent"}</h1>
              <Badge className={STATUS_TONE[exec.status] ?? "bg-muted"}>{exec.status}</Badge>
              <Badge variant="outline">{exec.trigger}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{exec.goal}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Started {formatDistanceToNow(new Date(exec.started_at), { addSuffix: true })}</div>
            {exec.completed_at && (
              <div>Done {formatDistanceToNow(new Date(exec.completed_at), { addSuffix: true })}</div>
            )}
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl space-y-6 p-6">
          {exec.error_message && (
            <Card className="surface-card flex items-start gap-3 border-destructive/30 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">Run failed</p>
                <p className="text-sm text-muted-foreground">{exec.error_message}</p>
              </div>
            </Card>
          )}

          {trace.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No steps recorded yet. {exec.status === "planning" ? "Agent is thinking…" : null}
            </Card>
          ) : (
            <ol className="space-y-4">
              {trace.map((step) => (
                <li key={step.iteration} className="relative pl-8">
                  <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-aura-gradient-subtle text-xs font-semibold">
                    {step.iteration + 1}
                  </div>
                  <Card className="surface-card space-y-3 p-4">
                    {step.thought && (
                      <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3">
                        <Brain className="mt-0.5 h-4 w-4 text-primary" />
                        <p className="text-sm italic text-muted-foreground">{step.thought}</p>
                      </div>
                    )}
                    {step.actions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No actions in this step.</p>
                    ) : (
                      <div className="space-y-2">
                        {step.actions.map((a, i) => (
                          <ActionRow key={i} action={a} />
                        ))}
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ol>
          )}

          {exec.approvals && exec.approvals.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <ShieldCheck className="h-4 w-4" /> Approvals · {exec.approvals.length}
              </h3>
              <div className="space-y-2">
                {exec.approvals.map((a) => (
                  <Card key={a.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium">{a.action_summary || a.tool_name}</p>
                      <p className="text-xs text-muted-foreground">{a.tool_name}</p>
                    </div>
                    <Badge variant="outline">{a.status}</Badge>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {exec.result?.total_actions != null && (
            <Card className="p-4 text-xs text-muted-foreground">
              {exec.result.iterations} iteration(s) · {exec.result.total_actions} action(s)
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ActionRow({ action }: { action: StepAction }) {
  const Icon =
    action.status === "executed"
      ? CheckCircle2
      : action.status === "failed"
      ? XCircle
      : action.status === "queued"
      ? Clock
      : AlertTriangle;
  const tint =
    action.status === "executed"
      ? "text-emerald-500"
      : action.status === "failed"
      ? "text-destructive"
      : action.status === "queued"
      ? "text-amber-500"
      : "text-muted-foreground";
  return (
    <details className="rounded-md border border-border bg-background/40">
      <summary className="flex cursor-pointer items-center gap-2 p-2.5 text-sm">
        <Icon className={`h-4 w-4 ${tint}`} />
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{action.tool}</code>
        <span className="flex-1 truncate text-muted-foreground">{action.summary}</span>
        <Badge variant="outline" className="text-[10px]">{action.status}</Badge>
      </summary>
      <div className="border-t border-border p-3">
        {action.error && <p className="mb-2 text-xs text-destructive">{action.error}</p>}
        {action.result !== undefined && (
          <pre className="overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-snug">
            {JSON.stringify(action.result, null, 2)}
          </pre>
        )}
        {action.error === undefined && action.result === undefined && (
          <p className="text-xs text-muted-foreground">No payload recorded.</p>
        )}
      </div>
    </details>
  );
}
