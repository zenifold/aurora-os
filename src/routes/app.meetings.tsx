import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMeetings, useCreateMeeting, useDeleteMeeting } from "@/hooks/use-meetings";
import { useProjects } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { CardGridSkeleton } from "@/components/ui/loading-scaffolds";
import {
  Plus,
  Mic,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileText,
  Trash2,
  Search,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type SearchParams = { project?: string; status?: string; q?: string };

export const Route = createFileRoute("/app/meetings")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    project: typeof s.project === "string" ? s.project : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: MeetingsPage,
});

function MeetingsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: meetings = [], isLoading } = useMeetings();
  const { data: projects = [] } = useProjects();
  const createMeeting = useCreateMeeting();
  const deleteMeeting = useDeleteMeeting();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string>(search.project ?? "none");
  const [transcript, setTranscript] = useState("");
  const [participants, setParticipants] = useState("");

  const q = search.q ?? "";
  const projectFilter = search.project ?? "all";
  const statusFilter = search.status ?? "all";

  const setSearchParam = (patch: Partial<SearchParams>) => {
    navigate({
      search: (prev) => {
        const next: SearchParams = { ...prev, ...patch };
        // strip empties
        if (!next.q) delete next.q;
        if (!next.project || next.project === "all") delete next.project;
        if (!next.status || next.status === "all") delete next.status;
        return next;
      },
    });
  };

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return meetings.filter((m) => {
      if (projectFilter !== "all") {
        if (projectFilter === "none" && m.project_id) return false;
        if (projectFilter !== "none" && m.project_id !== projectFilter) return false;
      }
      if (statusFilter !== "all" && m.ai_status !== statusFilter) return false;
      if (ql) {
        const hay = `${m.title} ${m.description ?? ""} ${m.transcript_raw_text ?? ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [meetings, q, projectFilter, statusFilter]);

  const reset = () => {
    setTitle("");
    setProjectId(search.project ?? "none");
    setTranscript("");
    setParticipants("");
  };

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Add a title");
      return;
    }
    const m = await createMeeting.mutateAsync({
      title: title.trim(),
      project_id: projectId === "none" ? null : projectId,
      transcript_raw_text: transcript.trim() || null,
      participant_emails: participants
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter(Boolean),
    });
    toast.success("Meeting created");
    setOpen(false);
    reset();
    window.location.href = `/app/meetings/${m.id}`;
  };

  const activeProject = projects.find((p) => p.id === search.project);
  const hasActiveFilters = q || projectFilter !== "all" || statusFilter !== "all";

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            {activeProject
              ? <>Meetings linked to <span className="font-medium">{activeProject.name}</span></>
              : "Paste a transcript and let AI extract summaries and action items."}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="w-full bg-aura-gradient text-primary-foreground sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> New meeting
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setSearchParam({ q: e.target.value })}
            placeholder="Search title or transcript"
            className="h-9 pl-7 text-sm sm:w-64"
          />
          {q && (
            <button
              onClick={() => setSearchParam({ q: "" })}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <Select value={projectFilter} onValueChange={(v) => setSearchParam({ project: v })}>
          <SelectTrigger className="h-9 w-auto min-w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            <SelectItem value="none">No project</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setSearchParam({ status: v })}>
          <SelectTrigger className="h-9 w-auto min-w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Analyzed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs"
            onClick={() => navigate({ search: {} as SearchParams })}
          >
            Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Mic className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">
            {meetings.length === 0 ? "No meetings yet" : "No meetings match your filters"}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            {meetings.length === 0
              ? "Create your first meeting and paste a transcript to get started."
              : "Try adjusting search or filters."}
          </p>
          {meetings.length === 0 && (
            <Button onClick={() => setOpen(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" /> New meeting
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => {
            const project = projects.find((p) => p.id === m.project_id);
            return (
              <div key={m.id} className="group relative rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
                <Link
                  to="/app/meetings/$meetingId"
                  params={{ meetingId: m.id }}
                  className="block"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-medium">{m.title}</h3>
                    <StatusBadge status={m.ai_status} />
                  </div>
                  {project && (
                    <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: project.color }} />
                      {project.name}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                    {Array.isArray(m.action_items) && m.action_items.length > 0 && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {m.action_items.length} action items
                      </span>
                    )}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!confirm("Delete this meeting?")) return;
                    await deleteMeeting.mutateAsync(m.id);
                    toast.success("Meeting deleted");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New meeting</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Q3 Planning Sync"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Project (optional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Participants (optional, comma-separated emails)</Label>
              <Input
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="sarah@co.com, alex@co.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Transcript</Label>
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your meeting transcript here..."
                rows={10}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                You can also create the meeting empty and paste/edit later.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={createMeeting.isPending}
              className="bg-aura-gradient text-primary-foreground"
            >
              {createMeeting.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed")
    return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Analyzed</Badge>;
  if (status === "processing")
    return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>;
  if (status === "failed")
    return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Failed</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}
