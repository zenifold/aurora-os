import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useProject, useUpdateProject } from "@/hooks/use-projects";
import { useMilestones } from "@/hooks/use-milestones";
import { useTeamMembers } from "@/hooks/use-team";
import {
  useProjectFinancials,
  useUpsertProjectFinancials,
  useProjectTimeLogs,
  computeSummary,
} from "@/hooks/use-project-financials";
import { useRateCards } from "@/hooks/use-rate-cards";
import { formatMoney } from "@/lib/financial-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, DollarSign, Save, TrendingUp, Wallet, Clock, Receipt, Printer, AlertTriangle } from "lucide-react";
import { printPage } from "@/lib/exports";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const BILLING_MODELS = [
  { value: "time_and_materials", label: "Time & materials" },
  { value: "fixed_fee", label: "Fixed fee" },
  { value: "milestone", label: "Milestone-based" },
  { value: "retainer", label: "Retainer" },
  { value: "non_billable", label: "Non-billable" },
] as const;
type BillingModel = (typeof BILLING_MODELS)[number]["value"];

export const Route = createFileRoute("/app/p/$projectId/financials")({
  component: FinancialsPage,
});

function FinancialsPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: financials } = useProjectFinancials(projectId);
  const { data: milestones = [] } = useMilestones(projectId);
  const { data: logs = [] } = useProjectTimeLogs(projectId);
  const { data: members = [] } = useTeamMembers();
  const { data: rateCards = [] } = useRateCards();
  const upsert = useUpsertProjectFinancials(projectId);
  const updateProject = useUpdateProject();

  const paymentMs = useMemo(
    () => milestones.filter((m) => m.milestone_type === "payment"),
    [milestones],
  );

  const summary = useMemo(
    () => computeSummary(financials ?? null, logs, members, paymentMs),
    [financials, logs, members, paymentMs],
  );

  const currency = financials?.currency ?? "USD";

  // Settings form
  const [contractValue, setContractValue] = useState("");
  const [billRate, setBillRate] = useState("");
  const [costRate, setCostRate] = useState("");
  const [currencyInput, setCurrencyInput] = useState("USD");
  const [notes, setNotes] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetHours, setBudgetHours] = useState("");
  const [billingModel, setBillingModel] = useState<BillingModel>("time_and_materials");
  const [rateCardId, setRateCardId] = useState<string>("none");
  const [retainerAmount, setRetainerAmount] = useState("");
  const [retainerPeriod, setRetainerPeriod] = useState("monthly");

  useEffect(() => {
    setContractValue(financials?.contract_value?.toString() ?? "");
    setBillRate(financials?.default_bill_rate?.toString() ?? "");
    setCostRate(financials?.default_cost_rate?.toString() ?? "");
    setCurrencyInput(financials?.currency ?? "USD");
    setNotes(financials?.notes ?? "");
    const f = financials as unknown as { budget_amount?: number | null; budget_hours?: number | null } | null;
    setBudgetAmount(f?.budget_amount?.toString() ?? "");
    setBudgetHours(f?.budget_hours?.toString() ?? "");
  }, [financials]);

  useEffect(() => {
    if (!project) return;
    const p = project as unknown as {
      billing_model?: BillingModel;
      rate_card_id?: string | null;
      retainer_amount?: number | null;
      retainer_period?: string | null;
    };
    setBillingModel(p.billing_model ?? "time_and_materials");
    setRateCardId(p.rate_card_id ?? "none");
    setRetainerAmount(p.retainer_amount?.toString() ?? "");
    setRetainerPeriod(p.retainer_period ?? "monthly");
  }, [project]);

  const handleSave = async () => {
    await upsert.mutateAsync({
      contract_value: contractValue ? Number(contractValue) : null,
      default_bill_rate: billRate ? Number(billRate) : null,
      default_cost_rate: costRate ? Number(costRate) : null,
      currency: currencyInput || "USD",
      notes: notes || null,
      budget_amount: budgetAmount ? Number(budgetAmount) : null,
      budget_hours: budgetHours ? Number(budgetHours) : null,
    } as never);
    try {
      await updateProject.mutateAsync({
        id: projectId,
        billing_model: billingModel,
        rate_card_id: rateCardId === "none" ? null : rateCardId,
        retainer_amount: billingModel === "retainer" && retainerAmount ? Number(retainerAmount) : null,
        retainer_period: billingModel === "retainer" ? retainerPeriod : null,
      } as never);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const budgetCap = Number(budgetAmount) || 0;
  const budgetUsedPct = budgetCap > 0 ? (summary.loggedCost / budgetCap) * 100 : 0;
  const budgetTone: "ok" | "warn" | "neutral" =
    budgetUsedPct >= 90 ? "warn" : budgetUsedPct >= 75 ? "neutral" : "ok";


  return (
    <div className="min-h-screen bg-background" data-print="true">
      <header className="border-b border-border bg-card/40 backdrop-blur" data-print-hide="true">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/p/$projectId" params={{ projectId }}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Link>
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <DollarSign className="h-5 w-5" /> Financials
              </h1>
              <p className="text-xs text-muted-foreground">{project?.name ?? ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={printPage}>
              <Printer className="mr-1 h-4 w-4" /> Print / PDF
            </Button>
            <Badge variant="outline" className="font-mono">{currency}</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {/* Top stat cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Receipt className="h-4 w-4" />}
            label="Contract value"
            value={formatMoney(summary.contractValue || null, currency)}
            sub={summary.contractValue > 0 ? `Burn ${summary.burnPct.toFixed(0)}%` : "Set in settings"}
          />
          <StatCard
            icon={<Wallet className="h-4 w-4" />}
            label="Paid"
            value={formatMoney(summary.paidRevenue, currency)}
            sub={`${formatMoney(summary.outstanding, currency)} outstanding`}
            tone={summary.outstanding > 0 ? "warn" : "ok"}
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Logged revenue"
            value={formatMoney(summary.loggedRevenue, currency)}
            sub={`${summary.billableHours.toFixed(1)}h billable`}
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Margin"
            value={
              summary.loggedRevenue > 0 ? `${summary.marginPct.toFixed(0)}%` : "—"
            }
            sub={formatMoney(summary.margin, currency)}
            tone={summary.marginPct < 20 ? "warn" : summary.marginPct >= 40 ? "ok" : "neutral"}
          />
        </div>

        {/* Burn against contract */}
        {summary.contractValue > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cost burn vs contract</CardTitle>
              <CardDescription>
                {formatMoney(summary.loggedCost, currency)} of {formatMoney(summary.contractValue, currency)} consumed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={Math.min(summary.burnPct, 100)} className="h-3" />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{summary.burnPct.toFixed(0)}% spent</span>
                <span>{formatMoney(summary.contractValue - summary.loggedCost, currency)} remaining</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Payment milestones */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Payment milestones</CardTitle>
              <CardDescription>
                {paymentMs.length} payment milestone{paymentMs.length === 1 ? "" : "s"} •{" "}
                {formatMoney(summary.invoicedRevenue, currency)} invoiced
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentMs.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No payment milestones yet.{" "}
                  <Link
                    to="/app/p/$projectId/milestones"
                    params={{ projectId }}
                    className="underline"
                  >
                    Create one
                  </Link>
                  .
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {paymentMs.map((m) => (
                    <li key={m.id} className="flex items-center justify-between py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Due {m.target_date}
                          {m.actual_date ? ` • completed ${m.actual_date}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">
                          {formatMoney(m.payment_amount, m.payment_currency ?? currency)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            m.is_paid
                              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                              : m.status === "completed"
                                ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                                : "",
                          )}
                        >
                          {m.is_paid ? "Paid" : m.status === "completed" ? "Invoiced" : "Pending"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Financial settings</CardTitle>
              <CardDescription>
                Used as fallback when team members lack rates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="billing-model">Billing model</Label>
                <Select value={billingModel} onValueChange={(v) => setBillingModel(v as BillingModel)}>
                  <SelectTrigger id="billing-model"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_MODELS.map((b) => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="rate-card">Rate card</Label>
                <Select value={rateCardId} onValueChange={setRateCardId}>
                  <SelectTrigger id="rate-card"><SelectValue placeholder="None — use defaults" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — use defaults</SelectItem>
                    {rateCards.filter((c) => !c.is_archived).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.is_default ? "· default" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Manage rate cards in <Link to="/app/settings/rate-cards" className="underline">workspace settings</Link>.
                </p>
              </div>

              {billingModel === "retainer" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="retainer">Retainer amount</Label>
                    <Input id="retainer" type="number" inputMode="decimal" value={retainerAmount} onChange={(e) => setRetainerAmount(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="retainer-period">Period</Label>
                    <Select value={retainerPeriod} onValueChange={setRetainerPeriod}>
                      <SelectTrigger id="retainer-period"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="contract">Contract value</Label>
                <Input
                  id="contract"
                  type="number"
                  inputMode="decimal"
                  value={contractValue}
                  onChange={(e) => setContractValue(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="budget-amount">Budget ($)</Label>
                  <Input id="budget-amount" type="number" inputMode="decimal" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="budget-hours">Budget (h)</Label>
                  <Input id="budget-hours" type="number" inputMode="decimal" value={budgetHours} onChange={(e) => setBudgetHours(e.target.value)} placeholder="0" />
                </div>
              </div>
              {budgetCap > 0 && (
                <div className="rounded-md border border-border bg-muted/40 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Budget used</span>
                    <span className={cn(
                      "font-mono font-medium",
                      budgetTone === "warn" && "text-amber-600 dark:text-amber-400",
                    )}>
                      {budgetUsedPct.toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={Math.min(budgetUsedPct, 100)} className="mt-1.5 h-1.5" />
                  {budgetUsedPct >= 90 && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" /> Approaching budget cap
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="bill">Bill rate /h</Label>
                  <Input
                    id="bill"
                    type="number"
                    inputMode="decimal"
                    value={billRate}
                    onChange={(e) => setBillRate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cost">Cost rate /h</Label>
                  <Input
                    id="cost"
                    type="number"
                    inputMode="decimal"
                    value={costRate}
                    onChange={(e) => setCostRate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="curr">Currency</Label>
                <Input
                  id="curr"
                  value={currencyInput}
                  onChange={(e) => setCurrencyInput(e.target.value.toUpperCase())}
                  maxLength={3}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <Button onClick={handleSave} disabled={upsert.isPending} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {upsert.isPending ? "Saving…" : "Save"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Cost breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Time & cost breakdown</CardTitle>
            <CardDescription>
              {(summary.billableHours + summary.nonBillableHours).toFixed(1)}h logged across{" "}
              {logs.length} entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat
                label="Billable hours"
                value={`${summary.billableHours.toFixed(1)}h`}
                sub={formatMoney(summary.loggedRevenue, currency)}
              />
              <MiniStat
                label="Non-billable hours"
                value={`${summary.nonBillableHours.toFixed(1)}h`}
                sub="Internal / fixed-bid"
              />
              <MiniStat
                label="Total cost"
                value={formatMoney(summary.loggedCost, currency)}
                sub="hours × cost rate"
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn" | "neutral";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div
          className={cn(
            "mt-1 text-2xl font-semibold",
            tone === "warn" && "text-amber-600 dark:text-amber-400",
            tone === "ok" && "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {value}
        </div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
