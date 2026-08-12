import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Receipt, Trash2, Check, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/hooks/use-projects";
import {
  useExpenses,
  useUpsertExpense,
  useDeleteExpense,
  useApproveExpense,
} from "@/hooks/use-invoices";
import { useProjectFinancials } from "@/hooks/use-project-financials";
import { formatMoney } from "@/lib/financial-types";
import { EXPENSE_CATEGORIES, type ExpenseStatus } from "@/lib/invoice-types";
import { format } from "date-fns";

export const Route = createFileRoute("/app/p/$projectId/expenses")({
  component: ExpensesPage,
});

const STATUS_COLOR: Record<ExpenseStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-destructive/10 text-destructive",
  invoiced: "bg-primary/10 text-primary",
};

function ExpensesPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: financials } = useProjectFinancials(projectId);
  const currency = financials?.currency ?? "USD";

  const [filter, setFilter] = useState<"all" | ExpenseStatus>("all");
  const { data: expenses = [], isLoading } = useExpenses({
    project_id: projectId,
    status: filter === "all" ? undefined : filter,
  });
  const upsert = useUpsertExpense();
  const del = useDeleteExpense();
  const approve = useApproveExpense();

  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [incurredOn, setIncurredOn] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isBillable, setIsBillable] = useState(true);
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setCategory("other");
    setIncurredOn(format(new Date(), "yyyy-MM-dd"));
    setIsBillable(true);
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!description.trim() || !amount) return;
    await upsert.mutateAsync({
      project_id: projectId,
      description: description.trim(),
      amount: Number(amount),
      currency,
      category,
      incurred_on: incurredOn,
      is_billable: isBillable,
      notes: notes || null,
      status: "pending",
    });
    setOpen(false);
    resetForm();
  };

  const totals = useMemo(() => {
    const sum = (s: ExpenseStatus) =>
      expenses.filter((e) => e.status === s).reduce((a, e) => a + Number(e.amount), 0);
    return {
      pending: sum("pending"),
      approved: sum("approved"),
      invoiced: sum("invoiced"),
      billable: expenses
        .filter((e) => e.is_billable && (e.status === "approved" || e.status === "invoiced"))
        .reduce((a, e) => a + Number(e.amount), 0),
    };
  }, [expenses]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/app/p/$projectId/overview"
            params={{ projectId }}
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to project
          </Link>
          <h1 className="bg-aura-gradient bg-clip-text text-2xl font-semibold text-transparent">
            Expenses
          </h1>
          <p className="text-sm text-muted-foreground">{project?.name}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log expense</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label htmlFor="exp-desc">Description</Label>
                <Input
                  id="exp-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Flight to client kickoff"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="exp-amt">Amount ({currency})</Label>
                  <Input
                    id="exp-amt"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="exp-date">Date</Label>
                  <Input
                    id="exp-date"
                    type="date"
                    value={incurredOn}
                    onChange={(e) => setIncurredOn(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Billable to client</div>
                  <div className="text-xs text-muted-foreground">Available for invoicing once approved</div>
                </div>
                <Switch checked={isBillable} onCheckedChange={setIsBillable} />
              </div>
              <div>
                <Label htmlFor="exp-notes">Notes</Label>
                <Textarea
                  id="exp-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={upsert.isPending}>
                Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pending" value={formatMoney(totals.pending, currency)} />
        <StatCard label="Approved" value={formatMoney(totals.approved, currency)} />
        <StatCard label="Invoiced" value={formatMoney(totals.invoiced, currency)} />
        <StatCard label="Billable ready" value={formatMoney(totals.billable, currency)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium">All expenses</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : expenses.length === 0 ? (
            <div className="p-10 text-center">
              <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="mb-3 text-sm text-muted-foreground">No expenses logged.</p>
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Log first expense
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{e.description}</span>
                      <Badge variant="outline" className={STATUS_COLOR[e.status]}>
                        {e.status}
                      </Badge>
                      {e.is_billable && (
                        <Badge variant="outline" className="text-[10px]">
                          billable
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground capitalize">
                      {e.category} · {format(new Date(e.incurred_on), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="text-right font-medium">
                    {formatMoney(Number(e.amount), e.currency)}
                  </div>
                  {e.status === "pending" ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => approve.mutate({ id: e.id, approve: true })}
                        aria-label="Approve"
                        title="Approve"
                      >
                        <Check className="h-4 w-4 text-emerald-500" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => approve.mutate({ id: e.id, approve: false })}
                        aria-label="Reject"
                        title="Reject"
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : null}
                  {e.status !== "invoiced" ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => del.mutate(e.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
