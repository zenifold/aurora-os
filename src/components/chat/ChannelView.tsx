import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  useChannel,
  useChannelMessages,
  useGroupedReactions,
  useSendChannelMessage,
  useEditChannelMessage,
  useDeleteChannelMessage,
  useToggleReaction,
  useMarkChannelRead,
  useChannelPins,
  useTogglePin,
  useConvertMessageToTask,
  extractMentions,
  type ChannelMessageRow,
} from "@/hooks/use-channels";
import { useTeamMembers } from "@/hooks/use-team";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Hash, Lock, Smile, MoreHorizontal, Send, Loader2, Pencil, Trash2, X, Pin, ListChecks, ChevronDown, MessageSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmojiPicker } from "./EmojiPicker";
import { ThreadPanel } from "./ThreadPanel";

import { cn } from "@/lib/utils";



export function ChannelView({ channelId }: { channelId: string }) {
  const { data: channel } = useChannel(channelId);
  const { data: messages = [], isLoading } = useChannelMessages(channelId);
  const { data: team = [] } = useTeamMembers();
  const { user } = useAuth();

  const memberById = useMemo(() => {
    const m = new Map<string, { name: string; avatar?: string | null }>();
    for (const t of team as Array<{ user_id: string; display_name?: string | null; avatar_url?: string | null }>) {
      m.set(t.user_id, { name: t.display_name ?? "Unknown", avatar: t.avatar_url ?? null });
    }
    return m;
  }, [team]);

  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const reactionsByMessage = useGroupedReactions(channelId, messageIds);

  const send = useSendChannelMessage(channelId);
  const editMsg = useEditChannelMessage();
  const deleteMsg = useDeleteChannelMessage();
  const toggleReaction = useToggleReaction();
  const markRead = useMarkChannelRead();
  const togglePin = useTogglePin();
  const convertToTask = useConvertMessageToTask();
  const { data: pins = [] } = useChannelPins(channelId);
  const pinnedIds = useMemo(() => new Set(pins.map((p) => p.message_id)), [pins]);
  const [showPins, setShowPins] = useState(false);

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (channelId && messages.length > 0) {
      markRead.mutate(channelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, messages.length]);

  const teamMembers = useMemo(
    () =>
      (team as Array<{ user_id: string; display_name?: string | null }>).map((t) => ({
        user_id: t.user_id,
        display_name: t.display_name ?? null,
      })),
    [team],
  );

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return teamMembers
      .filter((t) => (t.display_name ?? "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, teamMembers]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    const mentions = extractMentions(text, teamMembers);
    void send.mutateAsync({ body_md: text, mentions }).then(() => {
      setDraft("");
      setMentionQuery(null);
    });
  };

  const insertMention = (name: string) => {
    const handle = "@" + name.replace(/\s+/g, "");
    setDraft((d) => d.replace(/@(\S*)$/, handle + " "));
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionMatches.length > 0 && (e.key === "Enter" || e.key === "Tab")) {
      e.preventDefault();
      insertMention(mentionMatches[0].display_name ?? "");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    const m = value.match(/@(\S*)$/);
    setMentionQuery(m ? m[1] : null);
  };

  const memberHandles = useMemo(() => {
    const set = new Set<string>();
    for (const t of teamMembers) {
      const n = (t.display_name ?? "").replace(/\s+/g, "").toLowerCase();
      if (n) set.add(n);
    }
    return set;
  }, [teamMembers]);

  const currentUserHandle = useMemo(() => {
    const me = teamMembers.find((t) => t.user_id === user?.id);
    return (me?.display_name ?? "").replace(/\s+/g, "").toLowerCase();
  }, [teamMembers, user?.id]);

  // Group consecutive messages by author within 5 minutes
  const grouped: Array<{ author_id: string | null; items: ChannelMessageRow[] }> = [];
  for (const m of messages) {
    const last = grouped[grouped.length - 1];
    const same =
      last &&
      last.author_id === m.author_id &&
      last.items.length > 0 &&
      new Date(m.created_at).getTime() -
        new Date(last.items[last.items.length - 1].created_at).getTime() <
        5 * 60 * 1000;
    if (same) last.items.push(m);
    else grouped.push({ author_id: m.author_id, items: [m] });
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {channel?.is_private ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Hash className="h-4 w-4 text-muted-foreground" />
        )}
        <h2 className="text-sm font-semibold">{channel?.name ?? "Channel"}</h2>
        {channel?.topic && (
          <span className="ml-2 truncate text-xs text-muted-foreground">{channel.topic}</span>
        )}
        {pins.length > 0 && (
          <button
            onClick={() => setShowPins((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pin className="h-3 w-3" /> {pins.length} pinned
            <ChevronDown className={cn("h-3 w-3 transition-transform", showPins && "rotate-180")} />
          </button>
        )}
      </div>

      {showPins && pins.length > 0 && (
        <div className="border-b border-border bg-muted/30 px-4 py-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pinned</div>
          <ul className="space-y-1">
            {pins.map((p) => (
              <li key={p.message_id} className="flex items-start gap-2 text-xs">
                <Pin className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span className="flex-1 truncate text-foreground">
                  {p.message?.body_md ?? <span className="italic text-muted-foreground">deleted</span>}
                </span>
                <button
                  onClick={() => togglePin.mutate({ channelId, messageId: p.message_id, pinned: true })}
                  className="text-muted-foreground hover:text-destructive"
                  title="Unpin"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-4 sm:px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto mt-12 max-w-md text-center text-sm text-muted-foreground">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-aura-gradient-subtle">
              <Hash className="h-5 w-5" />
            </div>
            This is the start of <span className="font-medium text-foreground">#{channel?.name}</span>.
            <br />
            Say hi to kick things off.
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((g, gi) => {
              const author = g.author_id ? memberById.get(g.author_id) : undefined;
              const first = g.items[0];
              return (
                <div key={gi} className="group flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={author?.avatar ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {(author?.name ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold">{author?.name ?? "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(first.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {g.items.map((m) => {
                        const reactions = reactionsByMessage.get(m.id);
                        const isOwn = m.author_id === user?.id;
                        const isEditing = editingId === m.id;
                        return (
                          <div key={m.id} className="group/msg relative rounded px-1 py-0.5 hover:bg-accent/30">
                            {m.deleted_at ? (
                              <p className="text-sm italic text-muted-foreground">message deleted</p>
                            ) : isEditing ? (
                              <div className="flex flex-col gap-2">
                                <Textarea
                                  value={editDraft}
                                  onChange={(e) => setEditDraft(e.target.value)}
                                  className="min-h-[60px] text-sm"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      void editMsg
                                        .mutateAsync({
                                          id: m.id,
                                          body_md: editDraft,
                                          channel_id: channelId,
                                        })
                                        .then(() => setEditingId(null));
                                    }}
                                  >
                                    Save
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap break-words text-sm leading-snug">
                                <MessageBody text={m.body_md ?? ""} memberHandles={memberHandles} currentUserHandle={currentUserHandle} />
                                {m.edited_at && (
                                  <span className="ml-1 text-[10px] text-muted-foreground">(edited)</span>
                                )}
                              </p>
                            )}

                            {/* Reactions row */}
                            {reactions && reactions.size > 0 && !m.deleted_at && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {Array.from(reactions.entries()).map(([emoji, info]) => {
                                  const mine = user ? info.userIds.includes(user.id) : false;
                                  return (
                                    <button
                                      key={emoji}
                                      onClick={() =>
                                        toggleReaction.mutate({
                                          messageId: m.id,
                                          emoji,
                                          channelId,
                                          alreadyReacted: mine,
                                        })
                                      }
                                      className={cn(
                                        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition",
                                        mine
                                          ? "border-primary/40 bg-primary/10"
                                          : "border-border bg-background hover:bg-accent",
                                      )}
                                    >
                                      <span>{emoji}</span>
                                      <span className="text-[10px] text-muted-foreground">{info.count}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {(m.thread_count ?? 0) > 0 && !m.deleted_at && (
                              <button
                                onClick={() => setOpenThreadId(m.id)}
                                className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-xs font-medium text-primary hover:border-border hover:bg-accent"
                              >
                                <MessageSquare className="h-3 w-3" />
                                {m.thread_count} {m.thread_count === 1 ? "reply" : "replies"}
                                {m.thread_last_reply_at && (
                                  <span className="text-[10px] font-normal text-muted-foreground">
                                    · last {new Date(m.thread_last_reply_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </button>
                            )}

                            {!m.deleted_at && !isEditing && (
                              <div className="absolute right-1 top-1 hidden items-center gap-0.5 rounded border border-border bg-popover p-0.5 shadow-sm group-hover/msg:flex">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-6 w-6">
                                      <Smile className="h-3.5 w-3.5" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent align="end" className="w-auto p-0">
                                    <EmojiPicker
                                      onPick={(e) =>
                                        toggleReaction.mutate({
                                          messageId: m.id,
                                          emoji: e,
                                          channelId,
                                          alreadyReacted: false,
                                        })
                                      }
                                    />
                                  </PopoverContent>
                                </Popover>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  title="Reply in thread"
                                  onClick={() => setOpenThreadId(m.id)}
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-6 w-6">
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        togglePin.mutate({
                                          channelId,
                                          messageId: m.id,
                                          pinned: pinnedIds.has(m.id),
                                        })
                                      }
                                    >
                                      <Pin className="mr-2 h-3.5 w-3.5" />
                                      {pinnedIds.has(m.id) ? "Unpin" : "Pin to channel"}
                                    </DropdownMenuItem>
                                    {channel?.scope === "project" && channel.scope_id && (
                                      <DropdownMenuItem
                                        onClick={async () => {
                                          const t = await convertToTask.mutateAsync({
                                            channelId,
                                            messageId: m.id,
                                            body: m.body_md ?? "",
                                            projectId: channel.scope_id!,
                                          });
                                          // Optionally pin it for traceability
                                          if (t?.id) togglePin.mutate({ channelId, messageId: m.id, pinned: false });
                                        }}
                                      >
                                        <ListChecks className="mr-2 h-3.5 w-3.5" /> Convert to task
                                      </DropdownMenuItem>
                                    )}
                                    {isOwn && <DropdownMenuSeparator />}
                                    {isOwn && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setEditingId(m.id);
                                            setEditDraft(m.body_md ?? "");
                                          }}
                                        >
                                          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onClick={() =>
                                            deleteMsg.mutate({ id: m.id, channel_id: channelId })
                                          }
                                        >
                                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="relative flex items-end gap-2 rounded-lg border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
          {mentionMatches.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
              {mentionMatches.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => insertMention(m.display_name ?? "")}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="font-medium">@{(m.display_name ?? "").replace(/\s+/g, "")}</span>
                  <span className="truncate text-xs text-muted-foreground">{m.display_name}</span>
                </button>
              ))}
            </div>
          )}
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKey}
            placeholder={`Message #${channel?.name ?? ""}`}
            className="min-h-[40px] flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm shadow-none focus-visible:ring-0"
            rows={1}
          />
          <Button
            size="icon"
            disabled={!draft.trim() || send.isPending}
            onClick={submit}
            className="h-8 w-8 shrink-0"
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-1 px-1 text-[10px] text-muted-foreground">
          Enter to send · Shift+Enter for new line · @ to mention
        </p>
      </div>
    </div>
      {openThreadId && (
        <ThreadPanel channelId={channelId} parentId={openThreadId} onClose={() => setOpenThreadId(null)} />
      )}
    </div>
  );
}

function MessageBody({
  text,
  memberHandles,
  currentUserHandle,
}: {
  text: string;
  memberHandles: Set<string>;
  currentUserHandle: string;
}) {
  const parts = text.split(/(@[A-Za-z0-9_-]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("@")) {
          const handle = p.slice(1).toLowerCase();
          if (memberHandles.has(handle)) {
            const isMe = handle === currentUserHandle && currentUserHandle.length > 0;
            return (
              <span
                key={i}
                className={cn(
                  "rounded px-1 font-medium",
                  isMe ? "bg-primary/20 text-primary" : "bg-accent text-accent-foreground",
                )}
              >
                {p}
              </span>
            );
          }
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function ChannelEmptyState({ onPickFirst }: { onPickFirst?: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
      <div className="max-w-sm">
        <Hash className="mx-auto mb-3 h-8 w-8 opacity-50" />
        Pick a channel from the sidebar to start chatting.
        {onPickFirst && (
          <div className="mt-4">
            <Button size="sm" variant="outline" onClick={onPickFirst}>
              Open #general
              <X className="ml-2 hidden" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
