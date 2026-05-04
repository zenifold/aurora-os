import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_WORKFLOW,
  type StatusCategory,
  type WorkflowStatus,
  useProjectWorkflow,
  useUpdateProjectWorkflow,
} from "@/hooks/use-project-workflow";
import { GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const CATEGORY_LABEL: Record<StatusCategory, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

const PRESET_COLORS = [
  "oklch(0.7 0.02 270)",
  "oklch(0.6 0.18 240)",
  "oklch(0.75 0.15 80)",
  "oklch(0.65 0.18 150)",
  "oklch(0.6 0.18 25)",
  "oklch(0.6 0.25 310)",
  "oklch(0.7 0.22 350)",
];

export function StatusWorkflowBuilder({ projectId }: { projectId: string }) {
  const { data: serverWorkflow, isLoading } = useProjectWorkflow(projectId);
  const update = useUpdateProjectWorkflow(projectId);
  const [workflow, setWorkflow] = useState<WorkflowStatus[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (serverWorkflow) {
      setWorkflow(serverWorkflow);
      setDirty(false);
    }
  }, [serverWorkflow]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = workflow.findIndex((s) => s.id === active.id);
    const to = workflow.findIndex((s) => s.id === over.id);
    if (from === -1 || to === -1) return;
    setWorkflow(arrayMove(workflow, from, to));
    setDirty(true);
  };

  const updateStatus = (id: string, patch: Partial<WorkflowStatus>) => {
    setWorkflow((w) => w.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setDirty(true);
  };

  const removeStatus = (id: string) => {
    if (workflow.length <= 2) return;
    if (!confirm("Delete this status? Tasks using it will keep the value but it won't appear in pickers.")) return;
    setWorkflow((w) => w.filter((s) => s.id !== id));
    setDirty(true);
  };

  const addStatus = () => {
    const id = `s_${Date.now().toString(36)}`;
    setWorkflow((w) => [
      ...w,
      { id, name: "New status", color: PRESET_COLORS[w.length % PRESET_COLORS.length], category: "in_progress", wip_limit: null },
    ]);
    setDirty(true);
  };

  const resetToDefault = () => {
    if (!confirm("Reset to the default workflow?")) return;
    setWorkflow(DEFAULT_WORKFLOW);
    setDirty(true);
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium">Status pipeline</h3>
          <p className="text-sm text-muted-foreground">
            Drag to reorder. Each status maps to a Kanban column and analytics category.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefault}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
          </Button>
          <Button
            size="sm"
            onClick={() => update.mutate(workflow, { onSuccess: () => setDirty(false) })}
            disabled={!dirty || update.isPending}
            className="bg-aura-gradient text-primary-foreground hover:opacity-90"
          >
            {update.isPending ? "Saving…" : "Save workflow"}
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={workflow.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-3">
            {workflow.map((s) => (
              <SortableStatusCard
                key={s.id}
                status={s}
                onChange={(patch) => updateStatus(s.id, patch)}
                onRemove={() => removeStatus(s.id)}
                canRemove={workflow.length > 2}
              />
            ))}
            <button
              onClick={addStatus}
              className="flex w-44 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border p-4 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Add status
            </button>
          </div>
        </SortableContext>
      </DndContext>

      <p className="text-xs text-muted-foreground">
        Categories drive analytics: <strong>Done</strong> counts toward velocity, <strong>Cancelled</strong> is excluded.
      </p>
    </div>
  );
}

function SortableStatusCard({
  status,
  onChange,
  onRemove,
  canRemove,
}: {
  status: WorkflowStatus;
  onChange: (patch: Partial<WorkflowStatus>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: status.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="w-64 rounded-lg border border-border bg-card p-3 shadow-elegant"
    >
      <div className="mb-2 flex items-center gap-2">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="h-3 w-3 rounded-full" style={{ background: status.color }} />
        <Input
          value={status.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-7 flex-1 border-0 bg-transparent px-1 font-medium focus-visible:ring-1"
        />
        {canRemove && (
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <Label className="text-xs text-muted-foreground">Color</Label>
          <div className="mt-1 flex flex-wrap gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ color: c })}
                className={`h-5 w-5 rounded-full border-2 transition ${status.color === c ? "border-foreground" : "border-transparent"}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select value={status.category} onValueChange={(v) => onChange({ category: v as StatusCategory })}>
            <SelectTrigger className="mt-1 h-7"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(CATEGORY_LABEL) as StatusCategory[]).map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">WIP limit</Label>
          <Input
            type="number"
            min={0}
            value={status.wip_limit ?? ""}
            placeholder="No limit"
            onChange={(e) => onChange({ wip_limit: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
            className="mt-1 h-7"
          />
        </div>
      </div>
    </div>
  );
}
