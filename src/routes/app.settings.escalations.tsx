import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { NavAccessGuard } from "@/components/app/NavAccessGuard";
import {
  useEscalationRules,
  useUpsertEscalationRule,
  useDeleteEscalationRule,
} from "@/hooks/use-escalations";
import { TIER_COLORS, TIER_LABELS } from "@/lib/escalation-types";
import type { EscalationRule } from "@/lib/escalation-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Sparkles } from "lucide-react";
import { seedDefaultEscalationRules } from "@/lib/escalations.functions";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/escalations")({
  component: () => (
    <NavAccessGuard navKey="escalations">
      <EscalationRulesPage />
    </NavAccessGuard>
  ),
});

type Editable = Partial<EscalationRule> & { name: string; tier: number };

function EscalationRulesPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: rules = [], isLoading, refetch } = useEscalationRules();
  const upsert = useUpsertEscalationRule();
  const del = useDeleteEscalationRule();
  const seed = useServerFn(seedDefaultEscalationRules);
  const [editing, setEditing] = useState<Editable | null>(null);

  const onSeed = async () => {
    if (!ws) return;
    const res = await seed({ data: { workspace_id: ws.id } });
    if (res.ok) {
      toast.success(`Seeded ${res.created} default rules`);
      refetch();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="animate-page-in mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="bg-aura-gradient bg-clip-text text-2xl font-semibold text-transparent">
            Escalation rules
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tiered automation (L1 → L5). Rules are evaluated against project signals (overdue
            tasks, schedule slip, health, target end dates) and create escalations when matched.
          </p>
        </div>
        <div className="flex gap-2">
          {rules.length === 0 && (
            <Button variant="outline" onClick={onSeed}>
              <Sparkles className="mr-2 h-4 w-4" /> Seed defaults
            </Button>
          )}
          <Button
            onClick={() =>
              setEditing({
                name: "",
                tier: 1,
                conditions: {},
                actions: {},
                cooldown_hours: 24,
                is_active: true,
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" /> New rule
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && rules.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No rules yet. Seed defaults or create your first one.
          </div>
        )}
        {rules.map((r) => {
          const tier = r.tier as 1 | 2 | 3 | 4 | 5;
          return (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-xl border bg-card p-4"
              style={{ borderLeftColor: TIER_COLORS[tier], borderLeftWidth: 4 }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" style={{ borderColor: TIER_COLORS[tier] }}>
                    {TIER_LABELS[tier]}
                  </Badge>
                  <span className="font-medium">{r.name}</span>
                  {!r.is_active && (
                    <Badge variant="secondary" className="text-[10px]">paused</Badge>
                  )}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  Conditions: {summariseConditions(r)} · Cooldown: {r.cooldown_hours}h
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={r.is_active}
                  onCheckedChange={(v) =>
                    upsert.mutate({ id: r.id, name: r.name, tier: r.tier, is_active: v })
                  }
                />
                <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Delete rule "${r.name}"?`)) del.mutate(r.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <RuleEditor
          rule={editing}
          onClose={() => setEditing(null)}
          onSave={(r) => {
            upsert.mutate(r, { onSuccess: () => setEditing(null) });
          }}
        />
      )}
    </div>
  );
}

function summariseConditions(r: EscalationRule): string {
  const c = r.conditions || {};
  const bits: string[] = [];
  if (c.days_overdue) bits.push(`${c.days_overdue}d overdue`);
  if (c.schedule_slip_days) bits.push(`${c.schedule_slip_days}d task slip`);
  if (c.client_deliverable_overdue) bits.push("client deliverable overdue");
  if (c.consecutive_l1_alerts) bits.push("health off-track");
  if (c.budget_overrun_percent) bits.push(`>${c.budget_overrun_percent}% budget`);
  if (c.margin_below_percent) bits.push(`margin <${c.margin_below_percent}%`);
  return bits.join(" · ") || "none";
}

function RuleEditor({
  rule,
  onClose,
  onSave,
}: {
  rule: Editable;
  onClose: () => void;
  onSave: (r: Editable) => void;
}) {
  const [r, setR] = useState<Editable>({ ...rule });
  const c = r.conditions ?? {};
  const setCond = (patch: Partial<typeof c>) =>
    setR({ ...r, conditions: { ...c, ...patch } });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule.id ? "Edit rule" : "New rule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tier (1–5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={r.tier}
                onChange={(e) => setR({ ...r, tier: (Math.max(1, Math.min(5, Number(e.target.value) || 1)) as 1 | 2 | 3 | 4 | 5) })}
              />
            </div>
            <div>
              <Label>Cooldown (hours)</Label>
              <Input
                type="number"
                min={1}
                value={r.cooldown_hours ?? 24}
                onChange={(e) => setR({ ...r, cooldown_hours: Number(e.target.value) || 24 })}
              />
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Trigger when ANY apply
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Days past target end ≥</Label>
                <Input
                  type="number"
                  value={c.days_overdue ?? ""}
                  onChange={(e) => setCond({ days_overdue: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div>
                <Label className="text-xs">Worst task slip (days) ≥</Label>
                <Input
                  type="number"
                  value={c.schedule_slip_days ?? ""}
                  onChange={(e) => setCond({ schedule_slip_days: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Switch
                id="cd"
                checked={!!c.client_deliverable_overdue}
                onCheckedChange={(v) => setCond({ client_deliverable_overdue: v || undefined })}
              />
              <Label htmlFor="cd" className="text-xs">Any client deliverable is overdue</Label>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Switch
                id="health"
                checked={!!c.consecutive_l1_alerts}
                onCheckedChange={(v) => setCond({ consecutive_l1_alerts: v ? 1 : undefined })}
              />
              <Label htmlFor="health" className="text-xs">Project health is at-risk or off-track</Label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={r.is_active ?? true}
              onCheckedChange={(v) => setR({ ...r, is_active: v })}
            />
            <Label className="text-xs">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!r.name.trim()} onClick={() => onSave(r)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
