import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus, FileText, Receipt, Trash2 } from "lucide-react";
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
import { useProject } from "@/hooks/use-projects";
import { useInvoices, useCreateInvoice, useDeleteInvoice } from "@/hooks/use-invoices";
import { formatMoney } from "@/lib/financial-types";
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/invoice-types";
import { useProjectFinancials } from "@/hooks/use-project-financials";
import { format } from "date-fns";

export const Route = createFileRoute("/app/p/$projectId/invoices")({
  component: InvoicesPage,
});

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  overdue: "bg-destructive/10 text-destructive",
  void: "bg-muted text-muted-foreground line-through",
};

function InvoicesPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: financials } = useProjectFinancials(projectId);
  const { data: invoices = [], isLoading } = useInvoices({ project_id: projectId });
  const create = useCreateInvoice();
  const del = useDeleteInvoice();

  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const navigate = Route.useNavigate();

  const handleCreate = async () => {
    const inv = await create.mutateAsync({
      project_id: projectId,
      currency: financials?.currency ?? "USD",
      client_name: clientName || null,
      client_email: clientEmail || null,
      due_date: dueDate || null,
    });
    setOpen(false);
    setClientName("");
    setClientEmail("");
    setDueDate("");
    navigate({
      to: "/app/p/$projectId/invoices/$invoiceId",
      params: { projectId, invoiceId: inv.id },
    });
  };

  const totalOutstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.total) - Number(i.amount_paid), 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.total), 0);
  const currency = financials?.currency ?? "USD";

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
            Invoices
          </h1>
          <p className="text-sm text-muted-foreground">{project?.name}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New invoice
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create draft invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label htmlFor="client-name">Client name</Label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <Label htmlFor="client-email">Client email</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="billing@acme.com"
                />
              </div>
              <div>
                <Label htmlFor="due-date">Due date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={create.isPending}>
                Create draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatMoney(totalOutstanding, currency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatMoney(totalPaid, currency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{invoices.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : invoices.length === 0 ? (
            <div className="p-10 text-center">
              <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="mb-3 text-sm text-muted-foreground">No invoices yet.</p>
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create your first invoice
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <Link
                    to="/app/p/$projectId/invoices/$invoiceId"
                    params={{ projectId, invoiceId: inv.id }}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{inv.invoice_number}</span>
                      <Badge variant="outline" className={STATUS_COLOR[inv.status]}>
                        {INVOICE_STATUS_LABEL[inv.status]}
                      </Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {inv.client_name ?? "—"} · Issued {format(new Date(inv.issue_date), "MMM d, yyyy")}
                      {inv.due_date ? ` · Due ${format(new Date(inv.due_date), "MMM d")}` : ""}
                    </div>
                  </Link>
                  <div className="text-right">
                    <div className="font-medium">{formatMoney(Number(inv.total), inv.currency)}</div>
                    {inv.status === "sent" && Number(inv.amount_paid) > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        Paid {formatMoney(Number(inv.amount_paid), inv.currency)}
                      </div>
                    ) : null}
                  </div>
                  {inv.status === "draft" ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => del.mutate(inv.id)}
                      aria-label="Delete draft"
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
