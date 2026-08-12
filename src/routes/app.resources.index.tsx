import { createFileRoute } from "@tanstack/react-router";
import { NavAccessGuard } from "@/components/app/NavAccessGuard";
import { useMemo, useState } from "react";
import {
  useResources,
  useUpsertResource,
  useDeleteResource,
  useAllocations,
} from "@/hooks/use-resources";
import { useTeamMembers } from "@/hooks/use-team";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  RESOURCE_TYPE_LABELS,
  utilizationColor,
  utilizationLabel,
  type Resource,
  type ResourceType,
} from "@/lib/resource-types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, User, Users, Bot, Building2, Sparkles, Search } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { format, startOfWeek, endOfWeek } from "date-fns";

export const Route = createFileRoute("/app/resources/")({
  component: () => <NavAccessGuard navKey="resources"><ResourcesPage /></NavAccessGuard>,
});

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

function ResourcesPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: resources = [], isLoading } = useResources();
  const { data: team = [] } = useTeamMembers();
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const { data: allocations = [] } = useAllocations({
    from: format(weekStart, "yyyy-MM-dd"),
    to: format(weekEnd, "yyyy-MM-dd"),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["resources-team-profiles", ws?.id, team.map((t) => t.user_id).join(",")],
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

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ResourceType | "employee">("all");
  const [editing, setEditing] = useState<Resource | null>(null);
  const [creating, setCreating] = useState(false);

  // Build a unified list of "people" for the directory
  type DirectoryEntry = {
    key: string;
    kind: "team_member" | "resource";
    name: string;
    role: string | null;
    type: ResourceType | "employee";
    capacityHours: number;
    bill_rate: number | null;
    cost_rate: number | null;
    avatar_url: string | null;
    isActive: boolean;
    resource?: Resource;
  };

  const entries: DirectoryEntry[] = useMemo(() => {
    const list: DirectoryEntry[] = [];
    for (const tm of team) {
      const profile = profiles.find((p) => p.id === tm.user_id);
      list.push({
        key: `tm:${tm.user_id}`,
        kind: "team_member",
        name: profile?.display_name ?? "Team member",
        role: tm.role ?? null,
        type: "employee",
        capacityHours: Number(tm.weekly_capacity_hours ?? 40),
        bill_rate: tm.hourly_bill_rate != null ? Number(tm.hourly_bill_rate) : null,
        cost_rate: tm.hourly_cost != null ? Number(tm.hourly_cost) : null,
        avatar_url: profile?.avatar_url ?? null,
        isActive: tm.is_active,
      });
    }
    for (const r of resources) {
      list.push({
        key: `r:${r.id}`,
        kind: "resource",
        name: r.name,
        role: r.role,
        type: r.type,
        capacityHours: r.weekly_capacity_hours,
        bill_rate: r.bill_rate_amount != null ? Number(r.bill_rate_amount) : null,
        cost_rate: r.cost_rate_amount != null ? Number(r.cost_rate_amount) : null,
        avatar_url: r.avatar_url,
        isActive: r.is_active,
        resource: r,
      });
    }
    return list;
  }, [team, resources, profiles]);

  const filtered = entries.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        !e.name.toLowerCase().includes(q) &&
        !(e.role ?? "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  // Compute weekly utilization per entry from allocations (rough: percentage * capacity / 100)
  const utilization = (entry: DirectoryEntry): number => {
    const allocs = allocations.filter((a) => {
      if (entry.kind === "team_member") return a.team_member_user_id === entry.key.slice(3);
      return a.resource_id === entry.key.slice(2);
    });
    let hours = 0;
    for (const a of allocs) {
      if (a.allocation_type === "full_time") hours += entry.capacityHours;
      else if (a.allocation_type === "percentage")
        hours += (entry.capacityHours * (a.percentage ?? 0)) / 100;
      else if (a.allocation_type === "fixed_hours")
        hours += Number(a.fixed_hours ?? 0);
    }
    if (entry.capacityHours === 0) return 0;
    return Math.round((hours / entry.capacityHours) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{ws?.name}</div>
            <h1 className="text-lg font-semibold lg:text-xl">Team & resources</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-56 pl-8"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="employee">Employees</SelectItem>
              <SelectItem value="contractor">Contractors</SelectItem>
              <SelectItem value="ai_agent">AI agents</SelectItem>
              <SelectItem value="vendor">Vendors</SelectItem>
              <SelectItem value="external">External</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add resource
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No resources yet"
            description="Track team members, contractors, AI agents, and vendors so you can plan capacity and allocate them to projects."
            primaryAction={{ label: "Add your first resource", onClick: () => setCreating(true) }}
            secondaryAction={{ label: "Invite teammates", to: "/app/settings/members" }}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((e) => {
              const util = utilization(e);
              return (
                <button
                  key={e.key}
                  onClick={() => e.resource && setEditing(e.resource)}
                  disabled={e.kind === "team_member"}
                  className="rounded-lg border border-border bg-card p-4 text-left transition hover:shadow disabled:cursor-default"
                >
                  <div className="flex items-start gap-3">
                    <TypeAvatar type={e.type} avatar={e.avatar_url} name={e.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{e.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {e.type === "employee" ? "Employee" : RESOURCE_TYPE_LABELS[e.type as ResourceType]}
                        </Badge>
                        {!e.isActive && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                      </div>
                      {e.role && <div className="truncate text-xs text-muted-foreground">{e.role}</div>}
                      <div className="mt-1.5 text-xs text-muted-foreground">
                        {e.bill_rate != null && <>${e.bill_rate}/h bill</>}
                        {e.bill_rate != null && e.cost_rate != null && " · "}
                        {e.cost_rate != null && <>${e.cost_rate}/h cost</>}
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>This week</span>
                          <span>{utilizationLabel(util)} · {e.capacityHours}h cap</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${utilizationColor(util)}`}
                            style={{ width: `${Math.min(util, 150)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <ResourceDialog
          resource={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TypeAvatar({ type, avatar, name }: { type: ResourceType | "employee"; avatar: string | null; name: string }) {
  if (avatar) {
    return <img src={avatar} alt={name} className="h-10 w-10 rounded-full object-cover" />;
  }
  const Icon = type === "ai_agent" ? Bot : type === "vendor" ? Building2 : type === "external" ? Sparkles : User;
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Icon className="h-5 w-5" />
    </div>
  );
}

function ResourceDialog({ resource, onClose }: { resource: Resource | null; onClose: () => void }) {
  const upsert = useUpsertResource();
  const remove = useDeleteResource();
  const [form, setForm] = useState({
    name: resource?.name ?? "",
    type: (resource?.type ?? "contractor") as ResourceType,
    role: resource?.role ?? "",
    department: resource?.department ?? "",
    email: resource?.email ?? "",
    weekly_capacity_hours: String(resource?.weekly_capacity_hours ?? 40),
    cost_rate_amount: resource?.cost_rate_amount?.toString() ?? "",
    bill_rate_amount: resource?.bill_rate_amount?.toString() ?? "",
    billable: resource?.billable ?? true,
    is_active: resource?.is_active ?? true,
    skills: (resource?.skills ?? []).join(", "),
    notes: resource?.notes ?? "",
  });

  const save = async () => {
    if (!form.name.trim()) return;
    await upsert.mutateAsync({
      id: resource?.id,
      name: form.name.trim(),
      type: form.type,
      role: form.role.trim() || null,
      department: form.department.trim() || null,
      email: form.email.trim() || null,
      weekly_capacity_hours: Number(form.weekly_capacity_hours) || 40,
      cost_rate_amount: form.cost_rate_amount ? Number(form.cost_rate_amount) : null,
      bill_rate_amount: form.bill_rate_amount ? Number(form.bill_rate_amount) : null,
      billable: form.billable,
      is_active: form.is_active,
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      notes: form.notes.trim() || null,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{resource ? "Edit resource" : "Add resource"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ResourceType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="ai_agent">AI agent</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Senior Engineer" />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Capacity (h/wk)</Label>
              <Input
                type="number"
                value={form.weekly_capacity_hours}
                onChange={(e) => setForm({ ...form, weekly_capacity_hours: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cost rate ($/h)</Label>
              <Input
                type="number"
                value={form.cost_rate_amount}
                onChange={(e) => setForm({ ...form, cost_rate_amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bill rate ($/h)</Label>
              <Input
                type="number"
                value={form.bill_rate_amount}
                onChange={(e) => setForm({ ...form, bill_rate_amount: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Skills (comma-separated)</Label>
            <Input
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
              placeholder="React, Node, AWS"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.billable} onCheckedChange={(v) => setForm({ ...form, billable: v })} />
              Billable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              Active
            </label>
          </div>
        </div>
        <DialogFooter>
          {resource && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={async () => {
                await remove.mutateAsync(resource.id);
                onClose();
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!form.name.trim() || upsert.isPending}>
            {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {resource ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
