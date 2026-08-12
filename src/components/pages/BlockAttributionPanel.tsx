import { Sparkles, Check, X, Eye, RotateCcw, ShieldCheck, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { usePageAttributions, useReviewAttribution } from "@/hooks/use-pages-extra";

interface Props {
  pageId: string;
  onJumpToBlock?: (blockId: string) => void;
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  review: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  published: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  reverted: "bg-muted text-muted-foreground border-border",
};

export function BlockAttributionPanel({ pageId, onJumpToBlock }: Props) {
  const { data: attrs = [], isLoading } = usePageAttributions(pageId);
  const review = useReviewAttribution();

  return (
    <div className="flex h-full w-full flex-col border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">AI attribution</div>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {attrs.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
          {!isLoading && attrs.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
              No AI-attributed blocks yet. When AI edits a block, it shows up here with the agent,
              model, and reasoning — and you can accept, send for review, or revert.
            </div>
          )}
          {attrs.map((a) => (
            <div key={a.id} className="rounded-md border border-border bg-background p-3 text-xs">
              <div className="flex items-center gap-1.5">
                {a.source === "ai" || a.source === "agent" ? (
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="font-medium">{a.agent_name ?? "AI"}</span>
                {a.model && <span className="text-muted-foreground">· {a.model}</span>}
                <Badge
                  variant="outline"
                  className={`ml-auto h-5 px-1.5 text-[10px] ${STATUS_TONE[a.status]}`}
                >
                  {a.status}
                </Badge>
              </div>
              {a.reasoning && (
                <div className="mt-2 line-clamp-3 text-muted-foreground">{a.reasoning}</div>
              )}
              <div className="mt-2 flex items-center justify-between gap-1">
                <button
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => onJumpToBlock?.(a.block_id)}
                >
                  Block {a.block_id.slice(0, 6)} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </button>
                <div className="flex items-center gap-1">
                  {a.status !== "review" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Send for review"
                      onClick={() => review.mutate({ id: a.id, status: "review" })}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                  {a.status !== "published" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-emerald-600"
                      title="Publish"
                      onClick={() => review.mutate({ id: a.id, status: "published" })}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  {a.status !== "reverted" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive"
                      title="Revert"
                      onClick={() => review.mutate({ id: a.id, status: "reverted" })}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  {a.status === "reverted" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Restore to draft"
                      onClick={() => review.mutate({ id: a.id, status: "draft" })}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
