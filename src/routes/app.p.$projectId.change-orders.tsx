import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  useChangeOrders,
  useCreateChangeOrder,
  useUpdateChangeOrder,
  useDeleteChangeOrder,
  applyChangeOrderToProject,
} from "@/hooks/use-change-orders";
import { CO_STATUS_META, type ChangeOrder, type ChangeOrderStatus } from "@/lib/change-order-types";
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
} from "@/components/ui/dialog";
import { Loader2, Plus, FileEdit, Trash2, CheckCircle2, XCircle, Send, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/p/$projectId/change-orders")({
  component: ChangeOrdersPage,
});

function ChangeOrdersPage() {
  const { projectId } = Route.useParams();
  const { data: orders = [], isLoading } = useChangeOrders(projectId);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ChangeOrder | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalCost = orders
    .filter((o) => o.status === "approved" || o.status === "applied")
    .reduce((s, o) => s + Number(o.cost_impact ?? 0), 0);
  const totalDays = orders
    .filter((o) => o.status === "approved" || o.status === "applied")
    .reduce((s, o) => s + (o.timeline_impact_days ?? 0), 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Change orders</div>
            <h1 className="text-lg font-semibold lg:text-xl">Scope changes</h1>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> New change order
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
          <Stat label="Total" value={String(orders.length)} />
          <Stat label="Approved cost impact" value={`$${totalCost.toLocaleString()}`} />
          <Stat label="Approved timeline impact" value={`${totalDays > 0 ? "+" : ""}${totalDays}d`} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No change orders yet. Use these to track scope, cost, and timeline shifts mid-project.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((co) => (
              <button
                key={co.id}
                onClick={() => setEditing(co)}
                className="w-full rounded-lg border border-border bg-card p-4 text-left transition hover:shadow"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">CO-{co.number}</span>
                      <Badge className={CO_STATUS_META[co.status].color}>
                        {CO_STATUS_META[co.status].label}
                      </Badge>
                    </div>
                    <div className="mt-1 truncate font-medium">{co.title}</div>
                    {co.description && (
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{co.description}</div>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="text-base font-semibold text-foreground">
                      {co.cost_impact >= 0 ? "+" : ""}${Number(co.cost_impact).toLocaleString()}
                    </div>
                    <div>
                      {co.timeline_impact_days >= 0 ? "+" : ""}
                      {co.timeline_impact_days}d
                    </div>
                    <div className="mt-1">{format(new Date(co.created_at), "MMM d")}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <ChangeOrderDialog
          projectId={projectId}
          order={null}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <ChangeOrderDialog
          projectId={projectId}
          order={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold">{value}</div>
    </div>
  );
}

function ChangeOrderDialog({
  projectId,
  order,
  onClose,
}: {
  projectId: string;
  order: ChangeOrder | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const create = useCreateChangeOrder(projectId);
  const update = useUpdateChangeOrder(projectId);
  const remove = useDeleteChangeOrder(projectId);
  const [form, setForm] = useState({
    title: order?.title ?? "",
    description: order?.description ?? "",
    reason: order?.reason ?? "",
    cost_impact: String(order?.cost_impact ?? 0),
    timeline_impact_days: String(order?.timeline_impact_days ?? 0),
  });

  const save = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      reason: form.reason.trim() || null,
      cost_impact: Number(form.cost_impact) || 0,
      timeline_impact_days: Number(form.timeline_impact_days) || 0,
    };
    if (order) await update.mutateAsync({ id: order.id, ...payload });
    else await create.mutateAsync(payload);
    onClose();
  };

  const setStatus = async (status: ChangeOrderStatus, extra: Partial<ChangeOrder> = {}) => {
    if (!order) return;
    await update.mutateAsync({ id: order.id, status, ...extra });
  };

  const submitForReview = () => setStatus("pending_internal");
  const internalApprove = () =>
    setStatus("pending_client", {
      internal_approved_by: user?.id ?? null,
      internal_approved_at: new Date().toISOString(),
    });
  const clientApprove = () =>
    setStatus("approved", {
      client_approved_at: new Date().toISOString(),
    });
  const reject = async () => {
    const reason = window.prompt("Rejection reason?") ?? "";
    await setStatus("rejected", { rejected_at: new Date().toISOString(), rejection_reason: reason });
  };
  const apply = async () => {
    if (!order) return;
    await applyChangeOrderToProject(order);
    await setStatus("applied", { applied_at: new Date().toISOString() });
    toast.success("Applied to project — contract value updated");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {order ? `CO-${order.number} · ${CO_STATUS_META[order.status].label}` : "New change order"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cost impact</Label>
              <Input
                type="number"
                value={form.cost_impact}
                onChange={(e) => setForm({ ...form, cost_impact: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Timeline impact (days)</Label>
              <Input
                type="number"
                value={form.timeline_impact_days}
                onChange={(e) => setForm({ ...form, timeline_impact_days: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input
              placeholder="e.g. Client requested additional pages"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What's changing, why, and what's affected…"
            />
          </div>

          {order && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
              <div className="font-semibold">Approval flow</div>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li>
                  Internal:{" "}
                  {order.internal_approved_at
                    ? `✓ ${format(new Date(order.internal_approved_at), "MMM d, h:mm a")}`
                    : "—"}
                </li>
                <li>
                  Client:{" "}
                  {order.client_approved_at
                    ? `✓ ${format(new Date(order.client_approved_at), "MMM d, h:mm a")}`
                    : "—"}
                </li>
                {order.applied_at && (
                  <li>Applied: ✓ {format(new Date(order.applied_at), "MMM d, h:mm a")}</li>
                )}
                {order.rejection_reason && <li>Rejection: {order.rejection_reason}</li>}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {order && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={async () => {
                await remove.mutateAsync(order.id);
                onClose();
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          )}
          {order?.status === "draft" && (
            <Button variant="outline" onClick={submitForReview}>
              <Send className="mr-2 h-4 w-4" /> Submit
            </Button>
          )}
          {order?.status === "pending_internal" && (
            <>
              <Button variant="outline" onClick={reject}>
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
              <Button onClick={internalApprove}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Internal approve
              </Button>
            </>
          )}
          {order?.status === "pending_client" && (
            <>
              <Button variant="outline" onClick={reject}>
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
              <Button onClick={clientApprove}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark client approved
              </Button>
            </>
          )}
          {order?.status === "approved" && (
            <Button onClick={apply}>
              <Sparkles className="mr-2 h-4 w-4" /> Apply to project
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={save} disabled={!form.title.trim()}>
            <FileEdit className="mr-2 h-4 w-4" /> {order ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
