import { useState } from "react";
import type { CustomFieldDef, Filter, Sort } from "@/lib/types";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Filter as FilterIcon, ArrowUpDown, Layers, Plus, X, Save } from "lucide-react";

interface Props {
  filters: Filter[];
  sorts: Sort[];
  groupBy: string | null;
  fields: CustomFieldDef[];
  onFiltersChange: (f: Filter[]) => void;
  onSortsChange: (s: Sort[]) => void;
  onGroupByChange: (g: string | null) => void;
  onSaveAsView: (name: string) => void;
}

const BASE_FIELDS = [
  { value: "title", label: "Title" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "due_date", label: "Due date" },
];

export function FilterBar({ filters, sorts, groupBy, fields, onFiltersChange, onSortsChange, onGroupByChange, onSaveAsView }: Props) {
  const [saveName, setSaveName] = useState("");

  const allFields = [
    ...BASE_FIELDS,
    ...fields.map((f) => ({ value: `cf:${f.id}`, label: f.name })),
  ];

  const addFilter = () => {
    const id = Math.random().toString(36).slice(2);
    onFiltersChange([...filters, { id, field: "status", operator: "is", value: "todo" }]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-6 py-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7">
            <FilterIcon className="mr-1.5 h-3.5 w-3.5" /> Filter
            {filters.length > 0 && <span className="ml-1.5 rounded bg-aura-gradient px-1.5 text-[10px] text-primary-foreground">{filters.length}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-96">
          <div className="space-y-2">
            {filters.length === 0 && <p className="text-sm text-muted-foreground">No filters applied.</p>}
            {filters.map((f, idx) => (
              <div key={f.id} className="flex items-center gap-1.5">
                <Select value={f.field} onValueChange={(v) => {
                  const next = [...filters];
                  next[idx] = { ...f, field: v };
                  onFiltersChange(next);
                }}>
                  <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allFields.map((af) => <SelectItem key={af.value} value={af.value}>{af.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={f.operator} onValueChange={(v) => {
                  const next = [...filters];
                  next[idx] = { ...f, operator: v as Filter["operator"] };
                  onFiltersChange(next);
                }}>
                  <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="is">is</SelectItem>
                    <SelectItem value="is_not">is not</SelectItem>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="is_empty">is empty</SelectItem>
                    <SelectItem value="is_not_empty">is not empty</SelectItem>
                  </SelectContent>
                </Select>
                <FilterValueInput
                  field={f.field}
                  operator={f.operator}
                  value={f.value}
                  onChange={(v) => {
                    const next = [...filters];
                    next[idx] = { ...f, value: v };
                    onFiltersChange(next);
                  }}
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onFiltersChange(filters.filter((x) => x.id !== f.id))}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="h-7 w-full" onClick={addFilter}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add filter
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7">
            <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" /> Sort
            {sorts.length > 0 && <span className="ml-1.5 rounded bg-aura-gradient px-1.5 text-[10px] text-primary-foreground">{sorts.length}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <div className="space-y-2">
            {sorts.length === 0 && <p className="text-sm text-muted-foreground">No sorts applied.</p>}
            {sorts.map((s, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <Select value={s.field} onValueChange={(v) => {
                  const next = [...sorts];
                  next[idx] = { ...s, field: v };
                  onSortsChange(next);
                }}>
                  <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allFields.map((af) => <SelectItem key={af.value} value={af.value}>{af.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={s.direction} onValueChange={(v) => {
                  const next = [...sorts];
                  next[idx] = { ...s, direction: v as Sort["direction"] };
                  onSortsChange(next);
                }}>
                  <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Asc</SelectItem>
                    <SelectItem value="desc">Desc</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSortsChange(sorts.filter((_, i) => i !== idx))}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="h-7 w-full" onClick={() => onSortsChange([...sorts, { field: "title", direction: "asc" }])}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add sort
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Select value={groupBy ?? "__none__"} onValueChange={(v) => onGroupByChange(v === "__none__" ? null : v)}>
        <SelectTrigger className="h-7 w-36 text-xs">
          <Layers className="mr-1.5 h-3.5 w-3.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">No grouping</SelectItem>
          <SelectItem value="status">Group by status</SelectItem>
          <SelectItem value="priority">Group by priority</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex-1" />

      {(filters.length > 0 || sorts.length > 0 || groupBy) && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save as view
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="space-y-2">
              <Input
                autoFocus
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="View name"
                className="h-8"
              />
              <Button
                size="sm"
                className="w-full bg-aura-gradient text-primary-foreground hover:opacity-90"
                onClick={() => {
                  if (saveName.trim()) {
                    onSaveAsView(saveName.trim());
                    setSaveName("");
                  }
                }}
              >
                Save
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function FilterValueInput({ field, operator, value, onChange }: { field: string; operator: string; value: unknown; onChange: (v: unknown) => void }) {
  if (operator === "is_empty" || operator === "is_not_empty") {
    return <div className="h-7 w-32" />;
  }
  if (field === "status") {
    return (
      <Select value={(value as string) ?? ""} onValueChange={onChange}>
        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="value" /></SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (field === "priority") {
    return (
      <Select value={(value as string) ?? ""} onValueChange={onChange}>
        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="value" /></SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="value"
      className="h-7 w-32 text-xs"
    />
  );
}
