import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ShieldCheck, Lock, Zap } from "lucide-react";
import type {
  Gate,
  GateType,
  WorkflowStatus,
  WorkflowTransition,
  WorkflowAction,
  TransitionPermission,
  StatusCategory,
} from "@/lib/workflow-types";
import {
  useUpsertTransition,
  useDeleteTransition,
} from "@/hooks/use-project-workflow";
import { useWorkspaceMembers } from "@/hooks/use-comments";

interface Props {
  projectId: string;
  fromStatus: WorkflowStatus;
  toStatus: WorkflowStatus;
  /** Existing transition if it already exists, else null */
  transition: WorkflowTransition | null;
  open: boolean;
  onClose: () => void;
}

const PERMISSION_OPTIONS: { value: TransitionPermission; label: string }[] = [
  { value: "anyone", label: "Anyone" },
  { value: "assignee", label: "Assignee only" },
  { value: "creator", label: "Creator only" },
  { value: "admin", label: "Workspace admins" },
];

const GATE_TYPE_OPTIONS: { value: GateType; label: string }[] = [
  { value: "field_required", label: "Field is set" },
  { value: "all_blockers_resolved", label: "All blockers resolved" },
  { value: "subtasks_status", label: "Subtasks reached status" },
  { value: "child_tasks_status", label: "% of children in status" },
  { value: "checklist_min", label: "Checklist % complete" },
  { value: "approval_required", label: "Approval required" },
];

const FIELD_OPTIONS = [
  { value: "assignee_ids", label: "Assignee" },
  { value: "due_date", label: "Due date" },
  { value: "start_date", label: "Start date" },
  { value: "description", label: "Description" },
  { value: "tags", label: "Tags" },
];

const SUBTASK_STATUS_CHOICES: { value: StatusCategory; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "review", label: "In Review" },
  { value: "in_progress", label: "In Progress" },
];

export function TransitionEditorDialog({
  projectId,
  fromStatus,
  toStatus,
  transition,
  open,
  onClose,
}: Props) {
  const upsert = useUpsertTransition(projectId);
  const remove = useDeleteTransition(projectId);
  const { data: members = [] } = useWorkspaceMembers();

  const [permission, setPermission] = useState<TransitionPermission>("anyone");
  const [buttonLabel, setButtonLabel] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [gates, setGates] = useState<Gate[]>([]);

  useEffect(() => {
    if (open) {
      setPermission(transition?.permission ?? "anyone");
      setButtonLabel(transition?.button_label ?? "");
      setConfirmation(transition?.confirmation_message ?? "");
      setGates(transition?.gates ?? []);
    }
  }, [open, transition]);

  const addGate = (type: GateType) => {
    const id = crypto.randomUUID();
    let g: Gate;
    switch (type) {
      case "field_required":
        g = { id, type, field: "assignee_ids" };
        break;
      case "subtasks_status":
        g = { id, type, statuses: ["done"] };
        break;
      case "child_tasks_status":
        g = { id, type, statuses: ["done"], allow_percent: 100 };
        break;
      case "checklist_min":
        g = { id, type, percent: 100 };
        break;
      case "approval_required":
        g = { id, type, approver_ids: [], min_approvals: 1 };
        break;
      case "all_blockers_resolved":
      case "no_open_blockers":
        g = { id, type };
        break;
      default:
        g = { id, type } as Gate;
    }
    setGates((prev) => [...prev, g]);
  };

  const updateGate = (id: string, patch: Partial<Gate>) => {
    setGates((prev) =>
      prev.map((g) => (g.id === id ? ({ ...g, ...patch } as Gate) : g)),
    );
  };

  const removeGate = (id: string) => {
    setGates((prev) => prev.filter((g) => g.id !== id));
  };

  const save = async () => {
    await upsert.mutateAsync({
      id: transition?.id,
      from_status_id: fromStatus.id,
      to_status_id: toStatus.id,
      permission,
      button_label: buttonLabel.trim() || null,
      confirmation_message: confirmation.trim() || null,
      gates,
    });
    onClose();
  };

  const onDelete = async () => {
    if (!transition) return;
    if (!confirm("Remove this transition? Tasks won't be able to move along this path.")) return;
    await remove.mutateAsync(transition.id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: fromStatus.color }} />
              {fromStatus.name}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: toStatus.color }} />
              {toStatus.name}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Permission + label */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <Lock className="h-3 w-3" /> Who can transition
              </Label>
              <Select value={permission} onValueChange={(v) => setPermission(v as TransitionPermission)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERMISSION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Button label (optional)</Label>
              <Input
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
                placeholder={`Move to ${toStatus.name}`}
                maxLength={40}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Confirmation message (optional)</Label>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Are you sure?"
              maxLength={120}
            />
          </div>

          {/* Gates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs">
                <ShieldCheck className="h-3 w-3" /> Gates ({gates.length})
              </Label>
              <Select onValueChange={(v) => addGate(v as GateType)}>
                <SelectTrigger className="h-7 w-40 text-xs">
                  <SelectValue placeholder="+ Add gate" />
                </SelectTrigger>
                <SelectContent>
                  {GATE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {gates.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                No gates. Anyone allowed by permission can transition freely.
              </p>
            ) : (
              <div className="space-y-2">
                {gates.map((gate) => (
                  <GateRow
                    key={gate.id}
                    gate={gate}
                    members={members}
                    onChange={(patch) => updateGate(gate.id, patch)}
                    onRemove={() => removeGate(gate.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <div>
            {transition && (
              <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove path
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={upsert.isPending} className="bg-aura-gradient text-primary-foreground">
              {transition ? "Save" : "Create transition"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GateRow({
  gate,
  members,
  onChange,
  onRemove,
}: {
  gate: Gate;
  members: { id: string; display_name?: string | null }[];
  onChange: (patch: Partial<Gate>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">
          {GATE_TYPE_OPTIONS.find((o) => o.value === gate.type)?.label ?? gate.type}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            Block
            <Switch
              checked={(gate.behavior ?? "block") === "block"}
              onCheckedChange={(c) => onChange({ behavior: c ? "block" : "warn" } as Partial<Gate>)}
            />
          </span>
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove gate"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {gate.type === "field_required" && (
        <Select
          value={gate.field}
          onValueChange={(v) => onChange({ field: v } as Partial<Gate>)}
        >
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELD_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {(gate.type === "subtasks_status" || gate.type === "child_tasks_status") && (
        <div className="space-y-1.5">
          <Select
            value={gate.statuses[0] ?? "done"}
            onValueChange={(v) => onChange({ statuses: [v as StatusCategory] } as Partial<Gate>)}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUBTASK_STATUS_CHOICES.map((c) => (
                <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {gate.type === "child_tasks_status" && (
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground">% required</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={gate.allow_percent ?? 100}
                onChange={(e) =>
                  onChange({ allow_percent: Math.max(0, Math.min(100, Number(e.target.value))) } as Partial<Gate>)
                }
                className="h-7 w-20 text-xs"
              />
            </div>
          )}
        </div>
      )}

      {gate.type === "checklist_min" && (
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground">% complete</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={gate.percent}
            onChange={(e) =>
              onChange({ percent: Math.max(0, Math.min(100, Number(e.target.value))) } as Partial<Gate>)
            }
            className="h-7 w-20 text-xs"
          />
        </div>
      )}

      {gate.type === "approval_required" && (
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground">Approvers (any of)</Label>
          <div className="flex flex-wrap gap-1">
            {members.map((m) => {
              const checked = gate.approver_ids.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    const next = checked
                      ? gate.approver_ids.filter((id) => id !== m.id)
                      : [...gate.approver_ids, m.id];
                    onChange({ approver_ids: next } as Partial<Gate>);
                  }}
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                    checked
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.display_name ?? m.id.slice(0, 6)}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground">Min approvals</Label>
            <Input
              type="number"
              min={1}
              value={gate.min_approvals}
              onChange={(e) =>
                onChange({ min_approvals: Math.max(1, Number(e.target.value)) } as Partial<Gate>)
              }
              className="h-7 w-16 text-xs"
            />
          </div>
        </div>
      )}

      <Textarea
        value={gate.message ?? ""}
        onChange={(e) => onChange({ message: e.target.value } as Partial<Gate>)}
        placeholder="Custom error message (optional)"
        rows={1}
        className="text-xs"
      />
    </div>
  );
}
