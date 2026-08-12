import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  listDealStages,
  upsertDealStage,
  deleteDealStage,
  reorderDealStages,
} from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Pencil,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/sales-stages")({
  component: SalesStagesPage,
});

type StageType = "open" | "won" | "lost";

const PRESETS: Array<{
  label: string;
  description: string;
  stages: Array<{ name: string; color: string; type: StageType; probability: number }>;
}> = [
  {
    label: "Classic B2B SaaS",
    description: "Lead → Qualified → Proposal → Negotiation → Won / Lost",
    stages: [
      { name: "Lead", color: "#94a3b8", type: "open", probability: 10 },
      { name: "Qualified", color: "#3b82f6", type: "open", probability: 25 },
      { name: "Proposal", color: "#a855f7", type: "open", probability: 50 },
      { name: "Negotiation", color: "#f59e0b", type: "open", probability: 75 },
      { name: "Won", color: "#10b981", type: "won", probability: 100 },
      { name: "Lost", color: "#ef4444", type: "lost", probability: 0 },
    ],
  },
  {
    label: "Agency / services",
    description: "Inquiry → Discovery → Scoping → SOW Sent → Signed → Lost",
    stages: [
      { name: "Inquiry", color: "#94a3b8", type: "open", probability: 10 },
      { name: "Discovery", color: "#0ea5e9", type: "open", probability: 30 },
      { name: "Scoping", color: "#8b5cf6", type: "open", probability: 50 },
      { name: "SOW Sent", color: "#f59e0b", type: "open", probability: 75 },
      { name: "Signed", color: "#10b981", type: "won", probability: 100 },
      { name: "Lost", color: "#ef4444", type: "lost", probability: 0 },
    ],
  },
  {
    label: "Enterprise sales",
    description: "Prospect → Discovery → Demo → POC → Procurement → Won / Lost",
    stages: [
      { name: "Prospect", color: "#94a3b8", type: "open", probability: 5 },
      { name: "Discovery", color: "#0ea5e9", type: "open", probability: 20 },
      { name: "Demo", color: "#3b82f6", type: "open", probability: 35 },
      { name: "Proof of Concept", color: "#8b5cf6", type: "open", probability: 55 },
      { name: "Procurement", color: "#f59e0b", type: "open", probability: 80 },
      { name: "Won", color: "#10b981", type: "won", probability: 100 },
      { name: "Lost", color: "#ef4444", type: "lost", probability: 0 },
    ],
  },
];

const TYPE_BADGE: Record<StageType, string> = {
  open: "bg-muted text-muted-foreground",
  won: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  lost: "bg-red-500/15 text-red-700 dark:text-red-300",
};

function SalesStagesPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  const list = useServerFn(listDealStages);
  const upsert = useServerFn(upsertDealStage);
  const del = useServerFn(deleteDealStage);
  const reorder = useServerFn(reorderDealStages);

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["deal-stages", ws?.id],
    queryFn: () => list({ data: { workspace_id: ws!.id } }),
    enabled: !!ws?.id,
  });

  const [editing, setEditing] = useState<null | {
    id?: string;
    name: string;
    color: string;
    stage_type: StageType;
    default_probability: number;
  }>(null);

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: editing?.id,
          workspace_id: ws!.id,
          name: editing!.name.trim(),
          color: editing!.color,
          stage_type: editing!.stage_type,
          default_probability: editing!.default_probability,
        },
      }),
    onSuccess: () => {
      toast.success("Stage saved");
      qc.invalidateQueries({ queryKey: ["deal-stages", ws?.id] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id, workspace_id: ws!.id } }),
    onSuccess: () => {
      toast.success("Stage deleted");
      qc.invalidateQueries({ queryKey: ["deal-stages", ws?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: (ordered: string[]) =>
      reorder({ data: { workspace_id: ws!.id, ordered_ids: ordered } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-stages", ws?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function moveStage(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= stages.length) return;
    const ids = stages.map((s) => s.id);
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    move.mutate(ids);
  }

  const applyPreset = useMutation({
    mutationFn: async (presetIdx: number) => {
      const preset = PRESETS[presetIdx];
      // Append new stages at the end; we don't delete existing ones to avoid
      // breaking deals already in flight.
      const baseIndex = stages.length;
      for (let i = 0; i < preset.stages.length; i++) {
        const s = preset.stages[i];
        await upsert({
          data: {
            workspace_id: ws!.id,
            name: s.name,
            color: s.color,
            stage_type: s.type,
            default_probability: s.probability,
            order_index: baseIndex + i,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Preset added");
      qc.invalidateQueries({ queryKey: ["deal-stages", ws?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Workflow className="h-5 w-5" /> Sales stages
          </h2>
          <p className="text-sm text-muted-foreground">
            Customize the phases a new client moves through, from first touch to
            won. Used in the new-client wizard and the deals pipeline.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() =>
            setEditing({
              name: "",
              color: "#6366f1",
              stage_type: "open",
              default_probability: 25,
            })
          }
        >
          <Plus className="h-4 w-4 mr-1" /> New stage
        </Button>
      </div>

      <Card className="divide-y">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : stages.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            No stages yet. Add one or apply a preset below.
          </div>
        ) : (
          stages.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <div className="flex flex-col">
                <button
                  className="h-5 w-5 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => moveStage(i, -1)}
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  className="h-5 w-5 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === stages.length - 1}
                  onClick={() => moveStage(i, 1)}
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  Default probability {s.default_probability}%
                </div>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] border-0 ${TYPE_BADGE[s.stage_type as StageType]}`}
              >
                {s.stage_type}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() =>
                  setEditing({
                    id: s.id,
                    name: s.name,
                    color: s.color,
                    stage_type: s.stage_type as StageType,
                    default_probability: s.default_probability,
                  })
                }
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm(`Delete the "${s.name}" stage?`)) remove.mutate(s.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </Card>

      <div>
        <h3 className="text-sm font-medium mb-2">Starter presets</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Different businesses run different sales processes. Add a preset to
          extend your pipeline — it won't replace existing stages.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {PRESETS.map((p, i) => (
            <Card key={p.label} className="p-3 space-y-2">
              <div>
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.description}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {p.stages.map((s) => (
                  <span
                    key={s.name}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </span>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={applyPreset.isPending}
                onClick={() => applyPreset.mutate(i)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add to pipeline
              </Button>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit stage" : "New stage"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  autoFocus
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  maxLength={60}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Color</Label>
                  <Input
                    type="color"
                    value={editing.color}
                    onChange={(e) =>
                      setEditing({ ...editing, color: e.target.value })
                    }
                    className="h-9 p-1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={editing.stage_type}
                    onValueChange={(v) =>
                      setEditing({ ...editing, stage_type: v as StageType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open (in pipeline)</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Default probability ({editing.default_probability}%)
                </Label>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={editing.default_probability}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      default_probability: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={!editing?.name.trim() || save.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
