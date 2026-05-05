import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useProject } from "@/hooks/use-projects";
import {
  useAllocations,
  useResources,
  useUpsertAllocation,
  useDeleteAllocation,
} from "@/hooks/use-resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Users } from "lucide-react";
import type { AllocationStatus, AllocationType } from "@/lib/resource-types";

export const Route = createFileRoute("/app/p/$projectId/allocations")({
  component: AllocationsPage,
});

function AllocationsPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: allocations = [] } = useAllocations({ projectId });
  const { data: resources = [] } = useResources();
  const upsert = useUpsertAllocation();
  const del = useDeleteAllocation();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    resource_id: "",
    allocation_type: "percentage" as AllocationType,
    percentage: 50,
    fixed_hours: 0,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    status: "planned" as AllocationStatus,
    notes: "",
  });

  const resourceMap = useMemo(
    () => new Map(resources.map((r) => [r.id, r])),
    [resources],
  );

  const reset = () =>
    setForm({
      resource_id: "",
      allocation_type: "percentage",
      percentage: 50,
      fixed_hours: 0,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: "",
      status: "planned",
      notes: "",
    });

  const submit = async () => {
    if (!form.resource_id) return;
    await upsert.mutateAsync({
      project_id: projectId,
      resource_id: form.resource_id,
      allocation_type: form.allocation_type,
      percentage: form.allocation_type === "percentage" ? form.percentage : null,
      fixed_hours: form.allocation_type === "fixed_hours" ? form.fixed_hours : null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      status: form.status,
      notes: form.notes || null,
    });
    setOpen(false);
    reset();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app/p/$projectId" params={{ projectId }}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{project?.name ?? "Project"}</h1>
          <p className="text-xs text-muted-foreground">Resource allocations</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" /> Allocate resource
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New allocation</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Resource</Label>
                <Select
                  value={form.resource_id}
                  onValueChange={(v) => setForm({ ...form, resource_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Pick a resource" /></SelectTrigger>
                  <SelectContent>
                    {resources.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} {r.role ? `· ${r.role}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Type</Label>
                  <Select
                    value={form.allocation_type}
                    onValueChange={(v) => setForm({ ...form, allocation_type: v as AllocationType })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed_hours">Fixed hours</SelectItem>
                      <SelectItem value="full_time">Full time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.allocation_type === "percentage" && (
                  <div className="grid gap-1.5">
                    <Label>% of capacity</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={form.percentage}
                      onChange={(e) => setForm({ ...form, percentage: Number(e.target.value) })}
                    />
                  </div>
                )}
                {form.allocation_type === "fixed_hours" && (
                  <div className="grid gap-1.5">
                    <Label>Total hours</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.fixed_hours}
                      onChange={(e) => setForm({ ...form, fixed_hours: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Start</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>End (optional)</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as AllocationStatus })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={!form.resource_id}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {allocations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Users className="h-8 w-8" />
            <p className="text-sm">No allocations yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Resource</th>
                  <th className="px-3 py-2 text-left">Allocation</th>
                  <th className="px-3 py-2 text-left">Period</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Logged</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => {
                  const r = a.resource_id ? resourceMap.get(a.resource_id) : null;
                  const allocLabel =
                    a.allocation_type === "percentage"
                      ? `${a.percentage ?? 0}%`
                      : a.allocation_type === "fixed_hours"
                      ? `${a.fixed_hours ?? 0}h`
                      : a.allocation_type === "full_time"
                      ? "Full time"
                      : "Scheduled";
                  return (
                    <tr key={a.id} className="border-t border-border">
                      <td className="px-3 py-2">{r?.name ?? "—"}</td>
                      <td className="px-3 py-2">{allocLabel}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {a.start_date} {a.end_date ? `→ ${a.end_date}` : "→ ongoing"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="capitalize">{a.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{a.actual_hours_logged}h</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => del.mutate(a.id)}
                          aria-label="Delete allocation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
