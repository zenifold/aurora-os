import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, RotateCcw, Check, X, User } from "lucide-react";
import { toast } from "sonner";
import { taskChat, getTaskThread, clearTaskThread } from "@/server/task-chat.functions";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

type ChatMsg = { role: "user" | "assistant" | "system" | "tool"; content: string | null };
type ToolCall = { name: string; result: { ok: boolean; error?: string } };

const QUICK = [
  "Summarize this task",
  "What's blocking this?",
  "Mark in progress and add a checklist",
  "Draft a plan for this work",
];

export function TaskAiPanel({ task }: { task: Task }) {
  const chatFn = useServerFn(taskChat);
  const getThreadFn = useServerFn(getTaskThread);
  const clearFn = useServerFn(clearTaskThread);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastTools, setLastTools] = useState<ToolCall[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const r = await getThreadFn({ data: { task_id: task.id } });
      if (cancel) return;
      if ("thread" in r && r.thread) {
        setThreadId(r.thread.id);
        const msgs = ((r.thread.messages as unknown as ChatMsg[]) ?? []).filter(
          (m) => m.role === "user" || m.role === "assistant",
        );
        setMessages(msgs);
      } else {
        setThreadId(null);
        setMessages([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [task.id, getThreadFn]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setSending(true);
    setMessages((p) => [...p, { role: "user", content: msg }]);
    setInput("");
    setLastTools([]);
    try {
      const r = await chatFn({ data: { task_id: task.id, thread_id: threadId, message: msg } });
      if ("error" in r && r.error) {
        toast.error(r.error);
        setMessages((p) => p.slice(0, -1));
        return;
      }
      if ("reply" in r) {
        setMessages((p) => [...p, { role: "assistant", content: r.reply ?? "" }]);
        if (r.thread_id) setThreadId(r.thread_id);
        const tools = (r.tool_calls as unknown as ToolCall[]) ?? [];
        setLastTools(tools.filter((t) => t.name !== "finish"));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const reset = async () => {
    if (threadId) await clearFn({ data: { thread_id: threadId } });
    setThreadId(null);
    setMessages([]);
    setLastTools([]);
  };

  return (
    <div className="flex h-[600px] flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" /> Task AI
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={reset} title="Reset">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="space-y-3 py-6 text-center text-xs text-muted-foreground">
            <Sparkles className="mx-auto h-6 w-6 text-primary/40" />
            <p>Ask the AI to update this task, draft something, or just answer questions.</p>
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              {QUICK.map((q) => (
                <Button
                  key={q}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => send(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} className={cn("flex gap-2", isUser && "flex-row-reverse")}>
              <div
                className={cn(
                  "h-6 w-6 shrink-0 rounded-full flex items-center justify-center ring-1",
                  isUser
                    ? "bg-primary text-primary-foreground ring-primary/30"
                    : "bg-gradient-to-br from-primary to-primary/60 text-primary-foreground ring-primary/40",
                )}
              >
                {isUser ? <User className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
              </div>
              <div
                className={cn(
                  "rounded-2xl px-3 py-2 max-w-[85%] text-xs shadow-sm",
                  isUser
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border rounded-tl-sm",
                )}
              >
                <ChatMarkdown
                  className={cn(
                    "prose-xs",
                    isUser && "prose-invert prose-strong:text-primary-foreground prose-a:text-primary-foreground/90 prose-code:bg-primary-foreground/10",
                  )}
                >
                  {m.content ?? ""}
                </ChatMarkdown>
              </div>
            </div>
          );
        })}
        {lastTools.length > 0 && (
          <div className="mr-6 space-y-1 rounded-lg border border-border/60 bg-muted/30 p-2 text-[11px]">
            <div className="font-semibold uppercase tracking-wide text-muted-foreground">
              Actions
            </div>
            {lastTools.map((t, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {t.result.ok ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <X className="h-3 w-3 text-destructive" />
                )}
                <span className="font-mono">{t.name}</span>
                {!t.result.ok && t.result.error && (
                  <span className="text-destructive">— {t.result.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
        {sending && (
          <div className="mr-6 flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-border p-2">
        <div className="flex items-end gap-1.5">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask the AI to do something on this task…"
            className="min-h-[60px] resize-none text-xs"
            disabled={sending}
          />
          <Button size="icon" className="h-9 w-9" onClick={() => send()} disabled={sending || !input.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
