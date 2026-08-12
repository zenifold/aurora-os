import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  ShieldAlert, Bot, Sparkles, Inbox as InboxIcon, AlarmClock, Check, X, ChevronRight, Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import {
  getUnifiedInbox,
  decideApproval,
  type UnifiedInboxItem,
  type UnifiedInboxKind,
} from "@/lib/unified-inbox.functions";

const KIND_META: Record<UnifiedInboxKind, { label: string; icon: typeof InboxIcon; tone: string }> = {
  notification: { label: "Update", icon: InboxIcon, tone: "text-foreground/70" },
  transition_approval: { label: "Phase gate", icon: ShieldAlert, tone: "text-purple-500" },
  agent_approval: { label: "Agent", icon: Bot, tone: "text-fuchsia-500" },
  portal_unblock: { label: "Client", icon: InboxIcon, tone: "text-emerald-500" },
  ai_draft: { label: "AI draft", icon: Sparkles, tone: "text-amber-500" },
  due_task: { label: "Due", icon: AlarmClock, tone: "text-blue-500" },
};

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-muted-foreground/40",
};

export function PriorityStream() {
  const ws = useWorkspaceStore((s) => s.current);
  const fetchInbox = useServerFn(getUnifiedInbox);
  const decide = useServerFn(decideApproval);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["unified-inbox", ws?.id],
    enabled: !!ws?.id,
    queryFn: () => fetchInbox({ data: { workspaceId: ws!.id } }),
    refetchInterval: 30_000,
  });

  const decideMut = useMutation({
    mutationFn: (input: { ref: UnifiedInboxItem["decideRef"]; approve: boolean }) =>
      decide({ data: { ref: input.ref!, approve: input.approve } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unified-inbox"] });
      toast.success("Decision recorded.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not record decision."),
  });

  const [collapsed, setCollapsed] = useState(false);

  if (!ws?.id) return null;
  if (!isLoading && items.length === 0) return null;

  const topItems = collapsed ? items.slice(0, 3) : items.slice(0, 10);

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-border bg-gradient-to-b from-primary/[0.04] to-card">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold">Priority stream</h2>
          {items.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{items.length}</Badge>
          )}
        </div>
        {items.length > 3 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? `Show all (${items.length})` : "Show less"}
          </Button>
        )}
      </div>

      <div className="divide-y divide-border/60">
        {topItems.map((item) => {
          const meta = KIND_META[item.kind];
          const Icon = meta.icon;
          return (
            <div key={item.id} className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30">
              <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted", meta.tone)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_DOT[item.priority])} />
                  <span className="truncate text-sm font-medium">{item.title}</span>
                </div>
                {item.body && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                )}
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium uppercase tracking-wide">{meta.label}</span>
                  <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {item.decidable && item.decideRef && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-emerald-600 hover:bg-emerald-500/10"
                      title="Approve"
                      disabled={decideMut.isPending}
                      onClick={() => decideMut.mutate({ ref: item.decideRef, approve: true })}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-600 hover:bg-red-500/10"
                      title="Reject"
                      disabled={decideMut.isPending}
                      onClick={() => decideMut.mutate({ ref: item.decideRef, approve: false })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {item.link && (
                  <Link
                    to={item.link}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                    title="Open"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
