import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "@/hooks/use-projects";
import {
  useAllocations,
  useResources,
  useUpsertAllocation,
  useDeleteAllocation,
} from "@/hooks/use-resources";
import { useTeamMembers } from "@/hooks/use-team";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Users, Pencil, User, Bot, Building2, Sparkles } from "lucide-react";
import type { AllocationStatus, AllocationType, ResourceAllocation } from "@/lib/resource-types";

export const Route = createFileRoute("/app/p/$projectId/allocations")({
  component: AllocationsPage,
});

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

function AllocationsPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const ws = useWorkspaceStore((s) => s.current);
  const { data: allocations = [] } = useAllocations({ projectId });
  const { data: resources = [] } = useResources();
  const { data: team = [] } = useTeamMembers();

  const { data: profiles = [] } = useQuery({
    queryKey: ["alloc-team-profiles", ws?.id, team.map((t) => t.user_id).join(",")],
    enabled: team.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", team.map((t) => t.user_id));
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const resourceMap = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const teamMap = useMemo(() => new Map(team.map((t) => [t.user_id, t])), [team]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceAllocation | null>(null);

  const isInternal = !project?.is_client_project;
  const defaultBillable = !isInternal;

  // Aggregates
  const totals = useMemo(() => {
    const active = allocations.filter((a) => a.status !== "cancelled");
    const billableCount = active.filter((a) => a.billable).length;
    const logged = allocations.reduce((s, a) => s + Number(a.actual_hours_logged || 0), 0);
    const fixedBudget = allocations
      .filter((a) => a.allocation_type === "fixed_hours")
      .reduce((s, a) => s + Number(a.fixed_hours || 0), 0);
    return { total: active.length, billableCount, logged, fixedBudget };
  }, [allocations]);

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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Resource allocations</span>
            <Badge variant="outline" className="text-[10px]">
              {isInternal ? "Internal project" : "Billable engagement"}
            </Badge>
          </div>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Assign person
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Kpi label="Assigned" value={String(totals.total)} sub={`${totals.billableCount} billable`} />
          <Kpi label="Logged" value={`${totals.logged.toFixed(1)}h`} />
          <Kpi label="Fixed-hour budget" value={`${totals.fixedBudget.toFixed(0)}h`} />
          <Kpi label="Mode" value={isInternal ? "Cost-only" : "Bill + cost"} />
        </div>

        {allocations.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-2 p-12 text-muted-foreground">
            <Users className="h-8 w-8" />
            <p className="text-sm">No one assigned to this project yet.</p>
            <Button variant="outline" size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Assign first person
            </Button>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Person</th>
                  <th className="px-3 py-2 text-left">Allocation</th>
                  <th className="px-3 py-2 text-left">Period</th>
                  <th className="px-3 py-2 text-left">Billable</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Logged</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => {
                  const r = a.resource_id ? resourceMap.get(a.resource_id) : null;
                  const tm = a.team_member_user_id ? teamMap.get(a.team_member_user_id) : null;
                  const tmProfile = a.team_member_user_id ? profileMap.get(a.team_member_user_id) : null;
                  const name = r?.name ?? tmProfile?.display_name ?? "—";
                  const role = r?.role ?? tm?.role ?? null;
                  const kindIcon = r
                    ? r.type === "ai_agent" ? <Bot className="h-3.5 w-3.5" />
                    : r.type === "vendor" ? <Building2 className="h-3.5 w-3.5" />
                    : r.type === "external" ? <Sparkles className="h-3.5 w-3.5" />
                    : <User className="h-3.5 w-3.5" />
                    : <User className="h-3.5 w-3.5" />;
                  const allocLabel =
                    a.allocation_type === "percentage" ? `${a.percentage ?? 0}%`
                    : a.allocation_type === "fixed_hours" ? `${a.fixed_hours ?? 0}h total`
                    : a.allocation_type === "full_time" ? "Full time"
                    : "Scheduled";
                  return (
                    <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{kindIcon}</span>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{name}</div>
                            {role && <div className="text-xs text-muted-foreground truncate">{role}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">{allocLabel}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {a.start_date} {a.end_date ? `→ ${a.end_date}` : "→ ongoing"}
                      </td>
                      <td className="px-3 py-2">
                        {a.billable ? (
                          <Badge variant="secondary">
                            ${a.bill_rate_override ?? (r?.bill_rate_amount ?? tm?.hourly_bill_rate ?? "—")}/h
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Non-billable</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="capitalize">{a.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{a.actual_hours_logged}h</td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setOpen(true); }} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {open && (
        <AllocationDialog
          projectId={projectId}
          existing={editing}
          defaultBillable={defaultBillable}
          onClose={() => { setOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

interface DialogProps {
  projectId: string;
  existing: ResourceAllocation | null;
  defaultBillable: boolean;
  onClose: () => void;
}

function AllocationDialog({ projectId, existing, defaultBillable, onClose }: DialogProps) {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: resources = [] } = useResources();
  const { data: team = [] } = useTeamMembers();
  const upsert = useUpsertAllocation();
  const del = useDeleteAllocation();

  const { data: profiles = [] } = useQuery({
    queryKey: ["alloc-dialog-profiles", ws?.id, team.map((t) => t.user_id).join(",")],
    enabled: team.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", team.map((t) => t.user_id));
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  // Assignee picker: encode as "tm:<user_id>" or "r:<resource_id>"
  const initialAssignee = existing
    ? existing.team_member_user_id
      ? `tm:${existing.team_member_user_id}`
      : existing.resource_id ? `r:${existing.resource_id}` : ""
    : "";

  const [assignee, setAssignee] = useState(initialAssignee);
  const [form, setForm] = useState({
    allocation_type: (existing?.allocation_type ?? "percentage") as AllocationType,
    percentage: existing?.percentage ?? 50,
    fixed_hours: existing?.fixed_hours ?? 0,
    start_date: existing?.start_date ?? new Date().toISOString().slice(0, 10),
    end_date: existing?.end_date ?? "",
    status: (existing?.status ?? "planned") as AllocationStatus,
    billable: existing?.billable ?? defaultBillable,
    bill_rate_override: existing?.bill_rate_override?.toString() ?? "",
    cost_rate_override: existing?.cost_rate_override?.toString() ?? "",
    notes: existing?.notes ?? "",
  });

  // When assignee changes, prefill bill/cost rate from their defaults if blank.
  useEffect(() => {
    if (!assignee) return;
    if (form.bill_rate_override || form.cost_rate_override) return;
    if (assignee.startsWith("tm:")) {
      const tm = team.find((t) => `tm:${t.user_id}` === assignee);
      if (tm) {
        setForm((f) => ({
          ...f,
          bill_rate_override: tm.hourly_bill_rate?.toString() ?? "",
          cost_rate_override: tm.hourly_cost?.toString() ?? "",
        }));
      }
    } else if (assignee.startsWith("r:")) {
      const r = resources.find((x) => `r:${x.id}` === assignee);
      if (r) {
        setForm((f) => ({
          ...f,
          billable: r.billable,
          bill_rate_override: r.bill_rate_amount?.toString() ?? "",
          cost_rate_override: r.cost_rate_amount?.toString() ?? "",
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignee]);

  const submit = async () => {
    if (!assignee) return;
    const [kind, id] = assignee.split(":");
    await upsert.mutateAsync({
      id: existing?.id,
      project_id: projectId,
      team_member_user_id: kind === "tm" ? id : null,
      resource_id: kind === "r" ? id : null,
      allocation_type: form.allocation_type,
      percentage: form.allocation_type === "percentage" ? Number(form.percentage) : null,
      fixed_hours: form.allocation_type === "fixed_hours" ? Number(form.fixed_hours) : null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      status: form.status,
      billable: form.billable,
      bill_rate_override: form.billable && form.bill_rate_override ? Number(form.bill_rate_override) : null,
      cost_rate_override: form.cost_rate_override ? Number(form.cost_rate_override) : null,
      notes: form.notes || null,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit allocation" : "Assign person to project"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Assignee *</Label>
            <Select value={assignee} onValueChange={setAssignee} disabled={!!existing}>
              <SelectTrigger><SelectValue placeholder="Pick a person or resource" /></SelectTrigger>
              <SelectContent>
                {team.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Team members</SelectLabel>
                    {team.filter((t) => t.is_active).map((t) => {
                      const p = profiles.find((x) => x.id === t.user_id);
                      return (
                        <SelectItem key={`tm:${t.user_id}`} value={`tm:${t.user_id}`}>
                          {p?.display_name ?? "Team member"} {t.role ? `· ${t.role}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                )}
                {resources.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Resources</SelectLabel>
                    {resources.filter((r) => r.is_active).map((r) => (
                      <SelectItem key={`r:${r.id}`} value={`r:${r.id}`}>
                        {r.name} {r.role ? `· ${r.role}` : ""} ({r.type.replace("_", " ")})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            {existing && <p className="text-xs text-muted-foreground">Assignee cannot be changed. Delete and re-create to reassign.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Allocation type</Label>
              <Select
                value={form.allocation_type}
                onValueChange={(v) => setForm({ ...form, allocation_type: v as AllocationType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">% of capacity</SelectItem>
                  <SelectItem value="fixed_hours">Fixed hour budget</SelectItem>
                  <SelectItem value="full_time">Full time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.allocation_type === "percentage" && (
              <div className="grid gap-1.5">
                <Label>Percentage</Label>
                <Input
                  type="number" min={0} max={100}
                  value={form.percentage}
                  onChange={(e) => setForm({ ...form, percentage: Number(e.target.value) })}
                />
              </div>
            )}
            {form.allocation_type === "fixed_hours" && (
              <div className="grid gap-1.5">
                <Label>Total hours</Label>
                <Input
                  type="number" min={0}
                  value={form.fixed_hours}
                  onChange={(e) => setForm({ ...form, fixed_hours: Number(e.target.value) })}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Start date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>End date (optional)</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>

          <div className="rounded-md border border-border p-3 space-y-3">
            <label className="flex items-center justify-between gap-2 text-sm">
              <div>
                <div className="font-medium">Billable to client</div>
                <div className="text-xs text-muted-foreground">
                  {defaultBillable ? "Default for this engagement" : "Internal project — usually off"}
                </div>
              </div>
              <Switch checked={form.billable} onCheckedChange={(v) => setForm({ ...form, billable: v })} />
            </label>
            {form.billable && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Bill rate ($/h)</Label>
                  <Input
                    type="number" min={0}
                    value={form.bill_rate_override}
                    onChange={(e) => setForm({ ...form, bill_rate_override: e.target.value })}
                    placeholder="Inherit default"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Cost rate ($/h)</Label>
                  <Input
                    type="number" min={0}
                    value={form.cost_rate_override}
                    onChange={(e) => setForm({ ...form, cost_rate_override: e.target.value })}
                    placeholder="Inherit default"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as AllocationStatus })}>
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

          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          {existing && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={async () => { await del.mutateAsync(existing.id); onClose(); }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Remove
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!assignee || upsert.isPending}>{existing ? "Save" : "Assign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
