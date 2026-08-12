import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bot, ChevronRight } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Badge } from "@/components/ui/badge";
import {
  listPanelAgents,
  listPanelAgentExecutions,
  listPanelPendingApprovals,
} from "@/lib/agent-panel.functions";

/**
 * Persistent Agent Bar — shows active agents, recent activity, and pending approvals.
 * Click → /app/agents (Agent Command Center).
 */
export function AgentBar() {
  const wsId = useWorkspaceStore((s) => s.current?.id);

  const fetchAgents = useServerFn(listPanelAgents);
  const fetchExecs = useServerFn(listPanelAgentExecutions);
  const fetchApprovals = useServerFn(listPanelPendingApprovals);

  const agentsQ = useQuery({
    enabled: !!wsId,
    queryKey: ["agents-bar", wsId],
    queryFn: () => fetchAgents({ data: { workspace_id: wsId! } }),
    refetchInterval: 30000,
  });
  const execsQ = useQuery({
    enabled: !!wsId,
    queryKey: ["agent-execs-bar", wsId],
    queryFn: () => fetchExecs({ data: { workspace_id: wsId!, limit: 1 } }),
    refetchInterval: 15000,
  });
  const apprQ = useQuery({
    enabled: !!wsId,
    queryKey: ["agent-approvals-bar", wsId],
    queryFn: () => fetchApprovals({ data: { workspace_id: wsId! } }),
    refetchInterval: 15000,
  });

  if (!wsId) return null;
  const agents = agentsQ.data?.ok ? agentsQ.data.agents : [];
  if (agents.length === 0) return null;

  const working = agents.filter((a: any) => a.status === "working");
  const lastExec = execsQ.data?.ok ? execsQ.data.executions[0] : undefined;
  const approvals = apprQ.data?.ok ? apprQ.data.approvals.length : 0;

  const summary =
    working.length > 0
      ? `${working.length} agent${working.length > 1 ? "s" : ""} working`
      : `${agents.length} agent${agents.length > 1 ? "s" : ""} idle`;

  return (
    <Link
      to={approvals > 0 ? "/app/approvals" : "/app/agents"}
      className="hidden h-8 max-w-md items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 text-xs transition-colors hover:bg-muted/70 md:flex"
    >
      <Bot className="h-3.5 w-3.5 text-primary" />
      <span className="font-medium">{summary}</span>
      {lastExec && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="truncate text-muted-foreground max-w-[200px]">
            {lastExec.goal}
          </span>
        </>
      )}
      {approvals > 0 && (
        <Badge variant="destructive" className="ml-auto h-4 px-1 text-[10px]">
          {approvals} approval{approvals > 1 ? "s" : ""}
        </Badge>
      )}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}
