import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useProject } from "@/hooks/use-projects";
import {
  useChangeRequests,
  useUpdateChangeRequest,
  type ChangeRequest,
} from "@/hooks/use-change-requests";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { ArrowLeft, GitPullRequest, Inbox } from "lucide-react";

export const Route = createFileRoute("/app/p/$projectId/change-requests")({
  component: ChangeRequestsPage,
});

const STATUS_TONE: Record<ChangeRequest["status"], string> = {
  submitted: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  in_review: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-destructive/15 text-destructive",
  scheduled: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
};

const URGENCY_TONE: Record<ChangeRequest["urgency"], string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  urgent: "bg-destructive/15 text-destructive",
};

function ChangeRequestsPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: requests = [], isLoading } = useChangeRequests(projectId);
  const update = useUpdateChangeRequest();

  const open = requests.filter((r) => r.status === "submitted" || r.status === "in_review");
  const closed = requests.filter((r) => r.status !== "submitted" && r.status !== "in_review");

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app/p/$projectId" params={{ projectId }}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Change requests</h1>
            <p className="text-xs text-muted-foreground">{project?.name}</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">
          <Inbox className="h-3 w-3" /> {open.length} open
        </Badge>
      </header>

      <div className="flex-1 space-y-8 overflow-auto p-6">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <GitPullRequest className="h-4 w-4" /> Awaiting review · {open.length}
          </h2>
          {isLoading ? (
            <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
          ) : open.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              No open change requests. Clients can submit them from the portal.
            </Card>
          ) : (
            <div className="space-y-3">
              {open.map((r) => (
                <RequestCard
                  key={r.id}
                  r={r}
                  onUpdate={(p) => update.mutate({ id: r.id, ...p })}
                  saving={update.isPending}
                />
              ))}
            </div>
          )}
        </section>

        {closed.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Resolved · {closed.length}
            </h2>
            <div className="space-y-2">
              {closed.map((r) => (
                <Card key={r.id} className="space-y-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={STATUS_TONE[r.status]}>{r.status}</Badge>
                    <Badge variant="outline" className={URGENCY_TONE[r.urgency]}>
                      {r.urgency}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {r.reviewed_at
                        ? `Resolved ${new Date(r.reviewed_at).toLocaleDateString()}`
                        : new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{r.title}</p>
                  {r.submitted_by_name && (
                    <p className="text-xs text-muted-foreground">
                      from {r.submitted_by_name}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function RequestCard({
  r,
  onUpdate,
  saving,
}: {
  r: ChangeRequest;
  onUpdate: (p: {
    status?: ChangeRequest["status"];
    review_notes?: string | null;
    estimated_cost?: number | null;
    estimated_days?: number | null;
  }) => void;
  saving: boolean;
}) {
  const [notes, setNotes] = useState(r.review_notes ?? "");
  const [cost, setCost] = useState(r.estimated_cost?.toString() ?? "");
  const [days, setDays] = useState(r.estimated_days?.toString() ?? "");
  const [status, setStatus] = useState<ChangeRequest["status"]>(r.status);

  const dirty =
    notes !== (r.review_notes ?? "") ||
    cost !== (r.estimated_cost?.toString() ?? "") ||
    days !== (r.estimated_days?.toString() ?? "") ||
    status !== r.status;

  const save = () => {
    onUpdate({
      status,
      review_notes: notes.trim() ? notes.trim() : null,
      estimated_cost: cost.trim() ? Number(cost) : null,
      estimated_days: days.trim() ? Number(days) : null,
    });
  };

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={STATUS_TONE[r.status]}>{r.status}</Badge>
        <Badge variant="outline" className={URGENCY_TONE[r.urgency]}>
          {r.urgency}
        </Badge>
        {r.impact_areas.map((a) => (
          <Badge key={a} variant="outline" className="capitalize">
            {a}
          </Badge>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(r.created_at).toLocaleDateString()}
          {r.submitted_by_name && ` · ${r.submitted_by_name}`}
        </span>
      </div>
      <div>
        <p className="text-base font-semibold">{r.title}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
          {r.description}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as ChangeRequest["status"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="in_review">In review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="rejected">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Est. cost (USD)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Schedule impact (days)</Label>
          <Input
            type="number"
            min={0}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Response to client</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a response. This is visible to the client in the portal."
          rows={3}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
