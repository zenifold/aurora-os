import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/hooks/use-projects";
import {
  useClientAccess,
  useDeliverables,
  useUpsertDeliverable,
  useReviewDeliverable,
  buildPortalUrl,
} from "@/hooks/use-client-portal";
import {
  DELIVERABLE_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
  type ClientDeliverable,
  type DeliverableType,
  type DeliverableReviewStatus,
} from "@/lib/client-portal-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Copy,
  Clock,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/p/$projectId/approvals")({
  component: ApprovalsPage,
});

const DELIVERABLE_TYPES: DeliverableType[] = [
  "approval",
  "review",
  "feedback",
  "content_upload",
  "data_provision",
  "signature",
  "payment",
  "decision",
];

const STATUS_COLOR: Record<DeliverableReviewStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  submitted: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  needs_revision: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

function ApprovalsPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: clients = [] } = useClientAccess(projectId);
  const { data: deliverables = [], isLoading } = useDeliverables(projectId);

  const taskIds = useMemo(
    () => Array.from(new Set(deliverables.map((d) => d.task_id))),
    [deliverables],
  );

  const { data: taskMap = new Map<string, { id: string; title: string; status: string }>() } =
    useQuery({
      queryKey: ["approvals-tasks", projectId, taskIds.join(",")],
      enabled: taskIds.length > 0,
      queryFn: async () => {
        const { data, error } = await supabase
          .from("tasks")
          .select("id,title,status")
          .in("id", taskIds);
        if (error) throw error;
        return new Map((data ?? []).map((t) => [t.id, t]));
      },
    });

  const { data: projectTasks = [] } = useQuery({
    queryKey: ["approvals-project-tasks", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,status")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const grouped = useMemo(() => {
    const g: Record<DeliverableReviewStatus, ClientDeliverable[]> = {
      submitted: [],
      needs_revision: [],
      pending: [],
      approved: [],
      rejected: [],
    };
    for (const d of deliverables) g[d.review_status]?.push(d);
    return g;
  }, [deliverables]);

  const clientNameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  );

  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card/40 px-6 py-3">
        <Button variant="ghost" size="icon" asChild aria-label="Back to project">
          <Link to="/app/p/$projectId" params={{ projectId }}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-base font-semibold">Client approvals</h1>
          <p className="text-xs text-muted-foreground">
            {project?.name ?? "Project"} · {deliverables.length} deliverable
            {deliverables.length === 1 ? "" : "s"}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={clients.length === 0}>
              <Plus className="mr-1.5 h-4 w-4" /> Request approval
            </Button>
          </DialogTrigger>
          <CreateDeliverableDialog
            projectId={projectId}
            clients={clients}
            tasks={projectTasks}
            onClose={() => setCreateOpen(false)}
          />
        </Dialog>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {clients.length === 0 && (
          <Card className="border-dashed p-6 text-sm">
            <p className="mb-2 font-medium">No clients invited yet.</p>
            <p className="mb-3 text-muted-foreground">
              Invite at least one client to start requesting approvals.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/p/$projectId/clients" params={{ projectId }}>
                Manage clients
              </Link>
            </Button>
          </Card>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading deliverables…</p>
        ) : deliverables.length === 0 && clients.length > 0 ? (
          <Card className="border-dashed p-8 text-center">
            <p className="mb-3 text-sm text-muted-foreground">
              No approval requests yet for this project.
            </p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Request first approval
            </Button>
          </Card>
        ) : (
          (["submitted", "needs_revision", "pending", "approved", "rejected"] as const).map(
            (status) => {
              const items = grouped[status];
              if (items.length === 0) return null;
              return (
                <section key={status}>
                  <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] normal-case tracking-normal",
                        STATUS_COLOR[status],
                      )}
                    >
                      {REVIEW_STATUS_LABELS[status]}
                    </span>
                    <span>{items.length}</span>
                  </h2>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((d) => (
                      <DeliverableCard
                        key={d.id}
                        deliverable={d}
                        client={
                          d.client_portal_access_id
                            ? clientNameById.get(d.client_portal_access_id)
                            : undefined
                        }
                        task={taskMap.get(d.task_id)}
                      />
                    ))}
                  </div>
                </section>
              );
            },
          )
        )}
      </div>
    </div>
  );
}

function DeliverableCard({
  deliverable: d,
  client,
  task,
}: {
  deliverable: ClientDeliverable;
  client?: { id: string; name: string; access_token: string };
  task?: { id: string; title: string };
}) {
  const review = useReviewDeliverable();
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DeliverableReviewStatus>("approved");

  const submittedFiles =
    (d.submitted_content as { files?: Array<{ name: string; path: string }> } | null)?.files ?? [];
  const submittedDecision =
    (d.submitted_content as { decision?: string } | null)?.decision ?? null;
  const submittedComments =
    (d.submitted_content as { comments?: string } | null)?.comments ?? null;

  const overdue =
    d.client_deadline &&
    new Date(d.client_deadline).getTime() < Date.now() &&
    d.review_status !== "approved";

  const copyLink = async () => {
    if (!client) return;
    await navigator.clipboard.writeText(buildPortalUrl(client.access_token));
    toast.success("Portal link copied");
  };

  const submitReview = (status: DeliverableReviewStatus) => {
    review.mutate(
      { id: d.id, review_status: status, review_notes: notes.trim() || null },
      {
        onSuccess: () => {
          setOpen(false);
          setNotes("");
        },
      },
    );
  };

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {DELIVERABLE_TYPE_LABELS[d.deliverable_type]}
            </Badge>
            {overdue && (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <Clock className="h-3 w-3" /> Overdue
              </Badge>
            )}
            {d.revision_count > 0 && (
              <Badge variant="outline" className="text-[10px]">
                Rev {d.revision_count}/{d.max_revisions}
              </Badge>
            )}
          </div>
          <h3 className="mt-1.5 truncate text-sm font-semibold">
            {task?.title ?? "Untitled task"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {client ? client.name : "Unassigned client"}
            {d.client_deadline ? ` · due ${d.client_deadline}` : ""}
          </p>
        </div>
        {client && (
          <Button
            variant="ghost"
            size="icon"
            onClick={copyLink}
            title="Copy portal link"
            aria-label="Copy portal link"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {d.client_instructions && (
        <p className="line-clamp-3 text-xs text-muted-foreground">{d.client_instructions}</p>
      )}

      {(submittedDecision || submittedComments || submittedFiles.length > 0) && (
        <div className="rounded-md border border-border bg-muted/30 p-2.5 text-xs">
          <p className="mb-1 font-medium">Client submission</p>
          {submittedDecision && (
            <p>
              Decision:{" "}
              <span className="font-medium capitalize">
                {submittedDecision.replace(/_/g, " ")}
              </span>
            </p>
          )}
          {submittedComments && <p className="mt-1 text-muted-foreground">{submittedComments}</p>}
          {submittedFiles.length > 0 && (
            <p className="mt-1 text-muted-foreground">
              {submittedFiles.length} file{submittedFiles.length === 1 ? "" : "s"} attached
            </p>
          )}
          {d.submitted_at && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Submitted {new Date(d.submitted_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {d.review_notes && (
        <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs">
          <p className="mb-1 font-medium">Your notes</p>
          <p className="text-muted-foreground">{d.review_notes}</p>
        </div>
      )}

      {(d.review_status === "submitted" || d.review_status === "pending") && (
        <Dialog open={open} onOpenChange={setOpen}>
          <div className="flex gap-2">
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => setMode("approved")}
                disabled={review.isPending}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
              </Button>
            </DialogTrigger>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setMode("needs_revision")}
                disabled={review.isPending}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" /> Revisions
              </Button>
            </DialogTrigger>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMode("rejected")}
                disabled={review.isPending}
                aria-label="Reject"
                title="Reject"
              >
                <XCircle className="h-4 w-4 text-rose-500" />
              </Button>
            </DialogTrigger>
          </div>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {mode === "approved"
                  ? "Approve submission"
                  : mode === "needs_revision"
                    ? "Request revisions"
                    : "Reject submission"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label className="text-xs">
                {mode === "approved" ? "Notes (optional)" : "Notes to client"}
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder={
                  mode === "approved"
                    ? "Great work — moving this to done."
                    : "Tell the client what needs to change…"
                }
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => submitReview(mode)}
                disabled={
                  review.isPending ||
                  (mode !== "approved" && notes.trim().length === 0)
                }
                variant={mode === "rejected" ? "destructive" : "default"}
              >
                {review.isPending ? "Saving…" : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {(d.review_status === "approved" || d.review_status === "rejected") && d.reviewed_at && (
        <p className="text-[10px] text-muted-foreground">
          {d.review_status === "approved" ? "Approved" : "Rejected"}{" "}
          {new Date(d.reviewed_at).toLocaleString()}
        </p>
      )}

      {d.review_status === "needs_revision" && (
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <ExternalLink className="h-3 w-3" /> Awaiting client resubmission
        </p>
      )}
    </Card>
  );
}

function CreateDeliverableDialog({
  projectId,
  clients,
  tasks,
  onClose,
}: {
  projectId: string;
  clients: Array<{ id: string; name: string }>;
  tasks: Array<{ id: string; title: string; status: string }>;
  onClose: () => void;
}) {
  const upsert = useUpsertDeliverable();
  const [taskId, setTaskId] = useState<string>("");
  const [clientId, setClientId] = useState<string>(clients[0]?.id ?? "");
  const [type, setType] = useState<DeliverableType>("approval");
  const [instructions, setInstructions] = useState("");
  const [deadline, setDeadline] = useState("");

  const submit = () => {
    if (!taskId) {
      toast.error("Pick a task");
      return;
    }
    upsert.mutate(
      {
        project_id: projectId,
        task_id: taskId,
        client_portal_access_id: clientId || null,
        deliverable_type: type,
        client_instructions: instructions.trim() || null,
        client_deadline: deadline || null,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Request client approval</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Task</Label>
          <Select value={taskId} onValueChange={setTaskId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a task" />
            </SelectTrigger>
            <SelectContent>
              {tasks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as DeliverableType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERABLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DELIVERABLE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Deadline (optional)</Label>
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Instructions to client</Label>
          <Textarea
            rows={4}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="What do you need them to review or approve?"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={upsert.isPending || !taskId}>
          {upsert.isPending ? "Creating…" : "Send request"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default ApprovalsPage;
