import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";
import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import {
  useObjectTypes,
  useObjectFields,
  useCreateObjectField,
  useDeleteObjectField,
} from "@/hooks/use-object-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  FIELD_TYPE_GROUPS,
  fieldTypeLabel,
  fieldTypeNeedsOptions,
  type ExtendedFieldType,
} from "@/lib/object-types";
import { Trash2, Plus, Sliders } from "lucide-react";
import type { SelectOption } from "@/lib/types";

const searchSchema = z.object({
  object_type: z.string().optional(),
});

export const Route = createFileRoute("/app/settings/fields")({
  validateSearch: searchSchema,
  component: () => (
    <RoleGuard min="manager">
      <FieldsPage />
    </RoleGuard>
  ),
});

function FieldsPage() {
  const { object_type } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: types = [] } = useObjectTypes();
  const [activeTypeId, setActiveTypeId] = useState<string | null>(object_type ?? null);

  // Default to first type when types load
  useEffect(() => {
    if (!activeTypeId && types.length > 0) {
      setActiveTypeId(object_type ?? types[0].id);
    }
  }, [types, activeTypeId, object_type]);

  // Keep URL in sync
  useEffect(() => {
    if (activeTypeId && activeTypeId !== object_type) {
      navigate({ search: { object_type: activeTypeId }, replace: true });
    }
  }, [activeTypeId, object_type, navigate]);

  const activeType = useMemo(
    () => types.find((t) => t.id === activeTypeId) ?? null,
    [types, activeTypeId],
  );
  const { data: fields = [], isLoading } = useObjectFields(activeTypeId);
  const create = useCreateObjectField();
  const remove = useDeleteObjectField();

  const [name, setName] = useState("");
  const [type, setType] = useState<ExtendedFieldType>("text");
  const [helpText, setHelpText] = useState("");
  const [required, setRequired] = useState(false);
  const [visibleInTable, setVisibleInTable] = useState(true);
  const [formulaExpr, setFormulaExpr] = useState("");

  const submit = async () => {
    if (!name.trim() || !activeTypeId) return;
    let opts: SelectOption[] | undefined;
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
    await create.mutateAsync({
      object_type_id: activeTypeId,
      name: name.trim(),
      field_type: type,
      options: opts,
      help_text: helpText.trim() || undefined,
      is_required: required,
      is_visible_in_table: visibleInTable,
      formula_expr: type === "formula" ? formulaExpr.trim() || undefined : undefined,
    });
    setName("");
    setHelpText("");
    setRequired(false);
    setVisibleInTable(true);
    setFormulaExpr("");
    setType("text");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Custom fields</h2>
          <p className="text-sm text-muted-foreground">
            Add fields to any object type. Records inherit these fields automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={activeTypeId ?? ""} onValueChange={setActiveTypeId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Choose object type" />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label} {t.is_system && <span className="opacity-50 ml-1">(built-in)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeType && (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-medium">Add a field to {activeType.label}</div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Severity"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ExtendedFieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_GROUPS.map((g) => (
                    <SelectGroup key={g.group}>
                      <SelectLabel>{g.group}</SelectLabel>
                      {g.types.map((ft) => (
                        <SelectItem key={ft.value} value={ft.value}>
                          {ft.label}
                          {ft.hint && (
                            <span className="ml-2 text-xs text-muted-foreground">— {ft.hint}</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Help text</Label>
              <Input
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder="Shown beneath the field in forms"
              />
            </div>
            {type === "formula" && (
              <div className="space-y-1.5 md:col-span-2">
                <Label>Formula</Label>
                <Textarea
                  value={formulaExpr}
                  onChange={(e) => setFormulaExpr(e.target.value)}
                  placeholder="e.g. impact * likelihood"
                  rows={2}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Formula evaluation runs client-side when records are viewed.
                </p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Switch checked={required} onCheckedChange={setRequired} id="req" />
              <Label htmlFor="req" className="!mb-0 text-sm font-normal">
                Required
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={visibleInTable}
                onCheckedChange={setVisibleInTable}
                id="vis"
              />
              <Label htmlFor="vis" className="!mb-0 text-sm font-normal">
                Visible in table views by default
              </Label>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={!name.trim() || create.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Add field
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : fields.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No custom fields yet for this object type.
          </div>
        ) : (
          <ul className="divide-y">
            {fields.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium">{f.name}</div>
                    <Badge variant="outline">
                      {fieldTypeLabel(f.field_type as ExtendedFieldType)}
                    </Badge>
                    {f.is_required && <Badge variant="secondary">Required</Badge>}
                    {!f.is_visible_in_table && (
                      <Badge variant="outline" className="opacity-60">
                        Hidden in tables
                      </Badge>
                    )}
                    {fieldTypeNeedsOptions(f.field_type as ExtendedFieldType) && f.options && (
                      <span className="text-xs text-muted-foreground">
                        {f.options.length} options
                      </span>
                    )}
                  </div>
                  {f.help_text && (
                    <div className="text-xs text-muted-foreground">{f.help_text}</div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Remove "${f.name}"?`)) remove.mutate(f.id);
                  }}
                >
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
