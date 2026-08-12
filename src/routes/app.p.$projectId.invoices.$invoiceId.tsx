import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  Printer,
  Sparkles,
  Receipt,
  Clock,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useInvoice,
  useInvoiceLineItems,
  useUpdateInvoice,
  useUpsertLineItem,
  useDeleteLineItem,
  useRecalcInvoice,
  useExpenses,
} from "@/hooks/use-invoices";
import { useProject } from "@/hooks/use-projects";
import { useProjectTimeLogs } from "@/hooks/use-project-financials";
import { useMilestones } from "@/hooks/use-milestones";
import { useTeamMembers } from "@/hooks/use-team";
import { useProjectFinancials } from "@/hooks/use-project-financials";
import { formatMoney } from "@/lib/financial-types";
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/invoice-types";
import { printPage } from "@/lib/exports";
import { format } from "date-fns";
import { toast } from "sonner";
import { EntityLinksPanel } from "@/components/entity-links/EntityLinksPanel";
import { EntityBacklinksPanel } from "@/components/entity-links/EntityBacklinksPanel";

export const Route = createFileRoute("/app/p/$projectId/invoices/$invoiceId")({
  component: InvoiceDetailPage,
});

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  overdue: "bg-destructive/10 text-destructive",
  void: "bg-muted text-muted-foreground line-through",
};

function InvoiceDetailPage() {
  const { projectId, invoiceId } = Route.useParams();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: invoice } = useInvoice(invoiceId);
  const { data: lines = [] } = useInvoiceLineItems(invoiceId);
  const { data: financials } = useProjectFinancials(projectId);
  const update = useUpdateInvoice();
  const upsertLine = useUpsertLineItem();
  const delLine = useDeleteLineItem();
  const recalc = useRecalcInvoice();

  // Local invoice field edits (debounced save on blur)
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!invoice) return;
    setClientName(invoice.client_name ?? "");
    setClientEmail(invoice.client_email ?? "");
    setClientAddress(invoice.client_address ?? "");
    setNotes(invoice.notes ?? "");
    setTaxRate(String(invoice.tax_rate ?? 0));
    setDueDate(invoice.due_date ?? "");
  }, [invoice?.id]);

  const isDraft = invoice?.status === "draft";

  const saveField = async (patch: Record<string, unknown>) => {
    if (!invoice) return;
    await update.mutateAsync({ id: invoice.id, ...patch });
  };

  const addLine = async () => {
    await upsertLine.mutateAsync({
      invoice_id: invoiceId,
      description: "New line item",
      quantity: 1,
      unit_price: 0,
      sort_order: lines.length,
      source_kind: "manual",
    });
    await recalc.mutateAsync({ invoice_id: invoiceId });
  };

  const updateLine = async (id: string, patch: Partial<{ description: string; quantity: number; unit_price: number }>) => {
    const existing = lines.find((l) => l.id === id);
    if (!existing) return;
    await upsertLine.mutateAsync({
      id,
      invoice_id: invoiceId,
      description: patch.description ?? existing.description,
      quantity: patch.quantity ?? Number(existing.quantity),
      unit_price: patch.unit_price ?? Number(existing.unit_price),
      sort_order: existing.sort_order,
      source_kind: existing.source_kind,
      source_id: existing.source_id,
    });
    await recalc.mutateAsync({ invoice_id: invoiceId });
  };

  const removeLine = async (id: string) => {
    await delLine.mutateAsync({ id, invoice_id: invoiceId });
    await recalc.mutateAsync({ invoice_id: invoiceId });
  };

  const markSent = async () => {
    if (!invoice) return;
    await update.mutateAsync({
      id: invoice.id,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
    toast.success("Invoice marked as sent");
  };

  const markPaid = async () => {
    if (!invoice) return;
    await update.mutateAsync({
      id: invoice.id,
      status: "paid",
      amount_paid: Number(invoice.total),
      paid_at: new Date().toISOString(),
    });
    toast.success("Invoice marked as paid");
  };

  const [importOpen, setImportOpen] = useState(false);

  if (!invoice) {
    return <div className="p-8 text-sm text-muted-foreground">Loading invoice…</div>;
  }

  const currency = invoice.currency;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/app/p/$projectId/invoices"
            params={{ projectId }}
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> All invoices
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{invoice.invoice_number}</h1>
            <Badge variant="outline" className={STATUS_COLOR[invoice.status]}>
              {INVOICE_STATUS_LABEL[invoice.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{project?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => printPage()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          {isDraft ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" /> Import lines
              </Button>
              <Button size="sm" onClick={markSent}>
                <Send className="mr-2 h-4 w-4" /> Mark as sent
              </Button>
            </>
          ) : invoice.status === "sent" || invoice.status === "overdue" ? (
            <Button size="sm" onClick={markPaid}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as paid
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Line items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Description</th>
                    <th className="px-4 py-2 text-right font-medium w-20">Qty</th>
                    <th className="px-4 py-2 text-right font-medium w-28">Unit price</th>
                    <th className="px-4 py-2 text-right font-medium w-28">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        No line items yet.
                      </td>
                    </tr>
                  ) : (
                    lines.map((l) => (
                      <tr key={l.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">
                          {isDraft ? (
                            <Input
                              defaultValue={l.description}
                              onBlur={(e) =>
                                e.target.value !== l.description &&
                                updateLine(l.id, { description: e.target.value })
                              }
                              className="h-8 border-0 bg-transparent px-1 focus-visible:ring-1"
                            />
                          ) : (
                            l.description
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {isDraft ? (
                            <Input
                              type="number"
                              step="0.01"
                              defaultValue={l.quantity}
                              onBlur={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v !== Number(l.quantity)) updateLine(l.id, { quantity: v });
                              }}
                              className="h-8 w-20 border-0 bg-transparent px-1 text-right focus-visible:ring-1"
                            />
                          ) : (
                            Number(l.quantity)
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {isDraft ? (
                            <Input
                              type="number"
                              step="0.01"
                              defaultValue={l.unit_price}
                              onBlur={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v !== Number(l.unit_price)) updateLine(l.id, { unit_price: v });
                              }}
                              className="h-8 w-28 border-0 bg-transparent px-1 text-right focus-visible:ring-1"
                            />
                          ) : (
                            formatMoney(Number(l.unit_price), currency)
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatMoney(Number(l.amount), currency)}
                        </td>
                        <td className="px-2">
                          {isDraft ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => removeLine(l.id)}
                              aria-label="Remove line"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {isDraft ? (
                <div className="border-t border-border p-3">
                  <Button size="sm" variant="outline" onClick={addLine}>
                    <Plus className="mr-2 h-3.5 w-3.5" /> Add line
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => notes !== (invoice.notes ?? "") && saveField({ notes })}
                readOnly={!isDraft}
                rows={4}
                placeholder="Payment terms, thank-you message, bank details…"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Bill to</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="cn">Client name</Label>
                <Input
                  id="cn"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  onBlur={() => clientName !== (invoice.client_name ?? "") && saveField({ client_name: clientName || null })}
                  readOnly={!isDraft}
                />
              </div>
              <div>
                <Label htmlFor="ce">Email</Label>
                <Input
                  id="ce"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  onBlur={() => clientEmail !== (invoice.client_email ?? "") && saveField({ client_email: clientEmail || null })}
                  readOnly={!isDraft}
                />
              </div>
              <div>
                <Label htmlFor="ca">Address</Label>
                <Textarea
                  id="ca"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  onBlur={() => clientAddress !== (invoice.client_address ?? "") && saveField({ client_address: clientAddress || null })}
                  readOnly={!isDraft}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMoney(Number(invoice.subtotal), currency)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="flex-1 text-sm text-muted-foreground" htmlFor="tax">
                  Tax rate %
                </Label>
                <Input
                  id="tax"
                  type="number"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  onBlur={async () => {
                    const v = parseFloat(taxRate);
                    if (!isNaN(v) && v !== Number(invoice.tax_rate)) {
                      await recalc.mutateAsync({ invoice_id: invoiceId, tax_rate: v });
                    }
                  }}
                  readOnly={!isDraft}
                  className="h-8 w-20 text-right"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatMoney(Number(invoice.tax_amount), currency)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                <span>Total</span>
                <span>{formatMoney(Number(invoice.total), currency)}</span>
              </div>
              <div>
                <Label htmlFor="dd">Due date</Label>
                <Input
                  id="dd"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  onBlur={() => dueDate !== (invoice.due_date ?? "") && saveField({ due_date: dueDate || null })}
                  readOnly={!isDraft}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <EntityLinksPanel kind="invoice" id={invoiceId} />
        <EntityBacklinksPanel kind="invoice" id={invoiceId} />
      </div>

      <ImportLinesDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={projectId}
        invoiceId={invoiceId}
        currency={currency}
        onImported={async () => {
          await recalc.mutateAsync({ invoice_id: invoiceId });
          setImportOpen(false);
        }}
      />
    </div>
  );
}

function ImportLinesDialog({
  open,
  onOpenChange,
  projectId,
  invoiceId,
  currency,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  invoiceId: string;
  currency: string;
  onImported: () => void;
}) {
  const { data: logs = [] } = useProjectTimeLogs(projectId);
  const { data: milestones = [] } = useMilestones(projectId);
  const { data: members = [] } = useTeamMembers();
  const { data: expenses = [] } = useExpenses({ project_id: projectId, status: "approved" });
  const { data: financials } = useProjectFinancials(projectId);
  const upsertLine = useUpsertLineItem();

  const [selectedTimeIds, setSelectedTimeIds] = useState<Set<string>>(new Set());
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<Set<string>>(new Set());
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

  const memberById = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const defaultBill = Number(financials?.default_bill_rate ?? 0);

  // Aggregate time logs per user (uninvoiced billable only)
  const timeGroups = useMemo(() => {
    const billable = logs.filter((l) => l.is_billable);
    const byUser = new Map<string, { user_id: string; hours: number; rate: number }>();
    for (const l of billable) {
      const rate = Number(l.hourly_rate_snapshot ?? memberById.get(l.user_id)?.hourly_bill_rate ?? defaultBill ?? 0);
      const entry = byUser.get(l.user_id) ?? { user_id: l.user_id, hours: 0, rate };
      entry.hours += Number(l.hours);
      byUser.set(l.user_id, entry);
    }
    return Array.from(byUser.values()).filter((e) => e.hours > 0);
  }, [logs, memberById, defaultBill]);

  const completedPayments = milestones.filter(
    (m) => m.milestone_type === "payment" && m.status === "completed" && !m.is_paid,
  );

  const importSelected = async () => {
    let order = 0;
    let added = 0;
    for (const g of timeGroups) {
      if (!selectedTimeIds.has(g.user_id)) continue;
      const member = memberById.get(g.user_id);
      await upsertLine.mutateAsync({
        invoice_id: invoiceId,
        description: `${`Team ${g.user_id.slice(0,6)}`} — billable hours`,
        quantity: +g.hours.toFixed(2),
        unit_price: g.rate,
        source_kind: "time",
        source_id: g.user_id,
        sort_order: order++,
      });
      added++;
    }
    for (const m of completedPayments) {
      if (!selectedMilestoneIds.has(m.id)) continue;
      await upsertLine.mutateAsync({
        invoice_id: invoiceId,
        description: `Milestone: ${m.name}`,
        quantity: 1,
        unit_price: Number(m.payment_amount ?? 0),
        source_kind: "milestone",
        source_id: m.id,
        sort_order: order++,
      });
      added++;
    }
    for (const e of expenses) {
      if (!selectedExpenseIds.has(e.id)) continue;
      await upsertLine.mutateAsync({
        invoice_id: invoiceId,
        description: `Expense: ${e.description}`,
        quantity: 1,
        unit_price: Number(e.amount),
        source_kind: "expense",
        source_id: e.id,
        sort_order: order++,
      });
      added++;
    }
    if (added > 0) toast.success(`Added ${added} line item${added === 1 ? "" : "s"}`);
    onImported();
  };

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import billable items</DialogTitle>
          <DialogDescription>
            Pull billable time, completed payment milestones, and approved expenses into this invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto py-2">
          <Section icon={<Clock className="h-4 w-4" />} title="Billable time">
            {timeGroups.length === 0 ? (
              <Empty text="No billable hours logged." />
            ) : (
              timeGroups.map((g) => {
                const member = memberById.get(g.user_id);
                const amount = g.hours * g.rate;
                return (
                  <Row
                    key={g.user_id}
                    checked={selectedTimeIds.has(g.user_id)}
                    onToggle={() => toggle(selectedTimeIds, g.user_id, setSelectedTimeIds)}
                    label={`Team ${g.user_id.slice(0,6)}`}
                    sublabel={`${g.hours.toFixed(1)}h @ ${formatMoney(g.rate, currency)}/h`}
                    amount={formatMoney(amount, currency)}
                  />
                );
              })
            )}
          </Section>

          <Section icon={<Flag className="h-4 w-4" />} title="Completed payment milestones">
            {completedPayments.length === 0 ? (
              <Empty text="No unbilled completed milestones." />
            ) : (
              completedPayments.map((m) => (
                <Row
                  key={m.id}
                  checked={selectedMilestoneIds.has(m.id)}
                  onToggle={() => toggle(selectedMilestoneIds, m.id, setSelectedMilestoneIds)}
                  label={m.name}
                  sublabel={m.target_date ? `Completed · due ${format(new Date(m.target_date), "MMM d")}` : "Completed"}
                  amount={formatMoney(Number(m.payment_amount ?? 0), currency)}
                />
              ))
            )}
          </Section>

          <Section icon={<Receipt className="h-4 w-4" />} title="Approved expenses">
            {expenses.length === 0 ? (
              <Empty text="No approved expenses." />
            ) : (
              expenses.map((e) => (
                <Row
                  key={e.id}
                  checked={selectedExpenseIds.has(e.id)}
                  onToggle={() => toggle(selectedExpenseIds, e.id, setSelectedExpenseIds)}
                  label={e.description}
                  sublabel={`${e.category} · ${format(new Date(e.incurred_on), "MMM d, yyyy")}`}
                  amount={formatMoney(Number(e.amount), e.currency)}
                />
              ))
            )}
          </Section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={importSelected}>Add selected</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </h3>
      <div className="space-y-1 rounded-lg border border-border">{children}</div>
    </div>
  );
}

function Row({
  checked,
  onToggle,
  label,
  sublabel,
  amount,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  sublabel: string;
  amount: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent/40">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{label}</div>
        <div className="truncate text-xs text-muted-foreground">{sublabel}</div>
      </div>
      <div className="text-sm font-medium">{amount}</div>
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-3 py-4 text-center text-xs text-muted-foreground">{text}</div>;
}
