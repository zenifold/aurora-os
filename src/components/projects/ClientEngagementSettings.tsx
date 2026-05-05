import { useState, useEffect } from "react";
import { useUpdateProject } from "@/hooks/use-projects";
import type { Project } from "@/lib/types";
import { PROJECT_PHASES, PROJECT_HEALTH, CONTRACT_TYPES } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Briefcase } from "lucide-react";
import { toast } from "sonner";

export function ClientEngagementSettings({ project }: { project: Project }) {
  const update = useUpdateProject();
  const [form, setForm] = useState({
    is_client_project: project.is_client_project ?? false,
    client_name: project.client_name ?? "",
    phase: project.phase ?? "discovery",
    health: project.health ?? "on_track",
    contract_type: project.contract_type ?? "tm",
    target_margin_pct: project.target_margin_pct ?? 30,
    start_date: project.start_date ?? "",
    target_end_date: project.target_end_date ?? "",
  });

  useEffect(() => {
    setForm({
      is_client_project: project.is_client_project ?? false,
      client_name: project.client_name ?? "",
      phase: project.phase ?? "discovery",
      health: project.health ?? "on_track",
      contract_type: project.contract_type ?? "tm",
      target_margin_pct: project.target_margin_pct ?? 30,
      start_date: project.start_date ?? "",
      target_end_date: project.target_end_date ?? "",
    });
  }, [project.id]);

  const save = async () => {
    await update.mutateAsync({
      id: project.id,
      ...form,
      client_name: form.client_name || null,
      start_date: form.start_date || null,
      target_end_date: form.target_end_date || null,
    });
    toast.success("Project settings saved");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex gap-3">
          <Briefcase className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <Label className="text-sm font-medium">Client engagement</Label>
            <p className="text-xs text-muted-foreground">
              Show this project in the Delivery command center.
            </p>
          </div>
        </div>
        <Switch
          checked={form.is_client_project}
          onCheckedChange={(v) => setForm({ ...form, is_client_project: v })}
        />
      </div>

      {form.is_client_project && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Client name">
              <Input
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="Acme Corp"
              />
            </Field>
            <Field label="Contract type">
              <Select
                value={form.contract_type}
                onValueChange={(v) => setForm({ ...form, contract_type: v as typeof form.contract_type })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_TYPES).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Phase">
              <Select
                value={form.phase}
                onValueChange={(v) => setForm({ ...form, phase: v as typeof form.phase })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_PHASES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Health">
              <Select
                value={form.health}
                onValueChange={(v) => setForm({ ...form, health: v as typeof form.health })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROJECT_HEALTH) as (keyof typeof PROJECT_HEALTH)[]).map((k) => (
                    <SelectItem key={k} value={k}>{PROJECT_HEALTH[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Start date">
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </Field>
            <Field label="Target end date">
              <Input
                type="date"
                value={form.target_end_date}
                onChange={(e) => setForm({ ...form, target_end_date: e.target.value })}
              />
            </Field>
            <Field label="Target margin %">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.target_margin_pct}
                onChange={(e) =>
                  setForm({ ...form, target_margin_pct: Number(e.target.value) })
                }
              />
            </Field>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
