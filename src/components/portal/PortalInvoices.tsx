import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePortalInvoices } from "@/hooks/use-client-portal";
import { Receipt, CheckCircle2, AlertCircle, Clock } from "lucide-react";

function fmtMoney(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

const STATUS_META: Record<
  string,
  { label: string; tone: "ok" | "warn" | "bad" | "muted"; icon: typeof Receipt }
> = {
  paid: { label: "Paid", tone: "ok", icon: CheckCircle2 },
  sent: { label: "Awaiting payment", tone: "warn", icon: Clock },
  overdue: { label: "Overdue", tone: "bad", icon: AlertCircle },
  partial: { label: "Partially paid", tone: "warn", icon: Clock },
  void: { label: "Voided", tone: "muted", icon: Receipt },
};

export function PortalInvoices({
  token,
  enabled,
}: {
  token: string;
  enabled: boolean;
}) {
  const { data: invoices = [], isLoading } = usePortalInvoices(token, enabled);
  if (!enabled || isLoading) return null;
  if (invoices.length === 0) return null;

  const outstanding = invoices.reduce(
    (acc, inv) =>
      acc + (inv.status === "paid" || inv.status === "void" ? 0 : inv.total - inv.amount_paid),
    0,
  );
  const currency = invoices[0]?.currency ?? "USD";

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Receipt className="h-4 w-4" /> Invoices
        {outstanding > 0 && (
          <Badge className="ml-1 bg-amber-500/15 text-amber-700 dark:text-amber-300">
            {fmtMoney(outstanding, currency)} outstanding
          </Badge>
        )}
      </h2>
      <Card className="divide-y divide-border">
        {invoices.map((inv) => {
          const meta = STATUS_META[inv.status] ?? {
            label: inv.status,
            tone: "muted" as const,
            icon: Receipt,
          };
          const Icon = meta.icon;
          const isOverdue =
            inv.due_date &&
            inv.status !== "paid" &&
            inv.status !== "void" &&
            new Date(inv.due_date).getTime() < Date.now();
          return (
            <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  meta.tone === "ok"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : meta.tone === "bad" || isOverdue
                      ? "bg-destructive/15 text-destructive"
                      : meta.tone === "warn"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{inv.invoice_number}</p>
                <p className="text-xs text-muted-foreground">
                  Issued {new Date(inv.issue_date).toLocaleDateString()}
                  {inv.due_date && ` · due ${new Date(inv.due_date).toLocaleDateString()}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{fmtMoney(inv.total, inv.currency)}</p>
                {inv.amount_paid > 0 && inv.amount_paid < inv.total && (
                  <p className="text-[10px] text-muted-foreground">
                    {fmtMoney(inv.amount_paid, inv.currency)} paid
                  </p>
                )}
              </div>
              <Badge
                variant={isOverdue ? "destructive" : "outline"}
                className="ml-2 whitespace-nowrap"
              >
                {isOverdue ? "Overdue" : meta.label}
              </Badge>
            </div>
          );
        })}
      </Card>
    </section>
  );
}
