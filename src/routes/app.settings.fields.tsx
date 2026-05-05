import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCustomFields, useCreateCustomField, useDeleteCustomField } from "@/hooks/use-custom-fields";
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
import { Badge } from "@/components/ui/badge";
import type { FieldType } from "@/lib/types";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/app/settings/fields")({
  component: FieldsPage,
});

const FIELD_TYPES: { value: FieldType; label: string; hint?: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "multi_select", label: "Multi-select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "effort", label: "Level of Effort", hint: "Hours / days / points — drives Timeline scenarios" },
];

function FieldsPage() {
  const { data: fields = [] } = useCustomFields();
  const create = useCreateCustomField();
  const remove = useDeleteCustomField();
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");

  const submit = async () => {
    if (!name.trim()) return;
    let opts;
    if (type === "select" || type === "multi_select") {
      opts = [
        { id: "opt1", label: "Option 1", color: "#8b5cf6" },
        { id: "opt2", label: "Option 2", color: "#ec4899" },
      ];
    } else if (type === "effort") {
      opts = [
        { id: "hours", label: "Hours", color: "#0ea5e9" },
        { id: "days", label: "Days", color: "#22c55e" },
        { id: "points", label: "Story points", color: "#a855f7" },
      ];
    }
    await create.mutateAsync({ name: name.trim(), field_type: type, options: opts });
    setName("");
    setType("text");
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Custom fields</h1>
      <p className="text-sm text-muted-foreground">Add typed metadata that appears as columns in every project.</p>

      <div className="mt-6 flex items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex-1">
          <Label htmlFor="fname">Name</Label>
          <Input id="fname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Estimate (hours)" className="mt-1.5" />
        </div>
        <div className="w-44">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <div className="flex flex-col">
                    <span>{t.label}</span>
                    {t.hint && <span className="text-[11px] text-muted-foreground">{t.hint}</span>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={submit} disabled={!name.trim()} className="bg-aura-gradient text-primary-foreground hover:opacity-90">
          <Plus className="mr-1.5 h-4 w-4" /> Add field
        </Button>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card">
        {fields.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No custom fields yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {fields.map((f) => (
              <li key={f.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <p className="font-medium">{f.name}</p>
                  <Badge variant="secondary">{f.field_type}</Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(f.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
