import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { listPendingApprovals, decideApproval } from "@/server/agents.functions";
import { Card } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, Loader2, ShieldCheck, Inbox, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/approvals")({
  component: ApprovalInboxPage,
});

const TOOL_LABEL: Record<string, { label: string; tint: string }> = {
  send_email: { label: "Send email", tint: "bg-blue-500/15 text-blue-600" },
  post_status_update: { label: "Post status update", tint: "bg-amber-500/15 text-amber-600" },
  create_invoice_draft: { label: "Create invoice draft", tint: "bg-emerald-500/15 text-emerald-600" },
  human_handoff: { label: "Human handoff", tint: "bg-purple-500/15 text-purple-600" },
};

function ApprovalInboxPage() {
  const wsId = useWorkspaceStore((s) => s.current?.id);
  const qc = useQueryClient();
  const fetchApprovals = useServerFn(listPendingApprovals);
  const decide = useServerFn(decideApproval);

  const [q, setQ] = useState("");
  const [tool, setTool] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const apprQ = useQuery({
    enabled: !!wsId,
    queryKey: ["approvals-inbox", wsId],
    queryFn: () => fetchApprovals({ data: { workspace_id: wsId! } }),
    refetchInterval: 20000,
  });
  const approvals: any[] = apprQ.data?.ok ? apprQ.data.approvals : [];

  const tools = useMemo(() => {
    const s = new Set<string>();
    approvals.forEach((a) => s.add(a.tool_name));
    return Array.from(s);
  }, [approvals]);

  const filtered = approvals.filter((a) => {
    if (tool !== "all" && a.tool_name !== tool) return false;
    if (q.trim()) {
      const t = q.toLowerCase();
      return (
        a.action_summary?.toLowerCase().includes(t) ||
        a.tool_name?.toLowerCase().includes(t) ||
        a.agent?.name?.toLowerCase().includes(t)
      );
    }
    return true;
  });

  async function decideOne(id: string, decision: "approved" | "rejected") {
    setBusy(id);
    const r = await decide({ data: { id, decision } });
    setBusy(null);
    if (r.ok) {
      toast.success(decision === "approved" ? "Executed" : "Rejected");
      qc.invalidateQueries({ queryKey: ["approvals-inbox"] });
      qc.invalidateQueries({ queryKey: ["agent-approvals", wsId] });
      qc.invalidateQueries({ queryKey: ["agent-approvals-bar", wsId] });
      setSelected((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    } else toast.error(r.error);
  }

  async function bulk(decision: "approved" | "rejected") {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setBusy("bulk");
    let ok = 0;
    for (const id of ids) {
      const r = await decide({ data: { id, decision } });
      if (r.ok) ok++;
    }
    setBusy(null);
    toast.success(`${decision === "approved" ? "Approved" : "Rejected"} ${ok}/${ids.length}`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["approvals-inbox"] });
  }

  return (
    <div className="animate-page-in mx-auto flex h-full max-w-5xl flex-col gap-4 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Approval inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            Review agent-proposed actions before they execute.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          {approvals.length} pending
        </Badge>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search summary, agent, tool…"
            className="pl-8"
          />
        </div>
        <Select value={tool} onValueChange={setTool}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tools</SelectItem>
            {tools.map((t) => (
              <SelectItem key={t} value={t}>
                {TOOL_LABEL[t]?.label ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={() => bulk("rejected")} disabled={busy === "bulk"}>
              Reject {selected.size}
            </Button>
            <Button size="sm" onClick={() => bulk("approved")} disabled={busy === "bulk"}>
              {busy === "bulk" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Approve ${selected.size}`}
            </Button>
          </>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 pr-2">
          {apprQ.isLoading && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
          {!apprQ.isLoading && filtered.length === 0 && (
            <Card className="flex flex-col items-center gap-2 p-10 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground" />
              <div className="font-medium">Nothing waiting on you</div>
              <div className="text-sm text-muted-foreground">
                Agents will queue actions here when they need approval.
              </div>
            </Card>
          )}
          {filtered.map((a) => {
            const meta = TOOL_LABEL[a.tool_name] ?? {
              label: a.tool_name,
              tint: "bg-muted text-muted-foreground",
            };
            const isSel = selected.has(a.id);
            return (
              <Card
                key={a.id}
                className={cn(
                  "surface-card flex flex-col gap-3 p-4 transition-colors",
                  isSel && "ring-2 ring-primary",
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-primary"
                    checked={isSel}
                    onChange={(e) => {
                      setSelected((p) => {
                        const n = new Set(p);
                        if (e.target.checked) n.add(a.id);
                        else n.delete(a.id);
                        return n;
                      });
                    }}
                  />
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-lg">
                    {a.agent?.avatar_emoji ?? "🤖"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.agent?.name ?? "Agent"}</span>
                      <Badge variant="secondary" className={cn("text-[10px]", meta.tint)}>
                        {meta.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{a.action_summary}</p>
                    {a.payload && Object.keys(a.payload).length > 0 && (
                      <details className="mt-2 rounded-md border border-border bg-muted/40 p-2 text-xs">
                        <summary className="cursor-pointer text-muted-foreground">
                          Payload preview
                        </summary>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed">
                          {JSON.stringify(a.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => decideOne(a.id, "rejected")}
                    disabled={busy === a.id}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => decideOne(a.id, "approved")}
                    disabled={busy === a.id}
                  >
                    {busy === a.id ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-3.5 w-3.5" />
                    )}
                    Approve &amp; run
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
