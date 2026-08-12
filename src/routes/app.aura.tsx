import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import {
  Sparkles, Send, Loader2, Pin, PinOff, Trash2, Plus, Globe, FolderTree,
  Briefcase, FileText, MessageSquare, ListTodo, Mic, Users, Check, X, ListPlus, StickyNote, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  listAuraConversations,
  getAuraConversation,
  deleteAuraConversation,
  togglePinAuraConversation,
  sendAuraMessage,
  runAuraAction,
  dismissAuraAction,
  type AuraMessage,
  type AuraAction,
} from "@/server/aura-chat.functions";

export const Route = createFileRoute("/app/aura")({
  component: AuraPage,
});

const SUGGESTIONS = [
  "Summarize this sprint's progress",
  "Which projects are off-track?",
  "Consolidate decisions from last week's meetings",
  "What blockers should I unblock today?",
];

const KIND_ICON: Record<string, typeof FileText> = {
  task: ListTodo,
  project: Briefcase,
  page: FileText,
  note: FileText,
  meeting: Mic,
  folder: FolderTree,
  contact: Users,
};

const KIND_LINK: Record<string, (id: string) => string> = {
  project: (id) => `/app/p/${id}`,
  task: (id) => `/app/p/${id}`,
  page: (id) => `/app/pages?p=${id}`,
  note: (id) => `/app/notes?n=${id}`,
  meeting: (id) => `/app/meetings/${id}`,
  folder: () => `/app/clients`,
  contact: () => `/app/contacts`,
};

function AuraPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  const list = useServerFn(listAuraConversations);
  const get = useServerFn(getAuraConversation);
  const send = useServerFn(sendAuraMessage);
  const del = useServerFn(deleteAuraConversation);
  const pin = useServerFn(togglePinAuraConversation);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [scopeType, setScopeType] = useState<"workspace" | "project" | "folder" | "page">("workspace");
  const [deep, setDeep] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: convos } = useQuery({
    queryKey: ["aura-conversations", ws?.id],
    queryFn: () => list({ data: { workspace_id: ws!.id } }),
    enabled: !!ws?.id,
  });

  const { data: active } = useQuery({
    queryKey: ["aura-conversation", activeId],
    queryFn: () => get({ data: { id: activeId! } }),
    enabled: !!activeId,
  });

  const messages: AuraMessage[] = (active?.ok ? (active.conversation.messages as unknown as AuraMessage[]) : []) ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || !ws?.id || busy) return;
    setBusy(true);
    setInput("");
    try {
      const res = await send({
        data: {
          workspace_id: ws.id,
          conversation_id: activeId,
          message: msg,
          scope_type: scopeType,
          scope_target_id: null,
          deep,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        setInput(msg);
        return;
      }
      setActiveId(res.conversation_id);
      qc.invalidateQueries({ queryKey: ["aura-conversations", ws.id] });
      qc.invalidateQueries({ queryKey: ["aura-conversation", res.conversation_id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
      setInput(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await del({ data: { id } });
    if (!res.ok) { toast.error(res.error); return; }
    if (activeId === id) setActiveId(null);
    qc.invalidateQueries({ queryKey: ["aura-conversations", ws?.id] });
  }

  async function handlePin(id: string, pinned: boolean) {
    await pin({ data: { id, pinned: !pinned } });
    qc.invalidateQueries({ queryKey: ["aura-conversations", ws?.id] });
  }

  const conversations = convos?.ok ? convos.conversations : [];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 border-r border-border/50 flex flex-col bg-card/30">
        <div className="p-3 border-b border-border/50">
          <Button
            variant="default"
            className="w-full justify-start gap-2 bg-aura-gradient text-primary-foreground"
            onClick={() => { setActiveId(null); setInput(""); }}
          >
            <Plus className="h-4 w-4" /> New conversation
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {conversations.length === 0 ? (
              <p className="px-3 py-6 text-xs text-muted-foreground text-center">No conversations yet.</p>
            ) : conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer text-sm",
                  activeId === c.id ? "bg-aura-gradient-subtle" : "hover:bg-accent/50",
                )}
                onClick={() => setActiveId(c.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{c.scope_type}</div>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); handlePin(c.id, c.pinned); }}
                >
                  {c.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-aura-gradient">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold text-sm">Aura AI</div>
              <div className="text-[11px] text-muted-foreground">Workspace intelligence</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={scopeType} onValueChange={(v) => setScopeType(v as typeof scopeType)}>
              <SelectTrigger className="h-8 w-44 text-xs"><Globe className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace">Entire workspace</SelectItem>
                <SelectItem value="project">Current project (if open)</SelectItem>
                
                <SelectItem value="page">Current page</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Switch id="deep" checked={deep} onCheckedChange={setDeep} />
              <Label htmlFor="deep" className="text-xs cursor-pointer">Deep</Label>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            {messages.length === 0 && !busy && (
              <div className="text-center py-12">
                <div className="mx-auto h-12 w-12 rounded-xl bg-aura-gradient flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-primary-foreground" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Ask anything across your workspace</h2>
                <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                  Aura pulls together tasks, pages, meetings, and notes to answer with citations.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="text-left text-sm rounded-lg border border-border/50 hover:border-primary/50 hover:bg-aura-gradient-subtle transition-colors p-3"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                msg={m}
                conversationId={activeId}
                messageIndex={i}
                onChanged={() => qc.invalidateQueries({ queryKey: ["aura-conversation", activeId] })}
              />
            ))}

            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Aura is thinking…
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/50 p-3">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Aura anything…"
              className="min-h-[44px] max-h-40 resize-none"
              disabled={busy}
            />
            <Button
              onClick={() => handleSend()}
              disabled={busy || !input.trim()}
              className="bg-aura-gradient text-primary-foreground"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  conversationId,
  messageIndex,
  onChanged,
}: {
  msg: AuraMessage;
  conversationId: string | null;
  messageIndex: number;
  onChanged: () => void;
}) {
  const isUser = msg.role === "user";
  const cleaned = msg.content.replace(/\s*\[(?:project|task|meeting|page|note|folder|contact):[0-9a-f-]{8,}\]/gi, "");

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 ring-1",
          isUser
            ? "bg-primary text-primary-foreground ring-primary/30"
            : "bg-aura-gradient text-primary-foreground ring-primary/40 shadow-sm",
        )}
      >
        {isUser ? <MessageSquare className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 max-w-[85%] text-sm shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card border border-border rounded-tl-sm",
        )}
      >
        <ChatMarkdown
          className={cn(isUser && "prose-invert prose-strong:text-primary-foreground prose-a:text-primary-foreground/90")}
        >
          {cleaned}
        </ChatMarkdown>
        {!isUser && msg.citations && msg.citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 not-prose">
            {msg.citations.map((c, i) => {
              const Icon = KIND_ICON[c.kind] ?? FileText;
              const link = KIND_LINK[c.kind]?.(c.id) ?? "#";
              return (
                <Link
                  key={i}
                  to={link}
                  className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background hover:bg-accent px-2 py-0.5 text-xs no-underline"
                >
                  <Icon className="h-3 w-3" />
                  <span className="truncate max-w-[180px]">{c.label}</span>
                </Link>
              );
            })}
          </div>
        )}
        {!isUser && (() => {
          const created = (msg as unknown as { created?: { kind: string; id: string; title: string; path?: string }[] }).created;
          if (!created || created.length === 0) return null;
          return (
            <div className="mt-3 space-y-1.5 not-prose">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Created by Aura
              </div>
              {created.map((c) => {
                const Icon = KIND_ICON[c.kind] ?? FileText;
                const path = c.path ?? KIND_LINK[c.kind]?.(c.id);
                const inner = (
                  <>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-primary">
                      <Icon className="inline h-3 w-3 mr-0.5" />{c.kind}
                    </span>
                    <span className="flex-1 truncate text-foreground">{c.title}</span>
                  </>
                );
                return path ? (
                  <Link
                    key={`${c.kind}-${c.id}`}
                    to={path}
                    className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-accent no-underline"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={`${c.kind}-${c.id}`} className="flex items-center gap-2 rounded-md border bg-background/60 px-2 py-1.5 text-xs opacity-70">
                    {inner}
                  </div>
                );
              })}
            </div>
          );
        })()}
        {!isUser && msg.actions && msg.actions.length > 0 && conversationId && (
          <div className="mt-3 space-y-2 not-prose">
            {msg.actions.map((a) => (
              <ActionCard
                key={a.id}
                action={a}
                conversationId={conversationId}
                messageIndex={messageIndex}
                onChanged={onChanged}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCard({
  action,
  conversationId,
  messageIndex,
  onChanged,
}: {
  action: AuraAction;
  conversationId: string;
  messageIndex: number;
  onChanged: () => void;
}) {
  const run = useServerFn(runAuraAction);
  const dismiss = useServerFn(dismissAuraAction);
  const [busy, setBusy] = useState(false);

  const Icon = action.type === "create_task" ? ListPlus : StickyNote;
  const typeLabel = action.type === "create_task" ? "Create task" : "Create note";

  async function handleRun() {
    setBusy(true);
    try {
      const res = await run({ data: { conversation_id: conversationId, message_index: messageIndex, action_id: action.id } });
      if (!res.ok) toast.error(res.error);
      else if (res.action.error) toast.error(res.action.error);
      else toast.success(`${typeLabel} done`);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss() {
    setBusy(true);
    try {
      await dismiss({ data: { conversation_id: conversationId, message_index: messageIndex, action_id: action.id } });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const done = action.status === "executed";
  const dismissed = action.status === "dismissed";

  return (
    <div className={cn(
      "rounded-md border p-3 text-sm",
      done && !action.error ? "border-emerald-500/30 bg-emerald-500/5" :
      action.error ? "border-destructive/30 bg-destructive/5" :
      dismissed ? "border-border/50 opacity-60" :
      "border-primary/30 bg-aura-gradient-subtle",
    )}>
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium">{typeLabel}: {action.title ?? "(no title)"}</div>
          {action.description && <div className="text-xs text-muted-foreground mt-0.5">{action.description}</div>}
          {action.priority && <Badge variant="outline" className="mt-1 text-[10px]">priority: {action.priority}</Badge>}
          {action.error && (
            <div className="mt-2 text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {action.error}
            </div>
          )}
        </div>
        {action.status === "proposed" && (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={handleDismiss} disabled={busy}>
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={handleRun} disabled={busy} className="bg-aura-gradient text-primary-foreground">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Run</>}
            </Button>
          </div>
        )}
        {done && !action.error && <Badge variant="outline" className="text-[10px] border-emerald-500/40">Done</Badge>}
        {dismissed && <Badge variant="outline" className="text-[10px]">Dismissed</Badge>}
      </div>
    </div>
  );
}
