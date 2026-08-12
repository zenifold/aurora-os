import { useState } from "react";
import { confirmDialog } from "@/lib/dialogs";
import { Plus, Trash2 } from "lucide-react";
import type { CustomFieldDef, EffortValue, FieldType, Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUpdateTask } from "@/hooks/use-tasks";
import {
  useCreateCustomField,
  useDeleteCustomField,
} from "@/hooks/use-custom-fields";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "select", label: "Select" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "effort", label: "Effort" },
];

export function CustomFieldsSection({
  task,
  fields,
}: {
  task: Task;
  fields: CustomFieldDef[];
}) {
  const update = useUpdateTask(task.project_id);
  const remove = useDeleteCustomField();
  const setValue = (fieldId: string, val: unknown) => {
    update.mutate({
      id: task.id,
      custom_values: { ...(task.custom_values ?? {}), [fieldId]: val } as never,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Custom fields
        </Label>
        <NewFieldButton />
      </div>
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No custom fields yet. Add one to extend tasks.
        </p>
      ) : (
        <div className="space-y-2.5">
          {fields.map((f) => (
            <div key={f.id} className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
              <span className="truncate text-xs text-muted-foreground" title={f.name}>
                {f.name}
              </span>
              <FieldValueInput
                field={f}
                value={task.custom_values?.[f.id]}
                onChange={(v) => setValue(f.id, v)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: `Remove "${f.name}"?`,
                    description: "This field and its values will be removed from every task in the project.",
                    confirmLabel: "Remove field",
                    tone: "destructive",
                  });
                  if (ok) remove.mutate(f.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldValueInput({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.field_type) {
    case "checkbox":
      return (
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={(c) => onChange(Boolean(c))}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          className="h-8"
          defaultValue={value == null ? "" : String(value)}
          onBlur={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      );
    case "date":
      return (
        <Input
          type="date"
          className="h-8"
          defaultValue={typeof value === "string" ? value : ""}
          onBlur={(e) => onChange(e.target.value || null)}
        />
      );
    case "url":
    case "email":
    case "text":
      return (
        <Input
          type={field.field_type === "email" ? "email" : field.field_type === "url" ? "url" : "text"}
          className="h-8"
          defaultValue={typeof value === "string" ? value : ""}
          onBlur={(e) => onChange(e.target.value || null)}
        />
      );
    case "select":
      return (
        <Select
          value={typeof value === "string" ? value : undefined}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "effort": {
      const v = (value as EffortValue | null) ?? { amount: 0, unit: "hours" };
      return (
        <div className="flex gap-2">
          <Input
            type="number"
            className="h-8 w-24"
            defaultValue={v.amount || ""}
            onBlur={(e) =>
              onChange({ amount: Number(e.target.value) || 0, unit: v.unit })
            }
          />
          <Select
            value={v.unit}
            onValueChange={(u) => onChange({ amount: v.amount, unit: u })}
          >
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
              <SelectItem value="points">Points</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }
    default:
      return <span className="text-sm text-muted-foreground">—</span>;
  }
}

function NewFieldButton() {
  const create = useCreateCustomField();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add field
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New custom field</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Story points"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={() => {
              create.mutate(
                { name: name.trim(), field_type: type },
                {
                  onSuccess: () => {
                    setOpen(false);
                    setName("");
                    setType("text");
                  },
                },
              );
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
