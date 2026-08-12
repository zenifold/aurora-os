import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { addDays, addWeeks, format, parseISO, startOfWeek } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  useMyWeekTimeLogs,
  useActiveTimer,
  useStopTimer,
  useLogTime,
} from "@/hooks/use-time-tracking";
import {
  useMyWeekSubmission,
  useSubmitWeek,
  useWithdrawSubmission,
} from "@/hooks/use-timesheet-submissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Square,
  Download,
  Send,
  Plus,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { exportRowsToCSV } from "@/lib/exports";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/timesheet")({
  component: TimesheetPage,
  head: () => ({
    meta: [
      { title: "Timesheet · Aurora" },
      { name: "description", content: "Weekly time tracking" },
    ],
  }),
});

function TimesheetPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [weekAnchor, setWeekAnchor] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const weekStart = format(weekAnchor, "yyyy-MM-dd");
  const weekEndExcl = format(addDays(weekAnchor, 7), "yyyy-MM-dd");
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i));

  const { data: logs = [], isLoading } = useMyWeekTimeLogs(weekStart, weekEndExcl);
  const { data: activeTimer } = useActiveTimer();
  const { data: submission } = useMyWeekSubmission(weekStart);
  const stop = useStopTimer();
  const logTime = useLogTime();
  const submitWeek = useSubmitWeek();
  const withdraw = useWithdrawSubmission();

  const editLocked =
    !!submission && (submission.status === "submitted" || submission.status === "approved");

  const taskIds = useMemo(() => Array.from(new Set(logs.map((l) => l.task_id))), [logs]);
  const projectIds = useMemo(
    () => Array.from(new Set(logs.map((l) => l.project_id))),
    [logs],
  );

  const { data: tasks = [] } = useQuery({
    queryKey: ["timesheet", "tasks", taskIds.join(",")],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, project_id")
        .in("id", taskIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["timesheet", "projects", projectIds.join(",")],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  type Row = { projectId: string; taskId: string };
  const rows = useMemo<Row[]>(() => {
    const seen = new Set<string>();
    const out: Row[] = [];
    for (const l of logs) {
      const key = `${l.project_id}::${l.task_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ projectId: l.project_id, taskId: l.task_id });
    }
    return out;
  }, [logs]);

  const taskMap = new Map(tasks.map((t) => [t.id, t.title as string]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name as string]));

  const cell = (taskId: string, day: Date) => {
    const ds = format(day, "yyyy-MM-dd");
    return logs
      .filter((l) => l.task_id === taskId && l.log_date === ds)
      .reduce((acc, l) => acc + Number(l.hours), 0);
  };
  const dayTotal = (day: Date) => {
    const ds = format(day, "yyyy-MM-dd");
    return logs.filter((l) => l.log_date === ds).reduce((acc, l) => acc + Number(l.hours), 0);
  };

  const weekTotal = logs.reduce((acc, l) => acc + Number(l.hours), 0);
  const weekBillable = logs
    .filter((l) => l.is_billable)
    .reduce((acc, l) => acc + Number(l.hours), 0);

  // Cell editor mutation: replace today's logs for (task, date) with a single new entry
  const setCellHours = useMutation({
    mutationFn: async (input: {
      taskId: string;
      projectId: string;
      logDate: string;
      hours: number;
    }) => {
      if (!user || !ws) throw new Error("Not ready");
      const { error: delErr } = await supabase
        .from("time_logs")
        .delete()
        .eq("user_id", user.id)
        .eq("task_id", input.taskId)
        .eq("log_date", input.logDate);
      if (delErr) throw delErr;
      if (input.hours > 0) {
        const { error } = await supabase.from("time_logs").insert({
          workspace_id: ws.id,
          task_id: input.taskId,
          project_id: input.projectId,
          user_id: user.id,
          hours: input.hours,
          log_date: input.logDate,
          is_billable: true,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time_logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!ws) return null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Timesheet</h1>
          <p className="text-sm text-muted-foreground">
            Week of {format(weekAnchor, "MMM d, yyyy")}
            {submission && (
              <SubmissionBadge status={submission.status} className="ml-2 align-middle" />
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild title="Timesheet approvals">
            <Link to="/app/timesheet-approvals">
              <ShieldCheck className="mr-1 h-4 w-4" /> Approvals
            </Link>
          </Button>
          <AddEntryDialog
            projects={projects as { id: string; name: string }[]}
            weekStart={weekStart}
            disabled={editLocked}
            onAdded={(taskId, projectId, day, hours) => {
              logTime.mutate({
                taskId,
                projectId,
                hours,
                logDate: format(day, "yyyy-MM-dd"),
              });
            }}
            days={days}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={logs.length === 0}
            onClick={() => {
              exportRowsToCSV(
                `timesheet-${weekStart}.csv`,
                logs.map((l) => ({
                  date: l.log_date,
                  project: projectMap.get(l.project_id) ?? "",
                  task: taskMap.get(l.task_id) ?? "",
                  hours: Number(l.hours).toFixed(2),
                  billable: l.is_billable ? "yes" : "no",
                  description: l.description ?? "",
                })),
                [
                  { key: "date", label: "Date" },
                  { key: "project", label: "Project" },
                  { key: "task", label: "Task" },
                  { key: "hours", label: "Hours" },
                  { key: "billable", label: "Billable" },
                  { key: "description", label: "Description" },
                ],
              );
            }}
          >
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekAnchor((d) => addWeeks(d, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setWeekAnchor(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
          >
            This week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {activeTimer && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span>
              Timer running on{" "}
              <Link
                to="/app/p/$projectId"
                params={{ projectId: activeTimer.project_id }}
                className="font-medium underline"
              >
                {taskMap.get(activeTimer.task_id) ?? "task"}
              </Link>{" "}
              since {format(parseISO(activeTimer.started_at), "p")}
            </span>
          </div>
          <Button size="sm" onClick={() => stop.mutate(activeTimer)} disabled={stop.isPending}>
            <Square className="mr-1 h-3 w-3" /> Stop &amp; log
          </Button>
        </div>
      )}

      {submission && (
        <SubmissionBanner
          submission={submission}
          onWithdraw={() => withdraw.mutate(submission.id)}
        />
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No time logged this week"
          description="Start a timer on a task or add an entry manually."
          primaryAction={{ label: "Open My Work", to: "/app/my-tasks" }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Project / Task</th>
                {days.map((d) => (
                  <th key={d.toISOString()} className="px-2 py-2 text-right">
                    <div>{format(d, "EEE")}</div>
                    <div className="font-normal normal-case">{format(d, "MMM d")}</div>
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const total = days.reduce((acc, d) => acc + cell(r.taskId, d), 0);
                return (
                  <tr key={`${r.projectId}-${r.taskId}`} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        <Link
                          to="/app/p/$projectId"
                          params={{ projectId: r.projectId }}
                          className="hover:underline"
                        >
                          {taskMap.get(r.taskId) ?? "Task"}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {projectMap.get(r.projectId) ?? "Project"}
                      </div>
                    </td>
                    {days.map((d) => {
                      const v = cell(r.taskId, d);
                      return (
                        <EditableCell
                          key={d.toISOString()}
                          value={v}
                          disabled={editLocked}
                          onChange={(hours) =>
                            setCellHours.mutate({
                              taskId: r.taskId,
                              projectId: r.projectId,
                              logDate: format(d, "yyyy-MM-dd"),
                              hours,
                            })
                          }
                        />
                      );
                    })}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {total.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-border bg-muted/30 font-medium">
                <td className="px-3 py-2 text-right">Total</td>
                {days.map((d) => (
                  <td
                    key={d.toISOString()}
                    className="px-2 py-2 text-right tabular-nums"
                  >
                    {dayTotal(d).toFixed(2)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">{weekTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div className="text-sm">
          <p className="font-medium">
            Week total: {weekTotal.toFixed(2)}h
            <span className="ml-2 text-muted-foreground">
              · {weekBillable.toFixed(2)}h billable
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {submission?.status === "approved"
              ? "Approved — locked from edits."
              : submission?.status === "submitted"
                ? "Pending manager approval."
                : submission?.status === "rejected"
                  ? "Returned for changes — edit and resubmit."
                  : "Submit when you're done logging the week."}
          </p>
        </div>
        <SubmitWeekDialog
          weekStart={weekStart}
          weekLabel={format(weekAnchor, "MMM d, yyyy")}
          totalHours={weekTotal}
          billableHours={weekBillable}
          existingNotes={submission?.submitter_notes ?? ""}
          alreadySubmitted={!!submission && submission.status === "submitted"}
          approved={submission?.status === "approved"}
          onSubmit={(notes) =>
            submitWeek.mutate({
              week_start: weekStart,
              total_hours: weekTotal,
              billable_hours: weekBillable,
              submitter_notes: notes || null,
            })
          }
          pending={submitWeek.isPending}
          disabled={weekTotal === 0}
        />
      </div>
    </div>
  );
}

function SubmissionBadge({
  status,
  className,
}: {
  status: "submitted" | "approved" | "rejected";
  className?: string;
}) {
  const map = {
    submitted: { label: "Pending review", variant: "secondary" as const },
    approved: { label: "Approved", variant: "default" as const },
    rejected: { label: "Returned", variant: "destructive" as const },
  };
  const m = map[status];
  return (
    <Badge variant={m.variant} className={className}>
      {m.label}
    </Badge>
  );
}

function SubmissionBanner({
  submission,
  onWithdraw,
}: {
  submission: {
    status: "submitted" | "approved" | "rejected";
    submitter_notes: string | null;
    reviewer_notes: string | null;
    submitted_at: string;
    reviewed_at: string | null;
  };
  onWithdraw: () => void;
}) {
  const tone =
    submission.status === "approved"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : submission.status === "rejected"
        ? "border-rose-500/40 bg-rose-500/5"
        : "border-amber-500/40 bg-amber-500/5";
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm",
        tone,
      )}
    >
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-medium">
          {submission.status === "approved" ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Approved on{" "}
              {submission.reviewed_at &&
                format(parseISO(submission.reviewed_at), "MMM d, p")}
            </>
          ) : submission.status === "rejected" ? (
            <>Returned for changes</>
          ) : (
            <>Submitted on {format(parseISO(submission.submitted_at), "MMM d, p")}</>
          )}
        </p>
        {submission.reviewer_notes && (
          <p className="text-xs">Reviewer: {submission.reviewer_notes}</p>
        )}
        {submission.submitter_notes && (
          <p className="text-xs text-muted-foreground">
            Your note: {submission.submitter_notes}
          </p>
        )}
      </div>
      {submission.status !== "approved" && (
        <Button variant="ghost" size="sm" onClick={onWithdraw}>
          Withdraw
        </Button>
      )}
    </div>
  );
}

function EditableCell({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value > 0 ? value.toFixed(2) : "");

  const commit = () => {
    const n = parseFloat(draft);
    if (!Number.isFinite(n) || n < 0) {
      setDraft(value > 0 ? value.toFixed(2) : "");
      setEditing(false);
      return;
    }
    if (n !== value) onChange(n);
    setEditing(false);
  };

  if (disabled) {
    return (
      <td className="px-2 py-2 text-right tabular-nums">
        {value > 0 ? value.toFixed(2) : <span className="text-muted-foreground">—</span>}
      </td>
    );
  }

  return (
    <td className="px-1 py-1 text-right">
      {editing ? (
        <input
          autoFocus
          className="w-14 rounded border border-primary/40 bg-background px-1 py-0.5 text-right text-sm tabular-nums outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(value > 0 ? value.toFixed(2) : "");
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(value > 0 ? value.toFixed(2) : "");
            setEditing(true);
          }}
          className="w-full rounded px-1 py-1 text-right tabular-nums hover:bg-muted"
        >
          {value > 0 ? value.toFixed(2) : <span className="text-muted-foreground">—</span>}
        </button>
      )}
    </td>
  );
}

function SubmitWeekDialog({
  weekLabel,
  totalHours,
  billableHours,
  existingNotes,
  alreadySubmitted,
  approved,
  onSubmit,
  pending,
  disabled,
}: {
  weekStart: string;
  weekLabel: string;
  totalHours: number;
  billableHours: number;
  existingNotes: string;
  alreadySubmitted: boolean;
  approved: boolean;
  onSubmit: (notes: string) => void;
  pending: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(existingNotes);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setNotes(existingNotes);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled || approved}>
          <Send className="mr-1.5 h-4 w-4" />
          {alreadySubmitted ? "Resubmit" : approved ? "Approved" : "Submit week"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit timesheet for {weekLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-semibold tabular-nums">{totalHours.toFixed(2)}h</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Billable</p>
              <p className="text-xl font-semibold tabular-nums">{billableHours.toFixed(2)}h</p>
            </div>
          </div>
          <div>
            <Label className="text-xs">Note to reviewer (optional)</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything your reviewer should know about this week?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSubmit(notes.trim());
              setOpen(false);
            }}
            disabled={pending}
          >
            {pending ? "Submitting…" : alreadySubmitted ? "Resubmit" : "Submit for approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddEntryDialog({
  projects,
  days,
  weekStart,
  disabled,
  onAdded,
}: {
  projects: { id: string; name: string }[];
  days: Date[];
  weekStart: string;
  disabled: boolean;
  onAdded: (taskId: string, projectId: string, day: Date, hours: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [taskId, setTaskId] = useState<string>("");
  const [day, setDay] = useState<string>(format(days[0], "yyyy-MM-dd"));
  const [hours, setHours] = useState<string>("");

  const { data: allProjects = [] } = useQuery({
    queryKey: ["timesheet-add-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name")
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const choices = allProjects.length > 0 ? allProjects : projects;

  const { data: tasks = [] } = useQuery({
    queryKey: ["timesheet-add-tasks", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = () => {
    const h = parseFloat(hours);
    if (!projectId || !taskId || !day || !Number.isFinite(h) || h <= 0) {
      toast.error("Pick a project, task, day, and hours");
      return;
    }
    onAdded(taskId, projectId, new Date(day + "T00:00:00"), h);
    setOpen(false);
    setHours("");
    setTaskId("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Plus className="mr-1 h-4 w-4" /> Add entry
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log time</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Project</Label>
            <Select value={projectId} onValueChange={(v) => { setProjectId(v); setTaskId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {choices.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Task</Label>
            <Select value={taskId} onValueChange={setTaskId} disabled={!projectId}>
              <SelectTrigger>
                <SelectValue placeholder={projectId ? "Select a task" : "Pick a project first"} />
              </SelectTrigger>
              <SelectContent>
                {tasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Day</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {days.map((d) => (
                    <SelectItem key={d.toISOString()} value={format(d, "yyyy-MM-dd")}>
                      {format(d, "EEE MMM d")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Hours</Label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                placeholder="0.00"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Week {weekStart}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Log</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TimesheetPage;
