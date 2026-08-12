import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useProjects } from "@/hooks/use-projects";
import { useAiAgents } from "@/hooks/use-ai";
import { suggestProjectForCapture, runAgentOnText } from "@/server/extension.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, Check, ExternalLink, Link as LinkIcon, Wand2, Bot, Copy, Camera } from "lucide-react";
import { ContextLens } from "@/components/extension/ContextLens";
import logoUrl from "@/assets/logo.png";

type Mode = "popup" | "sidebar" | "newtab" | "agent" | "screenshot";

export const Route = createFileRoute("/extension-entry")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: (search.mode as Mode) ?? "popup",
    url: typeof search.url === "string" ? search.url : "",
    title: typeof search.title === "string" ? search.title : "",
    text: typeof search.text === "string" ? search.text : "",
    platform: typeof search.platform === "string" ? search.platform : "generic",
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ExtensionEntry,
});

const LAST_PROJECT_KEY = "aura-extension-last-project";

function ExtensionEntry() {
  const { mode, url, title, text, platform, token } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const ws = useWorkspaceStore((s) => s.current);
  const fetchWs = useWorkspaceStore((s) => s.fetch);

  useEffect(() => {
    if (user && !ws) void fetchWs();
  }, [user, ws, fetchWs]);

  if (mode === "newtab") {
    if (typeof window !== "undefined") window.location.replace("/app");
    return null;
  }

  const isSidebar = mode === "sidebar";
  const isAgent = mode === "agent";
  const isScreenshot = mode === "screenshot";
  const headerTitle = isSidebar
    ? "Aurora Context Lens"
    : isAgent
      ? "Send to Aurora Agent"
      : isScreenshot
        ? "Screenshot → Task"
        : "Aurora Quick Capture";

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          {isAgent ? <Bot className="h-4 w-4 text-primary" /> : <img src={logoUrl} alt="Aurora" className="h-4 w-4" />}
          <span className="text-xs font-semibold">{headerTitle}</span>
          {isSidebar && platform !== "generic" && (
            <span className="rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
              {platform}
            </span>
          )}
        </div>
        <a
          href="/app"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Open <ExternalLink className="h-3 w-3" />
        </a>
      </header>

      <div className={`flex-1 overflow-hidden ${isSidebar ? "" : "px-4 py-4 overflow-y-auto"}`}>
        {authLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !user ? (
          <div className="px-4 py-4">
            <SignedOut />
          </div>
        ) : !ws ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isSidebar ? (
          <ContextLens context={{ url, title, text, platform }} />
        ) : isAgent ? (
          <AgentRunner pageTitle={title} url={url} text={text} />
        ) : isScreenshot ? (
          <ScreenshotCapture pageTitle={title} url={url} token={token} />
        ) : (
          <PopupCapture
            initialTitle={text || title}
            initialUrl={url}
            initialText={text}
            initialNote={text && text !== title ? "" : ""}
          />
        )}
      </div>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <img src={logoUrl} alt="Aurora" className="h-8 w-8" />
      <div>
        <h2 className="text-base font-semibold">Sign in to Aurora</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sign in once and the extension stays connected.
        </p>
      </div>
      <a
        href="/login"
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center rounded-md bg-aura-gradient px-4 text-sm font-medium text-primary-foreground"
      >
        Open sign-in
      </a>
      <p className="text-[10px] text-muted-foreground">
        After signing in, click the Aurora icon again.
      </p>
    </div>
  );
}

function SidebarPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <p className="text-sm font-medium">Context Lens</p>
      <p className="text-xs text-muted-foreground">Coming soon — Phase 2.</p>
    </div>
  );
}

function PopupCapture({
  initialTitle,
  initialUrl,
  initialText,
}: {
  initialTitle: string;
  initialUrl: string;
  initialText: string;
  initialNote: string;
}) {
  const { user } = useAuth();
  const ws = useWorkspaceStore((s) => s.current)!;
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const suggest = useServerFn(suggestProjectForCapture);

  const cleanInitialTitle = useMemo(() => initialTitle.trim().slice(0, 200), [initialTitle]);

  const [title, setTitle] = useState(cleanInitialTitle);
  const [note, setNote] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [routing, setRouting] = useState(false);
  const [routedReason, setRoutedReason] = useState<string>("");
  const [done, setDone] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pick last-used project, fallback to "Personal", then first.
  useEffect(() => {
    if (projectId || projects.length === 0) return;
    const last = typeof window !== "undefined" ? localStorage.getItem(LAST_PROJECT_KEY) : null;
    const found =
      (last && projects.find((p) => p.id === last)) ||
      projects.find((p) => p.name.toLowerCase() === "personal") ||
      projects[0];
    if (found) setProjectId(found.id);
  }, [projects, projectId]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  const handleAutoRoute = async () => {
    setRouting(true);
    setRoutedReason("");
    try {
      const res = await suggest({
        data: {
          workspace_id: ws.id,
          title: title || cleanInitialTitle,
          url: initialUrl,
          text: initialText,
        },
      });
      if (res.title) setTitle(res.title);
      if (res.project_id) {
        setProjectId(res.project_id);
        const proj = projects.find((p) => p.id === res.project_id);
        toast.success(`Routed to ${proj?.name ?? "project"}`);
      } else {
        toast.message("No clear match — pick a project");
      }
      setRoutedReason(res.reason ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auto-route failed");
    } finally {
      setRouting(false);
    }
  };

  const canCreate = title.trim().length > 0 && !!projectId && !saving;

  const handleCreate = async () => {
    if (!canCreate) return;
    setSaving(true);
    try {
      const project = projects.find((p) => p.id === projectId)!;
      const { data: existing } = await supabase
        .from("tasks")
        .select("position")
        .eq("project_id", project.id)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos =
        existing && existing.length > 0 ? Number(existing[0].position) + 1000 : 0;

      // Build TipTap doc for description (note + source link).
      const paragraphs: Array<{ type: "paragraph"; content?: Array<Record<string, unknown>> }> = [];
      if (note.trim()) {
        paragraphs.push({
          type: "paragraph",
          content: [{ type: "text", text: note.trim() }],
        });
      }
      if (initialUrl) {
        paragraphs.push({
          type: "paragraph",
          content: [
            { type: "text", text: "Source: " },
            {
              type: "text",
              text: initialUrl,
              marks: [{ type: "link", attrs: { href: initialUrl, target: "_blank" } }],
            },
          ],
        });
      }
      const description =
        paragraphs.length > 0 ? { type: "doc", content: paragraphs } : null;

      const { data: created, error } = await supabase
        .from("tasks")
        .insert({
          workspace_id: ws.id,
          project_id: project.id,
          title: title.trim(),
          description: description as never,
          status: "todo",
          position: nextPos,
          created_by: user!.id,
          task_type: "task",
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      localStorage.setItem(LAST_PROJECT_KEY, project.id);
      qc.invalidateQueries({ queryKey: ["tasks", project.id] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      toast.success("Added to Aurora");
      setDone((created as { id: string }).id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add task");
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-aura-gradient text-primary-foreground">
          <Check className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium">Saved to Aurora</p>
        <div className="flex gap-2">
          <a
            href="/app/my-tasks"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs hover:bg-accent"
          >
            View task
          </a>
          <button
            onClick={() => {
              setDone(null);
              setTitle("");
              setNote("");
              setSaving(false);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="inline-flex h-8 items-center rounded-md bg-aura-gradient px-3 text-xs font-medium text-primary-foreground"
          >
            Add another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="aura-title" className="text-xs">Title</Label>
        <Input
          id="aura-title"
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="h-10"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCreate();
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="aura-note" className="text-xs">Note (optional)</Label>
        <Textarea
          id="aura-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Extra context"
          rows={3}
          className="resize-none text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Project</Label>
          <button
            type="button"
            onClick={handleAutoRoute}
            disabled={routing || projects.length === 0}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline disabled:opacity-50"
          >
            {routing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            Auto-route
          </button>
        </div>
        <Select value={projectId ?? ""} onValueChange={(v) => setProjectId(v || null)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Pick a project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-sm align-middle"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {routedReason && (
          <p className="text-[10px] text-muted-foreground">{routedReason}</p>
        )}
      </div>

      {initialUrl && (
        <div className="flex items-start gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
          <LinkIcon className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="truncate" title={initialUrl}>{initialUrl}</span>
        </div>
      )}

      <Button
        className="h-10 w-full bg-aura-gradient text-primary-foreground hover:opacity-90"
        disabled={!canCreate}
        onClick={handleCreate}
      >
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        Add to Aurora
      </Button>
      <p className="text-center text-[10px] text-muted-foreground">⌘/Ctrl + Enter to submit</p>
    </div>
  );
}

function AgentRunner({
  pageTitle,
  url,
  text,
}: {
  pageTitle: string;
  url: string;
  text: string;
}) {
  const ws = useWorkspaceStore((s) => s.current)!;
  const { data: agents = [] } = useAiAgents();
  const runAgent = useServerFn(runAgentOnText);
  const [agentId, setAgentId] = useState<string>("");
  const [instructions, setInstructions] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string>("");
  const [agentName, setAgentName] = useState<string>("");

  useEffect(() => {
    if (!agentId && agents.length > 0) setAgentId(agents[0].id);
  }, [agents, agentId]);

  const run = async () => {
    if (!agentId || !text.trim()) return;
    setRunning(true);
    setOutput("");
    try {
      const res = await runAgent({
        data: {
          workspace_id: ws.id,
          agent_id: agentId,
          text,
          instructions,
          url,
          page_title: pageTitle,
        },
      });
      setOutput(res.output);
      setAgentName(res.agent_name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Agent failed");
    } finally {
      setRunning(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    toast.success("Copied");
  };

  if (agents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <Bot className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">No agents yet</p>
        <a
          href="/app/agent-runs"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline"
        >
          Create your first agent →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
        <p className="font-medium text-foreground">{pageTitle || "Selection"}</p>
        <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-[10px]">
          {text.slice(0, 400)}
          {text.length > 400 ? "…" : ""}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Agent</Label>
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Pick an agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="mr-1">{a.avatar_emoji ?? "🤖"}</span>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Instructions (optional)</Label>
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g. Summarize in 3 bullets, extract action items…"
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      <Button
        onClick={run}
        disabled={running || !agentId || !text.trim()}
        className="h-10 w-full bg-aura-gradient text-primary-foreground hover:opacity-90"
      >
        {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
        Run agent
      </Button>

      {output && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-muted-foreground">
              {agentName} response
            </span>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-2 text-xs">
            {output}
          </div>
        </div>
      )}
    </div>
  );
}

function ScreenshotCapture({
  pageTitle,
  url,
  token,
}: {
  pageTitle: string;
  url: string;
  token: string;
}) {
  const { user } = useAuth();
  const ws = useWorkspaceStore((s) => s.current)!;
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [title, setTitle] = useState(pageTitle ? `Bug: ${pageTitle.slice(0, 100)}` : "Bug from screenshot");
  const [note, setNote] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (projectId || projects.length === 0) return;
    const last = typeof window !== "undefined" ? localStorage.getItem(LAST_PROJECT_KEY) : null;
    const found =
      (last && projects.find((p) => p.id === last)) ||
      projects.find((p) => p.name.toLowerCase() === "personal") ||
      projects[0];
    if (found) setProjectId(found.id);
  }, [projects, projectId]);

  // Pull dataUrl via window.postMessage bridge to the extension content script.
  useEffect(() => {
    if (!token) return;
    const handler = (e: MessageEvent) => {
      const d = e.data as { source?: string; action?: string; token?: string; dataUrl?: string | null };
      if (!d || d.source !== "aura-ext" || d.action !== "screenshot-result" || d.token !== token) return;
      if (d.dataUrl) setDataUrl(d.dataUrl);
      else toast.error("Screenshot expired — capture again");
    };
    window.addEventListener("message", handler);
    window.postMessage({ source: "aura-page", action: "get-screenshot", token }, "*");
    const t = setTimeout(() => {
      if (!dataUrl) toast.error("Open this from the Aurora extension");
    }, 3000);
    return () => {
      window.removeEventListener("message", handler);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCreate = async () => {
    if (!projectId || !title.trim() || !dataUrl) return;
    setSaving(true);
    try {
      // Convert dataUrl → blob
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `screenshot-${Date.now()}.png`;
      const path = `${ws.id}/_workspace/${crypto.randomUUID()}-${fileName}`;
      const { error: upErr } = await supabase.storage
        .from("project-documents")
        .upload(path, blob, { contentType: "image/png", upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("project-documents")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const imageUrl = signed?.signedUrl ?? "";

      const { data: existing } = await supabase
        .from("tasks")
        .select("position")
        .eq("project_id", projectId)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = existing && existing.length > 0 ? Number(existing[0].position) + 1000 : 0;

      const paragraphs: Array<{ type: string; content?: Array<Record<string, unknown>>; attrs?: Record<string, unknown> }> = [];
      if (note.trim()) {
        paragraphs.push({ type: "paragraph", content: [{ type: "text", text: note.trim() }] });
      }
      if (imageUrl) {
        paragraphs.push({
          type: "image",
          attrs: { src: imageUrl, alt: "Screenshot" },
        });
      }
      if (url) {
        paragraphs.push({
          type: "paragraph",
          content: [
            { type: "text", text: "Source: " },
            { type: "text", text: url, marks: [{ type: "link", attrs: { href: url, target: "_blank" } }] },
          ],
        });
      }
      const description = paragraphs.length > 0 ? { type: "doc", content: paragraphs } : null;

      const { data: created, error } = await supabase
        .from("tasks")
        .insert({
          workspace_id: ws.id,
          project_id: projectId,
          title: title.trim(),
          description: description as never,
          status: "todo",
          position: nextPos,
          created_by: user!.id,
          task_type: "task",
          tags: ["bug", "screenshot"],
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      localStorage.setItem(LAST_PROJECT_KEY, projectId);
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      toast.success("Bug task created");
      setDone((created as { id: string }).id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-aura-gradient text-primary-foreground">
          <Check className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium">Bug task saved</p>
        <a
          href="/app/my-tasks"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs hover:bg-accent"
        >
          View task
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-muted/30 p-1">
        {dataUrl ? (
          <img src={dataUrl} alt="Screenshot" className="max-h-48 w-full rounded object-contain" />
        ) : (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading screenshot…
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ss-title" className="text-xs">Title</Label>
        <Input id="ss-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ss-note" className="text-xs">What went wrong?</Label>
        <Textarea
          id="ss-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Steps to reproduce, expected vs actual…"
          rows={3}
          className="resize-none text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Project</Label>
        <Select value={projectId ?? ""} onValueChange={(v) => setProjectId(v || null)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Pick a project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="mr-2 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: p.color }} />
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        className="h-10 w-full bg-aura-gradient text-primary-foreground hover:opacity-90"
        disabled={!dataUrl || !title.trim() || !projectId || saving}
        onClick={handleCreate}
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
        Save bug task
      </Button>
    </div>
  );
}
