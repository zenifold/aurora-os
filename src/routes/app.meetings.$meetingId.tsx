import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  useMeeting,
  useMeetingActionItems,
  useUpdateMeeting,
  useUpdateActionItem,
} from "@/hooks/use-meetings";
import { useProjects } from "@/hooks/use-projects";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { analyzeMeetingTranscript } from "@/server/meeting-analysis.functions";
import { useAiAgents } from "@/hooks/use-ai";
import { ParticipantsPanel } from "@/components/meetings/ParticipantsPanel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
  ListChecks,
  FileText,
  Tags,
  Plus,
  X,
  Bot,
  Users,
  Wand2,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/app/meetings/$meetingId")({
  component: MeetingDetailPage,
});

function MeetingDetailPage() {
  const { meetingId } = Route.useParams();
  const { data: meeting, isLoading } = useMeeting(meetingId);
  const { data: actionItems = [] } = useMeetingActionItems(meetingId);
  const updateMeeting = useUpdateMeeting();
  const analyze = useServerFn(analyzeMeetingTranscript);
  const [transcriptDraft, setTranscriptDraft] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!meeting) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Meeting not found</p>
        <Link to="/app/meetings"><Button variant="outline">Back to meetings</Button></Link>
      </div>
    );
  }

  const transcript = transcriptDraft ?? meeting.transcript_raw_text ?? "";
  const titleValue = titleDraft ?? meeting.title;
  const dirty =
    (transcriptDraft !== null && transcriptDraft !== (meeting.transcript_raw_text ?? "")) ||
    (titleDraft !== null && titleDraft !== meeting.title);

  const saveDraft = async () => {
    const patch: Record<string, unknown> = {};
    if (transcriptDraft !== null) patch.transcript_raw_text = transcriptDraft;
    if (titleDraft !== null) patch.title = titleDraft;
    await updateMeeting.mutateAsync({ id: meeting.id, patch: patch as never });
    setTranscriptDraft(null);
    setTitleDraft(null);
    toast.success("Saved");
  };

  const runAnalysis = async () => {
    if (dirty) await saveDraft();
    if (!transcript.trim() || transcript.trim().length < 20) {
      toast.error("Add a transcript first (at least 20 characters)");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await analyze({ data: { meeting_id: meeting.id } });
      if (res.ok) toast.success(`Extracted ${res.action_items_count} action items`);
      else toast.error(res.error ?? "Analysis failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex h-full min-h-screen flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <Link to="/app/meetings">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Input
            value={titleValue}
            onChange={(e) => setTitleDraft(e.target.value)}
            className="h-9 min-w-0 flex-1 border-none bg-transparent text-sm font-semibold focus-visible:ring-1 sm:max-w-md sm:text-base"
          />
          <StatusPill status={meeting.ai_status} error={meeting.ai_error} />
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ProjectLinkSelect
            meetingId={meeting.id}
            value={meeting.project_id}
          />
          {dirty && (
            <Button variant="ghost" size="sm" onClick={saveDraft}>
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save
            </Button>
          )}
          <Button
            onClick={runAnalysis}
            disabled={analyzing || !transcript.trim()}
            className="bg-aura-gradient text-primary-foreground"
            size="sm"
          >
            {analyzing ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Analyzing…</>
            ) : (
              <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> {meeting.ai_status === "completed" ? "Re-analyze" : "Analyze"}</>
            )}
          </Button>
        </div>
      </div>

      {/* Split pane */}
      <div className="grid flex-1 grid-cols-1 gap-0 lg:grid-cols-[3fr_2fr]">
        {/* Transcript */}
        <div className="border-b p-3 sm:p-4 lg:border-b-0 lg:border-r lg:p-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
              Transcript
            </h2>
            <span className="text-xs text-muted-foreground">
              {transcript.length.toLocaleString()} chars
            </span>
          </div>
          <Textarea
            value={transcript}
            onChange={(e) => setTranscriptDraft(e.target.value)}
            placeholder={`Paste your meeting transcript here.\n\nFormat tip: prefix lines with the speaker name like\n\nSarah: I think we should prioritize the mobile redesign.\nAlex: Agreed, but we need to finish the API refactor first.`}
            className="min-h-[40vh] resize-none font-mono text-sm leading-relaxed lg:min-h-[60vh]"
          />
        </div>

        {/* Sidebar */}
        <div className="p-3 sm:p-4 lg:p-6">
          <Tabs defaultValue="summary">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="summary"><FileText className="mr-1.5 h-3.5 w-3.5" />Summary</TabsTrigger>
              <TabsTrigger value="actions">
                <ListChecks className="mr-1.5 h-3.5 w-3.5" />
                Actions {actionItems.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{actionItems.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="topics"><Tags className="mr-1.5 h-3.5 w-3.5" />Topics</TabsTrigger>
              <TabsTrigger value="people"><Users className="mr-1.5 h-3.5 w-3.5" />People</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-4 space-y-4">
              <SummaryView meeting={meeting} />
            </TabsContent>

            <TabsContent value="actions" className="mt-4">
              <ActionItemsView items={actionItems} meetingId={meeting.id} projectId={meeting.project_id} />
            </TabsContent>

            <TabsContent value="topics" className="mt-4 space-y-2">
              {meeting.topics && meeting.topics.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {meeting.topics.map((t, i) => (
                    <Badge key={i} variant="outline">
                      {t.name}
                      {t.sentiment && <span className="ml-1.5 text-[10px] text-muted-foreground">{t.sentiment}</span>}
                    </Badge>
                  ))}
                </div>
              ) : (
                <EmptyHint text="Run analysis to extract topics." />
              )}
            </TabsContent>

            <TabsContent value="people" className="mt-4">
              <ParticipantsPanel meetingId={meeting.id} />
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-xs text-muted-foreground">
            Created {formatDistanceToNow(new Date(meeting.created_at), { addSuffix: true })}
            {meeting.ai_model && <> · Model: {meeting.ai_model}</>}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status, error }: { status: string; error: string | null }) {
  if (status === "completed")
    return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Analyzed</Badge>;
  if (status === "processing")
    return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>;
  if (status === "failed")
    return (
      <Badge variant="destructive" className="gap-1" title={error ?? undefined}>
        <AlertCircle className="h-3 w-3" /> Failed
      </Badge>
    );
  return <Badge variant="outline">Pending</Badge>;
}

function EmptyHint({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">{text}</p>;
}

function SummaryView({ meeting }: { meeting: NonNullable<ReturnType<typeof useMeeting>["data"]> }) {
  const s = meeting.summary;
  if (!s) return <EmptyHint text="Run analysis to generate a summary." />;
  return (
    <div className="space-y-4 text-sm">
      {s.overview && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overview</h3>
          <p className="leading-relaxed">{s.overview}</p>
        </div>
      )}
      {s.key_points && s.key_points.length > 0 && (
        <Section title="Key points" items={s.key_points} />
      )}
      {s.decisions && s.decisions.length > 0 && (
        <Section title="Decisions" items={s.decisions} />
      )}
      {s.risks && s.risks.length > 0 && (
        <Section title="Risks" items={s.risks} accent="text-amber-600 dark:text-amber-400" />
      )}
      {s.questions_unanswered && s.questions_unanswered.length > 0 && (
        <Section title="Open questions" items={s.questions_unanswered} />
      )}
      {s.sentiment && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sentiment</h3>
          <Badge variant="outline">{s.sentiment}</Badge>
        </div>
      )}
    </div>
  );
}

function Section({ title, items, accent }: { title: string; items: string[]; accent?: string }) {
  return (
    <div>
      <h3 className={`mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${accent ?? ""}`}>{title}</h3>
      <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed">
        {items.map((p, i) => (<li key={i}>{p}</li>))}
      </ul>
    </div>
  );
}

function ActionItemsView({
  items,
  meetingId,
  projectId,
}: {
  items: ReturnType<typeof useMeetingActionItems>["data"] extends infer T ? (T extends Array<infer U> ? U[] : never) : never;
  meetingId: string;
  projectId: string | null;
}) {
  const update = useUpdateActionItem();
  const { data: agents = [] } = useAiAgents();
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  if (!items || items.length === 0) {
    return <EmptyHint text="Run analysis to extract action items from the transcript." />;
  }

  const pending = items.filter(
    (i) => i.status !== "converted" && i.status !== "dismissed" && i.status !== "completed",
  );

  const assignToAgent = async (item: { id: string; summary: string | null; original_text: string; context_quote: string | null; priority_guess: string | null; due_guess: string | null }, agentId: string) => {
    if (!ws || !user || !projectId) {
      toast.error(projectId ? "Sign in again" : "Link this meeting to a project first");
      return;
    }
    try {
      const { data: existing } = await supabase
        .from("tasks")
        .select("position")
        .eq("project_id", projectId)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = existing && existing.length > 0 ? Number(existing[0].position) + 1000 : 0;

      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          workspace_id: ws.id,
          project_id: projectId,
          title: item.summary ?? item.original_text,
          status: "todo",
          priority: (item.priority_guess as "low" | "medium" | "high" | "urgent" | null) ?? "medium",
          due_date: item.due_guess,
          position: nextPos,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      const { error: aErr } = await supabase.from("ai_task_assignments").insert({
        workspace_id: ws.id,
        task_id: task.id,
        agent_id: agentId,
        status: "queued",
        instructions: `From meeting action item: ${item.summary ?? item.original_text}${item.context_quote ? `\n\nContext: "${item.context_quote}"` : ""}`,
        created_by: user.id,
      });
      if (aErr) throw aErr;

      await update.mutateAsync({
        id: item.id,
        meeting_id: meetingId,
        patch: { status: "converted", converted_task_id: task.id, assigned_agent_id: agentId } as never,
      });
      toast.success("Routed to AI agent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign");
    }
  };

  const convertAllToTasks = async () => {
    if (!projectId) {
      toast.error("Link this meeting to a project first");
      return;
    }
    if (!ws || !user) return;
    setBulkBusy(true);
    try {
      let created = 0;
      for (const item of pending) {
        const { data: existing } = await supabase
          .from("tasks")
          .select("position")
          .eq("project_id", projectId)
          .order("position", { ascending: false })
          .limit(1);
        const nextPos = existing && existing.length > 0 ? Number(existing[0].position) + 1000 : 0;
        const { data: task, error } = await supabase
          .from("tasks")
          .insert({
            workspace_id: ws.id,
            project_id: projectId,
            title: item.summary ?? item.original_text,
            status: "todo",
            priority: (item.priority_guess as "low" | "medium" | "high" | "urgent" | null) ?? "medium",
            due_date: item.due_guess,
            position: nextPos,
            created_by: user.id,
          })
          .select()
          .single();
        if (error) continue;
        await update.mutateAsync({
          id: item.id,
          meeting_id: meetingId,
          patch: { status: "converted", converted_task_id: task.id } as never,
        });
        created++;
      }
      toast.success(`Created ${created} task${created === 1 ? "" : "s"}`);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Bulk toolbar */}
      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
          <span className="text-muted-foreground">{pending.length} pending</span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={convertAllToTasks}
            disabled={bulkBusy || !projectId}
            title={projectId ? "Convert all pending to tasks" : "Link a project first"}
          >
            {bulkBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wand2 className="mr-1 h-3 w-3" />}
            Convert all
          </Button>
        </div>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-md border p-3 text-sm transition-opacity ${
            item.status === "dismissed" ? "opacity-50" : ""
          }`}
        >
          <div className="flex items-start gap-2">
            <Checkbox
              checked={item.status === "converted" || item.status === "completed"}
              onCheckedChange={(checked) => {
                update.mutate({
                  id: item.id,
                  meeting_id: meetingId,
                  patch: { status: checked ? "completed" : "pending" } as never,
                });
              }}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <p className="leading-snug">{item.summary ?? item.original_text}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {item.assignee_guess_name && (
                  <Badge variant="outline" className="text-[10px]">@{item.assignee_guess_name}</Badge>
                )}
                {item.due_guess && (
                  <Badge variant="outline" className="text-[10px]">Due {item.due_guess}</Badge>
                )}
                {item.priority_guess && (
                  <Badge variant="outline" className={`text-[10px] ${priorityColor(item.priority_guess)}`}>
                    {item.priority_guess}
                  </Badge>
                )}
                {item.assigned_agent_id && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Bot className="h-2.5 w-2.5" /> AI
                  </Badge>
                )}
                {item.status === "converted" && item.converted_task_id && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Task created
                  </Badge>
                )}
              </div>
              {item.context_quote && (
                <p className="mt-1.5 border-l-2 border-muted pl-2 text-xs italic text-muted-foreground">
                  "{item.context_quote}"
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {item.status !== "converted" && item.status !== "completed" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setConvertingId(item.id)}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Convert to task
                    </Button>
                    {agents.length > 0 && (
                      <Select
                        onValueChange={(agentId) => assignToAgent(item, agentId)}
                      >
                        <SelectTrigger className="h-7 w-auto gap-1 border-none bg-transparent px-2 text-xs hover:bg-muted">
                          <Bot className="h-3 w-3" />
                          <span>Route to AI</span>
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map((a) => (
                            <SelectItem key={a.id} value={a.id} className="text-xs">
                              {a.avatar_emoji ?? "🤖"} {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </>
                )}
                {item.status !== "dismissed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() =>
                      update.mutate({ id: item.id, meeting_id: meetingId, patch: { status: "dismissed" } as never })
                    }
                  >
                    <X className="mr-1 h-3 w-3" /> Dismiss
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      <ConvertActionItemDialog
        item={items.find((i) => i.id === convertingId) ?? null}
        meetingId={meetingId}
        defaultProjectId={projectId}
        onClose={() => setConvertingId(null)}
      />
    </div>
  );
}

function priorityColor(p: string) {
  if (p === "urgent") return "border-red-500/40 text-red-600 dark:text-red-400";
  if (p === "high") return "border-orange-500/40 text-orange-600 dark:text-orange-400";
  if (p === "low") return "border-muted-foreground/30 text-muted-foreground";
  return "";
}

function ConvertActionItemDialog({
  item,
  meetingId,
  defaultProjectId,
  onClose,
}: {
  item: { id: string; summary: string | null; original_text: string; due_guess: string | null; priority_guess: string | null; context_quote: string | null } | null;
  meetingId: string;
  defaultProjectId: string | null;
  onClose: () => void;
}) {
  const { data: projects = [] } = useProjects();
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const update = useUpdateActionItem();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [priority, setPriority] = useState<string>("medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Reset when item changes
  if (item && title === "" && projectId === "") {
    setTitle(item.summary ?? item.original_text);
    setProjectId(defaultProjectId ?? projects[0]?.id ?? "");
    setPriority(item.priority_guess ?? "medium");
    setDueDate(item.due_guess ?? "");
  }

  const reset = () => {
    setTitle("");
    setProjectId("");
    setPriority("medium");
    setDueDate("");
  };

  const submit = async () => {
    if (!item || !ws || !user) return;
    if (!projectId) {
      toast.error("Select a project");
      return;
    }
    setSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from("tasks")
        .select("position")
        .eq("project_id", projectId)
        .order("position", { ascending: false })
        .limit(1);
      const nextPos = existing && existing.length > 0 ? Number(existing[0].position) + 1000 : 0;

      const description = item.context_quote
        ? { type: "doc", content: [
            { type: "paragraph", content: [{ type: "text", text: `From meeting:` }] },
            { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: item.context_quote }] }] },
          ]}
        : null;

      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          workspace_id: ws.id,
          project_id: projectId,
          title: title.trim(),
          status: "todo",
          priority: priority as "low" | "medium" | "high" | "urgent",
          due_date: dueDate || null,
          description: description as never,
          position: nextPos,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      await update.mutateAsync({
        id: item.id,
        meeting_id: meetingId,
        patch: { status: "converted", converted_task_id: task.id } as never,
      });

      toast.success("Task created");
      reset();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert to task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="bg-aura-gradient text-primary-foreground"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectLinkSelect({
  meetingId,
  value,
}: {
  meetingId: string;
  value: string | null;
}) {
  const { data: projects = [] } = useProjects();
  const update = useUpdateMeeting();
  const current = projects.find((p) => p.id === value);

  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={(v) =>
        update.mutate({
          id: meetingId,
          patch: { project_id: v === "__none__" ? null : v } as never,
        })
      }
    >
      <SelectTrigger className="h-8 w-auto gap-1.5 border-dashed text-xs">
        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <SelectValue placeholder="Link project">
          {current ? current.name : "Link project"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__" className="text-xs text-muted-foreground">
          No project
        </SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id} className="text-xs">
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
