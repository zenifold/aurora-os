import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  usePendingSubmissions,
  useReviewSubmission,
  type TimesheetSubmission,
  type TimesheetStatus,
} from "@/hooks/use-timesheet-submissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/timesheet-approvals")({
  component: TimesheetApprovalsPage,
  head: () => ({
    meta: [{ title: "Timesheet approvals · Aurora" }],
  }),
});

const STATUS_FILTERS: Array<TimesheetStatus | "all"> = [
  "submitted",
  "approved",
  "rejected",
  "all",
];

const STATUS_LABEL: Record<TimesheetStatus | "all", string> = {
  submitted: "Pending",
  approved: "Approved",
  rejected: "Returned",
  all: "All",
};

const STATUS_TONE: Record<TimesheetStatus, string> = {
  submitted: "border-amber-500/40 bg-amber-500/5",
  approved: "border-emerald-500/40 bg-emerald-500/5",
  rejected: "border-rose-500/40 bg-rose-500/5",
};

function TimesheetApprovalsPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: all = [], isLoading } = usePendingSubmissions();
  const [filter, setFilter] = useState<TimesheetStatus | "all">("submitted");

  const filtered = useMemo(
    () => (filter === "all" ? all : all.filter((s) => s.status === filter)),
    [all, filter],
  );

  const userIds = useMemo(() => Array.from(new Set(all.map((s) => s.user_id))), [all]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["timesheet-approvals-profiles", ws?.id, userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null }>;
    },
  });
  const nameById = new Map(profiles.map((p) => [p.id, p]));

  const counts = useMemo(() => {
    const c = { submitted: 0, approved: 0, rejected: 0, all: all.length };
    for (const s of all) c[s.status]++;
    return c;
  }, [all]);

  if (!ws) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card/40 px-6 py-3">
        <Button variant="ghost" size="icon" asChild aria-label="Back to timesheet">
          <Link to="/app/timesheet">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" /> Timesheet approvals
          </h1>
          <p className="text-xs text-muted-foreground">
            Review weekly time submissions from your team.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "rounded px-2.5 py-1 transition",
                filter === s ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {STATUS_LABEL[s]} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
            {filter === "submitted"
              ? "Nothing to review right now."
              : "No submissions in this view."}
          </Card>
        ) : (
          filtered.map((s) => (
            <SubmissionRow
              key={s.id}
              submission={s}
              who={nameById.get(s.user_id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SubmissionRow({
  submission,
  who,
}: {
  submission: TimesheetSubmission;
  who?: { display_name: string | null; avatar_url: string | null };
}) {
  const review = useReviewSubmission();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"approved" | "rejected">("approved");
  const [notes, setNotes] = useState("");

  const submit = () => {
    review.mutate(
      { id: submission.id, status: mode, reviewer_notes: notes.trim() || null },
      {
        onSuccess: () => {
          setOpen(false);
          setNotes("");
        },
      },
    );
  };

  const displayName = who?.display_name ?? "Teammate";

  return (
    <Card className={cn("flex flex-wrap items-center gap-4 p-4", STATUS_TONE[submission.status])}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {who?.avatar_url ? (
          <img
            src={who.avatar_url}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="text-xs text-muted-foreground">
            Week of {format(parseISO(submission.week_start), "MMM d, yyyy")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="text-right">
          <p className="text-base font-semibold tabular-nums">
            {Number(submission.total_hours).toFixed(2)}h
          </p>
          <p className="text-muted-foreground">
            {Number(submission.billable_hours).toFixed(2)}h billable
          </p>
        </div>
        <div className="hidden text-right text-muted-foreground sm:block">
          <p>
            <Clock className="mr-1 inline h-3 w-3" />
            Submitted {format(parseISO(submission.submitted_at), "MMM d")}
          </p>
          {submission.submitter_notes && (
            <p className="max-w-[16rem] truncate" title={submission.submitter_notes}>
              “{submission.submitter_notes}”
            </p>
          )}
        </div>
      </div>

      {submission.status !== "submitted" ? (
        <Badge
          variant={submission.status === "approved" ? "default" : "destructive"}
          className="capitalize"
        >
          {submission.status}
        </Badge>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <div className="flex gap-2">
            <DialogTrigger asChild>
              <Button
                size="sm"
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
                onClick={() => setMode("rejected")}
                disabled={review.isPending}
              >
                <XCircle className="mr-1.5 h-4 w-4 text-rose-500" /> Return
              </Button>
            </DialogTrigger>
          </div>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {mode === "approved" ? "Approve timesheet" : "Return for changes"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p>
                {displayName} · Week of{" "}
                {format(parseISO(submission.week_start), "MMM d, yyyy")} ·{" "}
                {Number(submission.total_hours).toFixed(2)}h
              </p>
              {submission.submitter_notes && (
                <p className="rounded-md border border-border bg-muted/30 p-2 text-xs">
                  Their note: {submission.submitter_notes}
                </p>
              )}
              <div>
                <Label className="text-xs">
                  {mode === "approved" ? "Notes (optional)" : "What needs to change?"}
                </Label>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    mode === "approved"
                      ? "Looks good."
                      : "Tell them what to fix before resubmitting…"
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={mode === "rejected" ? "destructive" : "default"}
                onClick={submit}
                disabled={review.isPending || (mode === "rejected" && notes.trim().length === 0)}
              >
                {review.isPending ? "Saving…" : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

export default TimesheetApprovalsPage;
