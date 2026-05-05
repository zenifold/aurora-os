import { useState } from "react";
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
  useProjectWorkflow,
  useCreateWorkflowStatus,
  useUpdateWorkflowStatus,
  useDeleteWorkflowStatus,
  useReorderWorkflowStatuses,
} from "@/hooks/use-project-workflow";
import {
  CATEGORY_LABEL,
  STATUS_PRESET_COLORS,
  type StatusCategory,
  type WorkflowStatus,
} from "@/lib/workflow-types";
import { GripVertical, Plus, Trash2, Flag, CheckCircle2 } from "lucide-react";
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

export function StatusWorkflowBuilder({ projectId }: { projectId: string }) {
  const { data: statuses = [], isLoading } = useProjectWorkflow(projectId);
  const createStatus = useCreateWorkflowStatus(projectId);
  const updateStatus = useUpdateWorkflowStatus(projectId);
  const deleteStatus = useDeleteWorkflowStatus(projectId);
  const reorder = useReorderWorkflowStatuses(projectId);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = statuses.findIndex((s) => s.id === active.id);
    const to = statuses.findIndex((s) => s.id === over.id);
    if (from === -1 || to === -1) return;
    const next = arrayMove(statuses, from, to);
    reorder.mutate(next.map((s) => s.id));
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading workflow…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-medium">Status pipeline</h3>
          <p className="text-sm text-muted-foreground">
            Drag to reorder. Each status appears as a Kanban column. WIP limits and SLA hours
            are enforced across views.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() =>
            createStatus.mutate({
              name: `Status ${statuses.length + 1}`,
              category: "in_progress",
              color: STATUS_PRESET_COLORS[statuses.length % STATUS_PRESET_COLORS.length],
            })
          }
          disabled={createStatus.isPending}
          className="w-full bg-aura-gradient text-primary-foreground hover:opacity-90 sm:w-auto"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add status
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={statuses.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-3">
            {statuses.map((s) => (
              <SortableStatusCard
                key={s.id}
                status={s}
                onChange={(patch) => updateStatus.mutate({ id: s.id, ...patch })}
                onRemove={() => {
                  if (statuses.length <= 2) return;
                  if (
                    !confirm(
                      "Delete this status? Tasks using it will keep the value but it won't appear in pickers.",
                    )
                  )
                    return;
                  deleteStatus.mutate(s.id);
                }}
                canRemove={statuses.length > 2}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="text-xs text-muted-foreground">
        Categories drive analytics: <strong>Done</strong> counts toward velocity,{" "}
        <strong>Cancelled</strong> is excluded.
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: status.id,
  });
  const [name, setName] = useState(status.name);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="w-full rounded-lg border border-border bg-card p-3 shadow-sm sm:w-64"
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="h-3 w-3 rounded-full" style={{ background: status.color }} />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== status.name) onChange({ name: name.trim() });
            else setName(status.name);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-7 flex-1 border-0 bg-transparent px-1 font-medium focus-visible:ring-1"
        />
        {canRemove && (
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete status"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <Label className="text-xs text-muted-foreground">Color</Label>
          <div className="mt-1 flex flex-wrap gap-1">
            {STATUS_PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ color: c })}
                className={`h-5 w-5 rounded-full border-2 transition ${
                  status.color.toLowerCase() === c.toLowerCase()
                    ? "border-foreground"
                    : "border-transparent"
                }`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select
            value={status.category}
            onValueChange={(v) => onChange({ category: v as StatusCategory })}
          >
            <SelectTrigger className="mt-1 h-7">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CATEGORY_LABEL) as StatusCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">WIP limit</Label>
            <Input
              type="number"
              min={0}
              value={status.wip_limit ?? ""}
              placeholder="—"
              onChange={(e) =>
                onChange({
                  wip_limit: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                })
              }
              className="mt-1 h-7"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">SLA (hrs)</Label>
            <Input
              type="number"
              min={0}
              value={status.sla_hours ?? ""}
              placeholder="—"
              onChange={(e) =>
                onChange({
                  sla_hours: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                })
              }
              className="mt-1 h-7"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1 pt-1">
          <button
            onClick={() => onChange({ is_start: !status.is_start })}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition ${
              status.is_start
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Flag className="h-3 w-3" /> Start
          </button>
          <button
            onClick={() => onChange({ is_terminal: !status.is_terminal })}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition ${
              status.is_terminal
                ? "border-transparent bg-emerald-600 text-white"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <CheckCircle2 className="h-3 w-3" /> Terminal
          </button>
        </div>
      </div>
    </div>
  );
}
