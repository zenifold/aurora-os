import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { useProject } from "@/hooks/use-projects";
import {
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
} from "@/hooks/use-milestones";
import {
  MILESTONE_STATUS_META,
  MILESTONE_TYPE_META,
  type Milestone,
  type MilestoneStatus,
  type MilestoneType,
} from "@/lib/milestone-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Flag,
  Plus,
  Loader2,
  Trash2,
  CheckCircle2,
  CircleDollarSign,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/p/$projectId/milestones")({
  component: MilestonesPage,
});

function MilestonesPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: milestones = [], isLoading } = useMilestones(projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);

  const sorted = useMemo(
    () =>
      [...milestones].sort(
        (a, b) =>
          new Date(a.target_date).getTime() - new Date(b.target_date).getTime(),
      ),
    [milestones],
  );

  const totals = useMemo(() => {
    const upcoming = sorted.filter((m) => m.status === "upcoming" || m.status === "at_risk");
    const completed = sorted.filter((m) => m.status === "completed");
    const paymentTotal = sorted
      .filter((m) => m.milestone_type === "payment")
      .reduce((sum, m) => sum + (m.payment_amount ?? 0), 0);
    const paymentPaid = sorted
      .filter((m) => m.milestone_type === "payment" && m.is_paid)
      .reduce((sum, m) => sum + (m.payment_amount ?? 0), 0);
    return {
      upcoming: upcoming.length,
      completed: completed.length,
      total: sorted.length,
      paymentTotal,
      paymentPaid,
    };
  }, [sorted]);

  if (isLoading || !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/app/p/$projectId" params={{ projectId }}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {project.name}
            </div>
            <h1 className="text-lg font-semibold lg:text-xl">Milestones</h1>
          </div>
          <MilestoneDialog
            projectId={projectId}
            open={createOpen}
            onOpenChange={setCreateOpen}
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New milestone
              </Button>
            }
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
        {/* Summary */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="Total" value={String(totals.total)} icon={Flag} />
          <SummaryCard label="Upcoming" value={String(totals.upcoming)} icon={Flag} />
          <SummaryCard
            label="Completed"
            value={`${totals.completed} / ${totals.total}`}
            icon={CheckCircle2}
          />
          <SummaryCard
            label="Payments"
            value={`$${totals.paymentPaid.toLocaleString()} / $${totals.paymentTotal.toLocaleString()}`}
            icon={CircleDollarSign}
          />
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border p-12 text-center">
            <Flag className="h-10 w-10 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">No milestones yet</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Track key deliveries, payment gates, and review checkpoints to keep your
                project predictable.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New milestone
            </Button>
          </div>
        ) : (
          <Timeline milestones={sorted} onEdit={setEditing} projectId={projectId} />
        )}
      </div>

      {editing && (
        <MilestoneDialog
          projectId={projectId}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          milestone={editing}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Flag;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-lg font-semibold truncate">{value}</div>
    </div>
  );
}

function Timeline({
  milestones,
  onEdit,
  projectId,
}: {
  milestones: Milestone[];
  onEdit: (m: Milestone) => void;
  projectId: string;
}) {
  const update = useUpdateMilestone(projectId);
  const remove = useDeleteMilestone(projectId);
  const today = new Date();

  return (
    <ol className="relative space-y-3 border-l-2 border-border pl-6">
      {milestones.map((m) => {
        const target = new Date(m.target_date);
        const daysOut = differenceInCalendarDays(target, today);
        const isOverdue = daysOut < 0 && m.status !== "completed" && m.status !== "cancelled";
        const typeMeta = MILESTONE_TYPE_META[m.milestone_type];
        const statusMeta = MILESTONE_STATUS_META[m.status];

        return (
          <li key={m.id} className="relative">
            <span
              className={cn(
                "absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-background",
                m.status === "completed"
                  ? "bg-emerald-500"
                  : isOverdue
                    ? "bg-rose-500"
                    : m.status === "at_risk"
                      ? "bg-amber-500"
                      : "bg-muted-foreground",
              )}
            >
              {m.status === "completed" && (
                <CheckCircle2 className="h-3 w-3 text-white" />
              )}
            </span>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{m.name}</h3>
                    <Badge variant="secondary" className={cn("text-[10px]", typeMeta.tone)}>
                      {typeMeta.label}
                    </Badge>
                    <Badge variant="secondary" className={cn("text-[10px]", statusMeta.tone)}>
                      {statusMeta.label}
                    </Badge>
                    {m.milestone_type === "payment" && m.payment_amount != null && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px]",
                          m.is_paid
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted",
                        )}
                      >
                        ${m.payment_amount.toLocaleString()} {m.is_paid ? "· paid" : "· due"}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {format(target, "EEE, MMM d, yyyy")} ·{" "}
                    {m.status === "completed"
                      ? `Completed ${m.actual_date ? format(new Date(m.actual_date), "MMM d") : ""}`
                      : isOverdue
                        ? `${Math.abs(daysOut)} day${Math.abs(daysOut) === 1 ? "" : "s"} overdue`
                        : daysOut === 0
                          ? "Due today"
                          : `In ${daysOut} day${daysOut === 1 ? "" : "s"}`}
                  </div>
                  {m.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {m.status !== "completed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        update.mutate({
                          id: m.id,
                          status: "completed",
                          actual_date: new Date().toISOString().slice(0, 10),
                          ...(m.milestone_type === "payment" ? { is_paid: true } : {}),
                        })
                      }
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" /> Complete
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => onEdit(m)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Delete">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete milestone?</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{m.name}" will be permanently removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove.mutate(m.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function MilestoneDialog({
  projectId,
  open,
  onOpenChange,
  milestone,
  trigger,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  milestone?: Milestone;
  trigger?: React.ReactNode;
}) {
  const create = useCreateMilestone(projectId);
  const update = useUpdateMilestone(projectId);
  const editing = !!milestone;
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    name: milestone?.name ?? "",
    description: milestone?.description ?? "",
    milestone_type: (milestone?.milestone_type ?? "delivery") as MilestoneType,
    status: (milestone?.status ?? "upcoming") as MilestoneStatus,
    target_date: milestone?.target_date ?? today,
    payment_amount: milestone?.payment_amount ? String(milestone.payment_amount) : "",
    completion_criteria: milestone?.completion_criteria ?? "",
    is_paid: milestone?.is_paid ?? false,
  });

  const submit = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      milestone_type: form.milestone_type,
      status: form.status,
      target_date: form.target_date,
      payment_amount:
        form.milestone_type === "payment" && form.payment_amount
          ? Number(form.payment_amount)
          : null,
      completion_criteria: form.completion_criteria.trim() || null,
      is_paid: form.milestone_type === "payment" ? form.is_paid : false,
    };
    if (editing) {
      await update.mutateAsync({ id: milestone!.id, ...payload });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit milestone" : "New milestone"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="Beta launch"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.milestone_type}
                onValueChange={(v) =>
                  setForm({ ...form, milestone_type: v as MilestoneType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MILESTONE_TYPE_META) as MilestoneType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {MILESTONE_TYPE_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as MilestoneStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MILESTONE_STATUS_META) as MilestoneStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {MILESTONE_STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Target date</Label>
            <Input
              type="date"
              value={form.target_date}
              onChange={(e) => setForm({ ...form, target_date: e.target.value })}
            />
          </div>
          {form.milestone_type === "payment" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="10000"
                  value={form.payment_amount}
                  onChange={(e) => setForm({ ...form, payment_amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Paid?</Label>
                <Select
                  value={form.is_paid ? "yes" : "no"}
                  onValueChange={(v) => setForm({ ...form, is_paid: v === "yes" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">Not paid</SelectItem>
                    <SelectItem value="yes">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              rows={2}
              placeholder="What this milestone covers"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Completion criteria (optional)</Label>
            <Textarea
              rows={2}
              placeholder="What 'done' looks like"
              value={form.completion_criteria}
              onChange={(e) => setForm({ ...form, completion_criteria: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!form.name.trim() || create.isPending || update.isPending}
          >
            {(create.isPending || update.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
