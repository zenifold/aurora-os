// Block A · Phase 2 — minimal renderer for custom field values used by the
// generic /app/objects/$key page. Advanced types (formula/rollup/lookup/
// relation/file/person) render as text/textarea placeholders for now.
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ObjectFieldDef } from "@/lib/object-types";

type Props = {
  field: ObjectFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
};

export function CustomFieldInput({ field, value, onChange }: Props) {
  const t = field.field_type;
  if (t === "checkbox") {
    return (
      <Checkbox
        checked={!!value}
        onCheckedChange={(v) => onChange(!!v)}
      />
    );
  }
  if (t === "number" || t === "currency" || t === "percent" || t === "effort") {
    return (
      <Input
        type="number"
        value={value == null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    );
  }
  if (t === "date") {
    return (
      <Input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value || null)}
      />
    );
  }
  if (t === "rich_text") {
    return (
      <Textarea
        rows={4}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (t === "select") {
    return (
      <Select value={typeof value === "string" ? value : ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((o) => (
            <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (t === "multi_select") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (v: string) => {
      onChange(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    };
    return (
      <div className="flex flex-wrap gap-1">
        {(field.options ?? []).map((o) => (
          <Badge
            key={o.id}
            variant={arr.includes(o.id) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggle(o.id)}
          >
            {o.label}
          </Badge>
        ))}
      </div>
    );
  }
  // text, url, email, formula, rollup, lookup, relation, file, person, user
  return (
    <Input
      type={t === "email" ? "email" : t === "url" ? "url" : "text"}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        t === "formula" || t === "rollup" || t === "lookup"
          ? "Computed (coming soon)"
          : undefined
      }
      disabled={t === "formula" || t === "rollup" || t === "lookup"}
    />
  );
}

export function renderFieldValue(field: ObjectFieldDef, value: unknown): string {
  if (value == null || value === "") return "—";
  const t = field.field_type;
  if (t === "checkbox") return value ? "Yes" : "No";
  if (t === "multi_select" && Array.isArray(value)) {
    const labels = (field.options ?? [])
      .filter((o) => (value as string[]).includes(o.id))
      .map((o) => o.label);
    return labels.join(", ") || "—";
  }
  if (t === "select") {
    return (field.options ?? []).find((o) => o.id === value)?.label ?? String(value);
  }
  if (t === "currency") return typeof value === "number" ? `$${value.toLocaleString()}` : String(value);
  if (t === "percent") return typeof value === "number" ? `${value}%` : String(value);
  return String(value);
}
