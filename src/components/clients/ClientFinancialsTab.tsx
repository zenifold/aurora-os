import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, isPast } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, FileText, AlertTriangle, TrendingUp, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ListSkeleton } from "@/components/ui/loading-scaffolds";
import { cn } from "@/lib/utils";

type Project = { id: string; name: string };

interface Invoice {
  id: string;
  invoice_number: string;
  project_id: string;
  status: string;
  total: number;
  amount_paid: number;
  currency: string;
  issue_date: string;
  due_date: string | null;
  paid_at: string | null;
}

interface Financial {
  project_id: string;
  contract_value: number | null;
  budget_amount: number | null;
  budget_hours: number | null;
  currency: string;
}

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-foreground",
  sent: "bg-blue-500/10 text-blue-600",
  viewed: "bg-amber-500/10 text-amber-600",
  paid: "bg-emerald-500/10 text-emerald-600",
  partial: "bg-amber-500/10 text-amber-600",
  overdue: "bg-destructive/10 text-destructive",
  void: "bg-muted text-muted-foreground",
};

export function ClientFinancialsTab({ projects }: { projects: Project[] }) {
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ["client-invoices", projectIds.join(",")],
    queryFn: async () => {
      if (projectIds.length === 0) return [] as Invoice[];
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, project_id, status, total, amount_paid, currency, issue_date, due_date, paid_at")
        .in("project_id", projectIds)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
    enabled: projectIds.length > 0,
    staleTime: 60_000,
  });

  const { data: financials = [] } = useQuery({
    queryKey: ["client-financials", projectIds.join(",")],
    queryFn: async () => {
      if (projectIds.length === 0) return [] as Financial[];
      const { data, error } = await supabase
        .from("project_financials")
        .select("project_id, contract_value, budget_amount, budget_hours, currency")
        .in("project_id", projectIds);
      if (error) throw error;
      return (data ?? []) as Financial[];
    },
    enabled: projectIds.length > 0,
    staleTime: 60_000,
  });

  const totals = useMemo(() => {
    let billed = 0;
    let collected = 0;
    let outstanding = 0;
    let overdue = 0;
    let contractValue = 0;
    let budget = 0;
    const currency = invoices[0]?.currency ?? financials[0]?.currency ?? "USD";

    for (const inv of invoices) {
      billed += inv.total;
      collected += inv.amount_paid;
      const remaining = inv.total - inv.amount_paid;
      if (remaining > 0 && inv.status !== "void") {
        outstanding += remaining;
        if (inv.due_date && isPast(new Date(inv.due_date))) overdue += remaining;
      }
    }
    for (const f of financials) {
      contractValue += f.contract_value ?? 0;
      budget += f.budget_amount ?? 0;
    }
    return { billed, collected, outstanding, overdue, contractValue, budget, currency };
  }, [invoices, financials]);

  if (projects.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        No engagements yet — financials will appear once projects exist.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<DollarSign className="h-4 w-4" />} label="Contract value" value={fmt(totals.contractValue, totals.currency)} sub={`Budget ${fmt(totals.budget, totals.currency)}`} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Collected" value={fmt(totals.collected, totals.currency)} sub={`of ${fmt(totals.billed, totals.currency)} billed`} />
        <Kpi icon={<FileText className="h-4 w-4" />} label="Outstanding" value={fmt(totals.outstanding, totals.currency)} sub={`${invoices.filter(i => i.total - i.amount_paid > 0 && i.status !== "void").length} open invoices`} />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Overdue" value={fmt(totals.overdue, totals.currency)} tone={totals.overdue > 0 ? "destructive" : undefined} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Invoices ({invoices.length})</h3>
        </div>
        {invLoading ? (
          <div className="p-4"><ListSkeleton rows={4} /></div>
        ) : invoices.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Number</th>
                <th className="text-left px-4 py-2 font-medium">Engagement</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Total</th>
                <th className="text-right px-4 py-2 font-medium">Paid</th>
                <th className="text-left px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => {
                const proj = projectById.get(inv.project_id);
                const remaining = inv.total - inv.amount_paid;
                const isOverdue = remaining > 0 && inv.due_date && isPast(new Date(inv.due_date)) && inv.status !== "void";
                return (
                  <tr key={inv.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{inv.invoice_number}</td>
                    <td className="px-4 py-2 text-muted-foreground">{proj?.name ?? "—"}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={cn("text-xs", STATUS_TONE[inv.status] ?? "")}>
                        {inv.status}
                      </Badge>
                      {isOverdue && <Badge variant="outline" className="ml-1 text-xs bg-destructive/10 text-destructive">overdue</Badge>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(inv.total, inv.currency)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmt(inv.amount_paid, inv.currency)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <Link to="/app/p/$projectId" params={{ projectId: inv.project_id }}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Per-engagement burn</h3>
        </div>
        <ul className="divide-y divide-border">
          {projects.map((p) => {
            const f = financials.find((x) => x.project_id === p.id);
            const projInvoices = invoices.filter((i) => i.project_id === p.id);
            const billed = projInvoices.reduce((s, i) => s + i.total, 0);
            const cv = f?.contract_value ?? 0;
            const pct = cv > 0 ? Math.min(100, (billed / cv) * 100) : 0;
            return (
              <li key={p.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <Link to="/app/p/$projectId" params={{ projectId: p.id }} className="font-medium hover:underline truncate">
                    {p.name}
                  </Link>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {fmt(billed, f?.currency ?? "USD")} / {cv > 0 ? fmt(cv, f?.currency ?? "USD") : "—"}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "destructive" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "destructive" && "text-destructive")}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
