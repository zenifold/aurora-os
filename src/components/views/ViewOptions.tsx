import { useState } from "react";
import type { CustomFieldDef, View, ViewConfig } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings2 } from "lucide-react";

interface Props {
  view: View;
  fields: CustomFieldDef[];
  onChange: (config: ViewConfig) => void;
}

const TABLE_COLUMNS = [
  { key: "title", label: "Title", locked: true },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "due", label: "Due" },
];

const KANBAN_FIELDS: Array<{ key: "priority" | "due_date" | "assignees" | "tags"; label: string }> = [
  { key: "priority", label: "Priority" },
  { key: "due_date", label: "Due date" },
  { key: "assignees", label: "Assignees" },
  { key: "tags", label: "Tags" },
];

export function ViewOptions({ view, fields, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const config = view.config ?? {};

  const setColumnVisible = (key: string, visible: boolean) => {
    const cols = config.columns ?? [];
    const next = [...cols];
    const idx = next.findIndex((c) => c.key === key);
    if (idx >= 0) next[idx] = { ...next[idx], visible };
    else next.push({ key, visible });
    onChange({ ...config, columns: next });
  };

  const isVisible = (key: string) => {
    const c = (config.columns ?? []).find((c) => c.key === key);
    return c?.visible !== false;
  };

  const toggleCardField = (key: "priority" | "due_date" | "assignees" | "tags") => {
    const current = config.cardFields ?? ["priority", "due_date"];
    const has = current.includes(key);
    onChange({ ...config, cardFields: has ? current.filter((k) => k !== key) : [...current, key] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-2 h-4 w-4" /> View options
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b border-border px-3 py-2 text-sm font-semibold">
          {view.name} options
        </div>
        <div className="max-h-96 space-y-4 overflow-y-auto p-3 text-sm">
          {view.view_type === "table" && (
            <section>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Visible columns
              </Label>
              <div className="space-y-1.5">
                {TABLE_COLUMNS.map((col) => (
                  <label key={col.key} className="flex items-center gap-2">
                    <Checkbox
                      checked={col.locked || isVisible(col.key)}
                      disabled={col.locked}
                      onCheckedChange={(c) => setColumnVisible(col.key, !!c)}
                    />
                    <span className={col.locked ? "text-muted-foreground" : ""}>
                      {col.label}{col.locked && " (always)"}
                    </span>
                  </label>
                ))}
                {fields.map((f) => (
                  <label key={f.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={isVisible(`f:${f.id}`)}
                      onCheckedChange={(c) => setColumnVisible(`f:${f.id}`, !!c)}
                    />
                    <span>{f.name}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {view.view_type === "kanban" && (
            <section>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Card fields
              </Label>
              <div className="space-y-1.5">
                {KANBAN_FIELDS.map((f) => {
                  const current = config.cardFields ?? ["priority", "due_date"];
                  return (
                    <label key={f.key} className="flex items-center gap-2">
                      <Checkbox
                        checked={current.includes(f.key)}
                        onCheckedChange={() => toggleCardField(f.key)}
                      />
                      <span>{f.label}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Color by
            </Label>
            <Select
              value={config.colorBy ?? "none"}
              onValueChange={(v) => onChange({ ...config, colorBy: v as ViewConfig["colorBy"] })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="due_date">Due date</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Adds a colored left border to {view.view_type === "kanban" ? "cards" : "rows"}.
            </p>
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}
