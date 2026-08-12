import { useState, useRef, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useParams, useRouterState, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles, Send, Loader2, ExternalLink, Trash2, MessageSquare, Plus,
  Maximize2, Bot, ListTree, PanelLeftClose, PanelLeftOpen, Copy, RotateCcw,
  Search, X, Settings2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { cn } from "@/lib/utils";
import { askAura } from "@/server/aura-assistant.functions";
import { listAuraConversations, getAuraConversation } from "@/server/aura-chat.functions";
import { listPanelAgents, listPanelAgentExecutions } from "@/lib/agent-panel.functions";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useUIStore } from "@/stores/ui-store";
import { toast } from "sonner";
import { resolveRouteContext } from "@/lib/route-context";


interface Citation {
  kind: "project" | "task" | "meeting";
  id: string;
  label: string;
}

interface CreatedItem {
  kind: string;
  id: string;
  title: string;
  path?: string;
}

interface ClarifyOption {
  label: string;
  description?: string;
}

interface ClarifyQuestion {
  question: string;
  options: ClarifyOption[];
  allow_other?: boolean;
  multi_select?: boolean;
}

interface Clarify {
  preface: string;
  questions: ClarifyQuestion[];
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  created?: CreatedItem[];
  clarify?: Clarify | null;
}

const SUGGESTIONS = [
  "What's blocking my projects this week?",
  "Which tasks are overdue?",
  "Summarise recent meetings",
  "What needs my attention today?",
];

const PAGE_SUGGESTIONS = [
  "Summarise this page",
  "Suggest improvements to this page",
  "Turn the action items on this page into tasks",
  "What's missing from this page?",
];

const SUGGESTIONS_BY_KIND: Record<string, string[]> = {
  project: [
    "What's the current health of this project?",
    "List blockers and overdue tasks",
    "Summarise progress since last week",
    "Draft a status update for stakeholders",
  ],
  project_section: [
    "Summarise what I'm looking at",
    "What needs my attention here?",
    "What changed recently?",
  ],
  page: PAGE_SUGGESTIONS,
  meeting: [
    "Summarise this meeting",
    "Extract action items as tasks",
    "Who owns the follow-ups?",
  ],
  escalation: [
    "What's the status of this escalation?",
    "Suggest a resolution plan",
    "Who needs to be notified?",
  ],
  my_tasks: [
    "What should I focus on today?",
    "What's overdue?",
    "Group my tasks by project",
  ],
  inbox: [
    "Summarise my inbox",
    "What's urgent?",
    "Draft replies to the top items",
  ],
  resources_capacity: [
    "Who is over-allocated this week?",
    "Suggest reassignments to balance load",
    "Forecast capacity gaps for next sprint",
  ],
  resources: [
    "Who has free capacity?",
    "Show under-utilised people",
  ],
  delivery: [
    "What's at risk in delivery?",
    "Summarise delivery health",
  ],
  executive: [
    "Give me an executive summary",
    "Top risks across the portfolio",
  ],
  ops: [
    "What needs operational attention?",
    "Summarise PMO status",
  ],
  crm: [
    "Which deals need follow-up?",
    "Summarise pipeline health",
  ],
  sales: [
    "What deals are closing this month?",
    "Top opportunities by value",
  ],
  notes: ["Summarise my recent notes", "Turn notes into tasks"],
  notifications: ["Summarise my notifications", "What's urgent?"],
  agent_runs: ["Which agent runs failed?", "Summarise agent activity"],
  agents: ["Suggest a new agent for my workflow"],
  folder: ["Summarise this folder", "What's recently active here?"],
};

export function AuraAssistantPanel() {
  const open = useUIStore((s) => s.auraOpen);
  const setOpen = useUIStore((s) => s.setAuraOpen);
  const ws = useWorkspaceStore((s) => s.current);
  const ask = useServerFn(askAura);
  const listConvos = useServerFn(listAuraConversations);
  const getConvo = useServerFn(getAuraConversation);
  const navigate = useNavigate();

  // detect current project from path /app/p/:projectId/...
  const params = useParams({ strict: false }) as { projectId?: string };
  const onProjectPage = !!params.projectId;

  const location = useRouterState({ select: (s) => s.location });
  const routeCtx = resolveRouteContext(
    location.pathname,
    (location.search ?? {}) as Record<string, unknown>,
  );
  const pageId = routeCtx.ids.pageId ?? null;
  const onPageView = !!pageId;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [scopeCurrent, setScopeCurrent] = useState(false);
  const [scopePage, setScopePage] = useState(true);
  const [scopeRoute, setScopeRoute] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [loadingConvo, setLoadingConvo] = useState(false);
  const [tab, setTab] = useState<"chat" | "agents" | "runs">("chat");
  const [railOpen, setRailOpen] = useState(true);
  const [railQuery, setRailQuery] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const listAgentsFn = useServerFn(listPanelAgents);
  const listExecsFn = useServerFn(listPanelAgentExecutions);
  const { data: agentsData } = useQuery({
    queryKey: ["aura-panel-agents", ws?.id],
    queryFn: () => listAgentsFn({ data: { workspace_id: ws!.id } }),
    enabled: !!ws?.id && open && tab === "agents",
  });
  const { data: execsData } = useQuery({
    queryKey: ["aura-panel-execs", ws?.id],
    queryFn: () => listExecsFn({ data: { workspace_id: ws!.id, limit: 15 } }),
    enabled: !!ws?.id && open && tab === "runs",
  });


  const { data: convosData, refetch: refetchConvos } = useQuery({
    queryKey: ["aura-convos-panel", ws?.id],
    queryFn: () => listConvos({ data: { workspace_id: ws!.id } }),
    enabled: !!ws?.id && open,
  });
  const recentConvos = convosData?.ok ? convosData.conversations : [];
  const filteredConvos = useMemo(() => {
    const q = railQuery.trim().toLowerCase();
    if (!q) return recentConvos;
    return recentConvos.filter((c) => c.title?.toLowerCase().includes(q));
  }, [recentConvos, railQuery]);
  const copyMessage = async (idx: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1200);
    } catch { /* noop */ }
  };
  const regenerate = () => {
    // resend last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        const q = messages[i].content;
        setMessages((prev) => prev.slice(0, i));
        void send(q);
        return;
      }
    }
  };
  const activeScopes = [
    onProjectPage && scopeCurrent && "Project",
    onPageView && scopePage && "Page",
    !onPageView && scopeRoute && routeCtx.kind !== "home" && routeCtx.kind !== "other" && routeCtx.label,
  ].filter(Boolean) as string[];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  // Refresh history list each time the panel opens so cross-device chats show up.
  useEffect(() => {
    if (open && ws?.id) void refetchConvos();
  }, [open, ws?.id, refetchConvos]);

  const loadConversation = async (id: string) => {
    setLoadingConvo(true);
    try {
      const res = await getConvo({ data: { id } });
      if (!res.ok) { toast.error(res.error); return; }
      const rawMsgs = (res.conversation.messages as unknown as Array<{
        role: "user" | "assistant";
        content: string;
        citations?: Citation[];
        created?: CreatedItem[];
        actions?: unknown;
      }>) ?? [];
      setMessages(rawMsgs.map((m) => ({
        role: m.role,
        content: m.content,
        citations: m.citations,
        created: m.created,
        clarify: null,
      })));
      setConversationId(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load conversation");
    } finally {
      setLoadingConvo(false);
    }
  };

  const startNew = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
  };

  useEffect(() => {
    if (!onProjectPage) setScopeCurrent(false);
  }, [onProjectPage]);

  useEffect(() => {
    setScopePage(true);
  }, [pageId]);

  useEffect(() => {
    setScopeRoute(true);
  }, [location.pathname]);

  const dynamicSuggestions =
    (onPageView && scopePage && PAGE_SUGGESTIONS) ||
    (scopeRoute && SUGGESTIONS_BY_KIND[routeCtx.kind]) ||
    SUGGESTIONS;

  const send = async (q?: string) => {
    const question = (q ?? input).trim();
    if (!question || !ws || busy) return;
    setInput("");
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setBusy(true);
    try {
      const res = await ask({
        data: {
          workspace_id: ws.id,
          question,
          scope_project_id: scopeCurrent && params.projectId ? params.projectId : null,
          scope_page_id: scopePage && pageId ? pageId : null,
          route_context: scopeRoute
            ? {
                pathname: location.pathname,
                kind: routeCtx.kind,
                section: routeCtx.section,
                label: routeCtx.label,
                ids: routeCtx.ids,
              }
            : null,
          conversation_id: conversationId,
          history,
        },
      });
      if (res.ok) {
        if ("conversation_id" in res && res.conversation_id) setConversationId(res.conversation_id);
        void refetchConvos();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.answer,
            citations: res.citations,
            created: res.created,
            clarify: (res as { clarify?: Clarify | null }).clarify ?? null,
          },
        ]);
        if (res.created && res.created.length > 0) {
          toast.success(`Created ${res.created.length} item${res.created.length > 1 ? "s" : ""}`);
        }
      } else {
        toast.error(res.error);
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${res.error}` }]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const openCitation = (c: Citation) => {
    setOpen(false);
    if (c.kind === "project") navigate({ to: "/app/p/$projectId", params: { projectId: c.id } });
    else if (c.kind === "meeting") navigate({ to: "/app/meetings/$meetingId", params: { meetingId: c.id } });
    else if (c.kind === "task") {
      // open task panel via query param on current page
      const url = new URL(window.location.href);
      url.searchParams.set("task", c.id);
      window.history.pushState({}, "", url.toString());
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden border-l bg-background p-0 sm:max-w-2xl md:max-w-3xl"
      >
        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center gap-1 border-b bg-card/60 px-2 backdrop-blur">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setRailOpen((v) => !v)}
            title={railOpen ? "Hide history" : "Show history"}
          >
            {railOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-2 px-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Aura</span>
            <Badge variant="outline" className="hidden h-5 px-1.5 text-[10px] font-normal sm:inline-flex">
              workspace-grounded
            </Badge>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {activeScopes.length > 0 && (
              <div className="hidden items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground sm:flex">
                <span className="font-medium text-foreground">Context:</span>
                <span className="max-w-[160px] truncate">{activeScopes.join(" · ")}</span>
              </div>
            )}
            <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Context settings">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-3">
                <div className="mb-2 text-xs font-semibold">Context</div>
                <div className="space-y-2">
                  {onProjectPage && (
                    <div className="flex items-center justify-between">
                      <Label htmlFor="scope" className="text-xs">Scope to current project</Label>
                      <Switch id="scope" checked={scopeCurrent} onCheckedChange={setScopeCurrent} />
                    </div>
                  )}
                  {onPageView && (
                    <div className="flex items-center justify-between">
                      <Label htmlFor="scope-page" className="text-xs">Use this page</Label>
                      <Switch id="scope-page" checked={scopePage} onCheckedChange={setScopePage} />
                    </div>
                  )}
                  {!onPageView && routeCtx.kind !== "home" && routeCtx.kind !== "other" && (
                    <div className="flex items-center justify-between">
                      <Label htmlFor="scope-route" className="text-xs">Use current view ({routeCtx.label})</Label>
                      <Switch id="scope-route" checked={scopeRoute} onCheckedChange={setScopeRoute} />
                    </div>
                  )}
                  {!onProjectPage && !onPageView && (routeCtx.kind === "home" || routeCtx.kind === "other") && (
                    <p className="text-[11px] text-muted-foreground">No page-specific context here. Aura searches the whole workspace.</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => { setOpen(false); navigate({ to: "/app/aura" }); }}
              title="Open full page"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)} title="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* History rail */}
          {railOpen && (
            <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/20 md:flex">
              <div className="flex items-center gap-1 p-2">
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 flex-1 justify-start gap-1.5"
                  onClick={startNew}
                >
                  <Plus className="h-3.5 w-3.5" /> New chat
                </Button>
              </div>
              <div className="px-2 pb-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={railQuery}
                    onChange={(e) => setRailQuery(e.target.value)}
                    placeholder="Search chats…"
                    className="h-8 w-full rounded-md border bg-background pl-7 pr-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1 px-1">
                <div className="px-1 pb-2 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Recent
                </div>
                {filteredConvos.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                    {railQuery ? "No matches." : "No previous chats."}
                  </p>
                ) : (
                  <div className="space-y-0.5 px-1 pb-3">
                    {filteredConvos.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => void loadConversation(c.id)}
                        className={cn(
                          "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-accent",
                          conversationId === c.id && "bg-accent",
                        )}
                      >
                        <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{c.title || "Untitled"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <div className="border-t p-2">
                <Link
                  to="/app/aura"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  View all chats <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </aside>
          )}

          {/* Main column */}
          <div className="flex min-h-0 flex-1 flex-col">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex min-h-0 flex-1 flex-col">
              <div className="border-b bg-background/50 px-3 pt-2">
                <TabsList className="h-8 bg-muted/40 p-0.5">
                  <TabsTrigger value="chat" className="h-7 px-3 text-xs"><MessageSquare className="mr-1 h-3 w-3" />Chat</TabsTrigger>
                  <TabsTrigger value="agents" className="h-7 px-3 text-xs"><Bot className="mr-1 h-3 w-3" />Agents</TabsTrigger>
                  <TabsTrigger value="runs" className="h-7 px-3 text-xs"><ListTree className="mr-1 h-3 w-3" />Runs</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chat" className="m-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
                <div ref={scrollRef} className="flex-1 overflow-y-auto">
                  <div className="mx-auto max-w-2xl px-4 py-6">
                    {loadingConvo ? (
                      <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading conversation…
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="space-y-6">
                        <div className="space-y-2 text-center">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                            <Sparkles className="h-5 w-5 text-primary" />
                          </div>
                          <h2 className="text-lg font-semibold tracking-tight">How can I help?</h2>
                          <p className="text-xs text-muted-foreground">
                            {onPageView && scopePage
                              ? "Aura can read this page. Ask anything about it."
                              : scopeRoute && SUGGESTIONS_BY_KIND[routeCtx.kind]
                              ? `Grounded in ${routeCtx.label}. Tailored answers across your workspace.`
                              : "Grounded in your projects, tasks, meetings, notes and pages."}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {dynamicSuggestions.map((s) => (
                            <button
                              key={s}
                              onClick={() => void send(s)}
                              className="group rounded-xl border bg-card px-3 py-3 text-left text-xs text-foreground transition hover:border-primary/40 hover:bg-accent"
                            >
                              <span className="line-clamp-2">{s}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {messages.map((m, i) => {
                          const isUser = m.role === "user";
                          return (
                            <div key={i} className={cn("group flex gap-3", isUser && "flex-row-reverse")}>
                              <div
                                className={cn(
                                  "h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold",
                                  isUser
                                    ? "bg-muted text-foreground"
                                    : "bg-gradient-to-br from-primary to-primary/60 text-primary-foreground",
                                )}
                              >
                                {isUser ? "You" : <Sparkles className="h-3.5 w-3.5" />}
                              </div>
                              <div className={cn("flex min-w-0 max-w-[88%] flex-col", isUser && "items-end")}>
                                <div
                                  className={cn(
                                    "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                                    isUser
                                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                                      : "bg-card border border-border rounded-tl-sm",
                                  )}
                                >
                                  <AssistantText
                                    text={m.content}
                                    citations={m.citations ?? []}
                                    onCite={openCitation}
                                    invert={isUser}
                                  />
                                  {m.citations && m.citations.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {m.citations.map((c) => (
                                        <button
                                          key={`${c.kind}-${c.id}`}
                                          onClick={() => openCitation(c)}
                                          className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[10px] text-foreground hover:bg-accent"
                                        >
                                          <ExternalLink className="h-2.5 w-2.5" />
                                          {c.label.slice(0, 40)}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {m.created && m.created.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      <div className={cn(
                                        "text-[10px] font-semibold uppercase tracking-wider",
                                        isUser ? "text-primary-foreground/70" : "text-muted-foreground",
                                      )}>
                                        Created
                                      </div>
                                      {m.created.map((c) => (
                                        <button
                                          key={`${c.kind}-${c.id}`}
                                          onClick={() => {
                                            if (c.path) {
                                              setOpen(false);
                                              navigate({ to: c.path });
                                            }
                                          }}
                                          disabled={!c.path}
                                          className="flex w-full items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent disabled:opacity-60"
                                        >
                                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-primary">
                                            {c.kind}
                                          </span>
                                          <span className="flex-1 truncate">{c.title}</span>
                                          {c.path && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {m.clarify && i === messages.length - 1 && !busy && (
                                    <ClarifyForm clarify={m.clarify} onSubmit={(reply) => void send(reply)} />
                                  )}
                                </div>
                                {/* Message action row */}
                                <div className={cn(
                                  "mt-1 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100",
                                  isUser && "flex-row-reverse",
                                )}>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    title="Copy"
                                    onClick={() => void copyMessage(i, m.content)}
                                  >
                                    {copiedIdx === i
                                      ? <span className="text-[10px]">✓</span>
                                      : <Copy className="h-3 w-3" />}
                                  </Button>
                                  {!isUser && i === messages.length - 1 && !busy && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                      title="Regenerate"
                                      onClick={regenerate}
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {busy && (
                          <div className="flex items-center gap-2 pl-10 text-xs text-muted-foreground">
                            <span className="inline-flex gap-0.5">
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                            </span>
                            Thinking…
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Composer */}
                <div className="border-t bg-background/80 px-3 py-3 backdrop-blur">
                  <div className="mx-auto max-w-2xl">
                    {activeScopes.length > 0 && (
                      <div className="mb-1.5 flex flex-wrap items-center gap-1">
                        {activeScopes.map((s) => (
                          <span key={s} className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                            <span className="h-1 w-1 rounded-full bg-primary" />
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="relative rounded-2xl border bg-card shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                          }
                        }}
                        placeholder={onPageView && scopePage ? "Ask about this page…" : "Ask Aura anything…"}
                        rows={2}
                        className="min-h-[56px] resize-none border-0 bg-transparent px-3.5 pb-10 pt-2.5 text-sm shadow-none focus-visible:ring-0"
                        disabled={busy}
                      />
                      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {messages.length > 0 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => { setMessages([]); setConversationId(null); }}
                              title="Clear chat"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <span className="hidden text-[10px] text-muted-foreground sm:inline">
                            ↵ to send · ⇧↵ for new line
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => void send()}
                          disabled={busy || !input.trim()}
                          className="h-7 gap-1 rounded-lg px-2.5"
                        >
                          {busy
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Send className="h-3.5 w-3.5" />}
                          <span className="text-xs">Send</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="agents" className="m-0 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3 data-[state=inactive]:hidden">
                <p className="mb-2 text-xs text-muted-foreground">
                  Pick an agent persona. Each one has its own tools, autonomy, and memory.
                </p>
                <div className="space-y-1.5">
                  {(agentsData?.ok ? agentsData.agents : []).map((a) => (
                    <Link
                      key={a.id}
                      to="/app/agents"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-md border bg-card/50 px-2.5 py-2 text-sm transition hover:bg-accent"
                    >
                      <span className="text-lg">{a.avatar_emoji ?? "🤖"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{a.name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">@{a.handle}</div>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  ))}
                  {agentsData?.ok && agentsData.agents.length === 0 && (
                    <div className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                      No agents yet.
                    </div>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    to="/app/agents"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-md border bg-card px-3 py-2 text-center text-xs font-medium hover:bg-accent"
                  >
                    Manage agents →
                  </Link>
                </div>
              </TabsContent>

              <TabsContent value="runs" className="m-0 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3 data-[state=inactive]:hidden">
                <p className="mb-2 text-xs text-muted-foreground">Recent agent activity in this workspace.</p>
                <div className="space-y-1.5">
                  {(execsData?.ok ? execsData.executions : []).map((e) => (
                    <Link
                      key={e.id}
                      to="/app/runs/$runId"
                      params={{ runId: e.id }}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-md border bg-card/50 px-2.5 py-1.5 text-xs transition hover:bg-accent"
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          e.status === "succeeded" && "bg-emerald-500",
                          e.status === "failed" && "bg-destructive",
                          e.status === "running" && "bg-amber-500",
                          e.status === "pending" && "bg-muted-foreground",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{e.goal ?? e.status}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {e.started_at ? new Date(e.started_at).toLocaleString() : "—"}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {execsData?.ok && execsData.executions.length === 0 && (
                    <div className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                      No runs yet.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AssistantText({
  text,
  citations,
  onCite,
  invert,
}: {
  text: string;
  citations: Citation[];
  onCite: (c: Citation) => void;
  invert?: boolean;
}) {
  // Replace [kind:id] tokens with markdown links so they render inline.
  const rendered = text.replace(
    /\[(project|task|meeting):([0-9a-f-]{8,})\]/gi,
    (match, kind: string, id: string) => {
      const c = citations.find((x) => x.id === id && x.kind.toLowerCase() === kind.toLowerCase());
      return c ? `**${c.label.slice(0, 32)}**` : match;
    },
  );
  void onCite;
  return (
    <ChatMarkdown
      className={cn(invert && "prose-invert prose-strong:text-primary-foreground prose-a:text-primary-foreground/90 prose-code:bg-primary-foreground/10")}
    >
      {rendered}
    </ChatMarkdown>
  );
}

function ClarifyForm({
  clarify,
  onSubmit,
}: {
  clarify: Clarify;
  onSubmit: (reply: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [other, setOther] = useState<Record<number, string>>({});

  const toggle = (qi: number, value: string, multi: boolean) => {
    setAnswers((prev) => {
      const current = prev[qi] ?? [];
      if (multi) {
        return {
          ...prev,
          [qi]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
        };
      }
      return { ...prev, [qi]: [value] };
    });
  };

  const ready = clarify.questions.every((q, qi) => {
    const picked = answers[qi] ?? [];
    const hasOther = (other[qi] ?? "").trim().length > 0;
    return picked.length > 0 || hasOther;
  });

  const submit = () => {
    const lines = clarify.questions.map((q, qi) => {
      const picked = answers[qi] ?? [];
      const otherVal = (other[qi] ?? "").trim();
      const all = [...picked, ...(otherVal ? [otherVal] : [])];
      return `Q: ${q.question}\nA: ${all.join(", ") || "(no preference)"}`;
    });
    onSubmit(lines.join("\n\n"));
  };

  return (
    <div className="mt-3 space-y-3 rounded-md border bg-background/60 p-3">
      {clarify.questions.map((q, qi) => {
        const multi = !!q.multi_select;
        const picked = answers[qi] ?? [];
        return (
          <div key={qi} className="space-y-1.5">
            <div className="text-xs font-medium">{q.question}</div>
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((o) => {
                const selected = picked.includes(o.label);
                return (
                  <button
                    key={o.label}
                    onClick={() => toggle(qi, o.label, multi)}
                    title={o.description}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            {q.allow_other !== false && (
              <input
                value={other[qi] ?? ""}
                onChange={(e) => setOther((p) => ({ ...p, [qi]: e.target.value }))}
                placeholder="Other (type your own)…"
                className="w-full rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            )}
          </div>
        );
      })}
      <div className="flex justify-end pt-1">
        <Button size="sm" disabled={!ready} onClick={submit}>
          Continue
        </Button>
      </div>
    </div>
  );
}

export function AuraLauncher() {
  const setOpen = useUIStore((s) => s.setAuraOpen);
  return (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 lg:bottom-4"
      aria-label="Open Aura assistant"
    >
      <Sparkles className="h-5 w-5" />
    </button>
  );
}
