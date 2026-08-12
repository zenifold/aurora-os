import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  Send,
  Loader2,
  RotateCcw,
  Wand2,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  docChat,
  getDocThread,
  clearDocThread,
  transformDoc,
  saveDocVersion,
} from "@/server/page-doc-ai.functions";
import type { Page } from "@/lib/page-types";

type ChatMsg = { role: "user" | "assistant"; content: string; created_at?: string };

interface Props {
  page: Page;
  onClose: () => void;
  onApplyContent: (next: { title?: string; content: unknown }) => void;
  onVersionsChanged: () => void;
}

const QUICK_TRANSFORMS: { label: string; action: "rewrite" | "expand" | "condense" | "tone_shift" | "restructure" | "add_section" | "toc" }[] = [
  { label: "Rewrite", action: "rewrite" },
  { label: "Expand", action: "expand" },
  { label: "Condense", action: "condense" },
  { label: "Polish tone", action: "tone_shift" },
  { label: "Restructure", action: "restructure" },
  { label: "Add section", action: "add_section" },
  { label: "Generate TOC", action: "toc" },
];

export function PageAiPanel({ page, onClose, onApplyContent, onVersionsChanged }: Props) {
  const chatFn = useServerFn(docChat);
  const getThreadFn = useServerFn(getDocThread);
  const clearThreadFn = useServerFn(clearDocThread);
  const transformFn = useServerFn(transformDoc);
  const saveVersionFn = useServerFn(saveDocVersion);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [working, setWorking] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{
    proposed_title: string;
    proposed_content: unknown;
    summary: string;
    action: string;
    prompt: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const r = await getThreadFn({ data: { page_id: page.id } });
      if (cancel) return;
      if ("thread" in r && r.thread) {
        setThreadId(r.thread.id);
        setMessages(((r.thread.messages as ChatMsg[]) ?? []).filter((m) => m.role === "user" || m.role === "assistant"));
      } else {
        setThreadId(null);
        setMessages([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [page.id, getThreadFn]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, working]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    try {
      const r = await chatFn({ data: { page_id: page.id, thread_id: threadId, message: msg } });
      if ("error" in r && r.error) {
        toast.error(r.error);
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      if ("reply" in r) {
        setMessages((prev) => [...prev, { role: "assistant", content: r.reply }]);
        if (r.thread_id) setThreadId(r.thread_id);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const runTransform = async (
    action: "rewrite" | "expand" | "condense" | "tone_shift" | "restructure" | "add_section" | "toc" | "custom",
    customPrompt?: string,
  ) => {
    setWorking(action);
    setProposal(null);
    try {
      const r = await transformFn({
        data: { page_id: page.id, action, custom_prompt: customPrompt },
      });
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      if ("proposed_content" in r && r.proposed_content) {
        setProposal({
          proposed_title: r.proposed_title ?? page.title,
          proposed_content: r.proposed_content,
          summary: r.summary ?? "",
          action: r.action ?? action,
          prompt: r.prompt ?? "",
        });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWorking(null);
    }
  };

  const acceptProposal = async () => {
    if (!proposal) return;
    try {
      const r = await saveVersionFn({
        data: {
          page_id: page.id,
          title: proposal.proposed_title,
          content: proposal.proposed_content,
          generated_by_ai: true,
          ai_prompt: proposal.prompt,
          ai_model: "google/gemini-2.5-pro",
          changes_summary: proposal.summary,
          version_label: `AI: ${proposal.action}`,
          replace_current: true,
        },
      });
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      onApplyContent({ title: proposal.proposed_title, content: proposal.proposed_content });
      onVersionsChanged();
      setProposal(null);
      toast.success("Saved as new version");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const resetChat = async () => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    await clearThreadFn({ data: { thread_id: threadId } });
    setThreadId(null);
    setMessages([]);
    toast.success("Chat reset");
  };

  return (
    <div className="flex h-full w-full flex-col border-l border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Document AI
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Reset chat" onClick={resetChat}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick transforms */}
      <div className="border-b border-border px-3 py-2">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Transform document
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TRANSFORMS.map((q) => (
            <Button
              key={q.action}
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              disabled={working !== null}
              onClick={() => runTransform(q.action)}
            >
              {working === q.action ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3" />
              )}
              {q.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Pending proposal */}
      {proposal && (
        <div className="border-b border-border bg-primary/5 px-3 py-2.5">
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
              <Sparkles className="h-3 w-3" /> Proposed: {proposal.action}
            </Badge>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">{proposal.summary}</p>
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7 gap-1" onClick={acceptProposal}>
              <Check className="h-3.5 w-3.5" /> Accept &amp; save version
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setProposal(null)}>
              Discard
            </Button>
          </div>
        </div>
      )}

      <Separator />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-2">
        {messages.length === 0 && !working && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Sparkles className="h-6 w-6 text-primary/40" />
            <p>Ask anything about this document.</p>
            <p className="text-[11px]">"Summarize the key points", "What's missing?", "Make this more persuasive"</p>
          </div>
        )}
        <div className="space-y-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-6 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs"
                  : "mr-6 rounded-lg bg-muted px-2.5 py-1.5 text-xs"
              }
            >
              <div className="mb-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {m.role === "user" ? "You" : "AI"}
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
            </div>
          ))}
          {sending && (
            <div className="mr-6 flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
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
            placeholder="Ask the AI…"
            className="min-h-[60px] resize-none text-xs"
            disabled={sending}
          />
          <Button size="icon" className="h-9 w-9" onClick={send} disabled={sending || !input.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
