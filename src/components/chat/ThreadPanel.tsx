import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useParentMessage,
  useSendChannelMessage,
  useThreadReplies,
  extractMentions,
} from "@/hooks/use-channels";
import { useTeamMembers } from "@/hooks/use-team";

export function ThreadPanel({
  channelId,
  parentId,
  onClose,
}: {
  channelId: string;
  parentId: string;
  onClose: () => void;
}) {
  const { data: parent } = useParentMessage(parentId);
  const { data: replies = [], isLoading } = useThreadReplies(channelId, parentId);
  const { data: team = [] } = useTeamMembers();
  const send = useSendChannelMessage(channelId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const memberById = useMemo(() => {
    const m = new Map<string, { name: string; avatar?: string | null }>();
    for (const t of team as Array<{ user_id: string; display_name?: string | null; avatar_url?: string | null }>) {
      m.set(t.user_id, { name: t.display_name ?? "Unknown", avatar: t.avatar_url ?? null });
    }
    return m;
  }, [team]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [replies.length]);

  const teamMembers = useMemo(
    () => (team as Array<{ user_id: string; display_name?: string | null }>).map((t) => ({
      user_id: t.user_id,
      display_name: t.display_name ?? null,
    })),
    [team],
  );

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    void send.mutateAsync({
      body_md: text,
      parent_message_id: parentId,
      mentions: extractMentions(text, teamMembers),
    }).then(() => setDraft(""));
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const renderMessage = (m: { author_id: string | null; created_at: string; body_md: string | null; deleted_at: string | null; id: string }) => {
    const author = m.author_id ? memberById.get(m.author_id) : undefined;
    return (
      <div key={m.id} className="flex gap-3 py-2">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={author?.avatar ?? undefined} />
          <AvatarFallback className="text-[10px]">{(author?.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold">{author?.name ?? "Unknown"}</span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          {m.deleted_at ? (
            <p className="text-xs italic text-muted-foreground">message deleted</p>
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-snug">{m.body_md}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <h3 className="text-sm font-semibold">Thread</h3>
          <p className="text-[11px] text-muted-foreground">
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3">
        {parent && (
          <div className="border-b border-border pb-2">
            {renderMessage(parent)}
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          replies.map(renderMessage)
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="Reply in thread…"
            className="min-h-[40px] flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm shadow-none focus-visible:ring-0"
            rows={1}
          />
          <Button size="icon" disabled={!draft.trim() || send.isPending} onClick={submit} className="h-8 w-8 shrink-0">
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}
