import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
import {
  Plus,
  Mic,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileText,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/meetings")({
  component: MeetingsPage,
});

function MeetingsPage() {
  const { data: meetings = [], isLoading } = useMeetings();
  const { data: projects = [] } = useProjects();
  const createMeeting = useCreateMeeting();
  const deleteMeeting = useDeleteMeeting();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [transcript, setTranscript] = useState("");
  const [participants, setParticipants] = useState("");

  const reset = () => {
    setTitle("");
    setProjectId("none");
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
    // Navigate to detail
    window.location.href = `/app/meetings/${m.id}`;
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            Paste a transcript and let AI extract summaries and action items.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-aura-gradient text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" /> New meeting
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Mic className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No meetings yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first meeting and paste a transcript to get started.
          </p>
          <Button onClick={() => setOpen(true)} variant="outline">
            <Plus className="mr-2 h-4 w-4" /> New meeting
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meetings.map((m) => {
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
                  className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
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
        <DialogContent className="max-w-2xl">
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
