import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Plus, Trash2, GripVertical, Save, Eye, FileText, Loader2, Send, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useIntakeForms,
  useSaveIntakeForm,
  useDeleteIntakeForm,
  useIntakeResponses,
} from "@/hooks/use-intake-forms";
import {
  FIELD_TYPE_LABELS,
  newField,
  type IntakeField,
  type IntakeFieldType,
  type IntakeForm,
  type IntakeFormStatus,
  type IntakeFormVisibility,
} from "@/lib/intake-form-types";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/app/p/$projectId/intake")({
  component: IntakePage,
});

function IntakePage() {
  const { projectId } = Route.useParams();
  const { data: forms = [], isLoading } = useIntakeForms(projectId);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"editor" | "responses">("editor");

  useEffect(() => {
    if (!selected && forms.length > 0) setSelected(forms[0].id);
  }, [forms, selected]);

  const current = forms.find((f) => f.id === selected) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/p/$projectId" params={{ projectId }}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Project
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Customer intake</div>
            <h1 className="text-lg font-semibold lg:text-xl">Forms & questionnaires</h1>
          </div>
          <NewFormButton projectId={projectId} onCreated={(id) => setSelected(id)} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-muted/20 p-2">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : forms.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">No forms yet.</div>
          ) : (
            <ul className="space-y-1">
              {forms.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(f.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                      selected === f.id ? "bg-card font-medium shadow-sm" : "hover:bg-card/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{f.title}</span>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] ${
                          f.status === "published"
                            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                            : f.status === "archived"
                              ? "border-muted-foreground/30 text-muted-foreground"
                              : "border-amber-500/40 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {f.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {(f.fields ?? []).length} questions
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {!current ? (
            <div className="flex h-full items-center justify-center p-8">
              <EmptyState
                icon={FileText}
                title="Collect briefs, requirements, and assets from clients"
                description="Build an intake form once, share it via the client portal, and watch responses roll in. Perfect for kickoff questionnaires and creative briefs."
              />
            </div>
          ) : (
            <div className="p-4 lg:p-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTab("editor")}
                  className={`rounded-md px-3 py-1.5 text-sm ${tab === "editor" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => setTab("responses")}
                  className={`rounded-md px-3 py-1.5 text-sm ${tab === "responses" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  Responses
                </button>
              </div>
              {tab === "editor" ? (
                <FormEditor key={current.id} form={current} projectId={projectId} />
              ) : (
                <ResponsesView projectId={projectId} formId={current.id} fields={(current.fields as IntakeField[]) ?? []} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function NewFormButton({ projectId, onCreated }: { projectId: string; onCreated: (id: string) => void }) {
  const save = useSaveIntakeForm(projectId);
  return (
    <Button
      size="sm"
      onClick={async () => {
        try {
          const r = await save.mutateAsync({
            project_id: projectId,
            title: "Untitled form",
            description: "",
            status: "draft",
            visibility: "client",
            allow_anonymous: false,
            fields: [newField("short_text")],
          });
          const form = (r as { form?: { id: string } }).form;
          if (form?.id) onCreated(form.id);
          toast.success("Form created");
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    >
      <Plus className="mr-2 h-4 w-4" /> New form
    </Button>
  );
}

function FormEditor({ form, projectId }: { form: IntakeForm; projectId: string }) {
  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description ?? "");
  const [status, setStatus] = useState<IntakeFormStatus>(form.status);
  const [visibility, setVisibility] = useState<IntakeFormVisibility>(form.visibility);
  const [fields, setFields] = useState<IntakeField[]>(
    Array.isArray(form.fields) ? (form.fields as IntakeField[]) : [],
  );
  const save = useSaveIntakeForm(projectId);
  const del = useDeleteIntakeForm(projectId);

  const updateField = (id: string, patch: Partial<IntakeField>) =>
    setFields((arr) => arr.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeField = (id: string) => setFields((arr) => arr.filter((f) => f.id !== id));
  const move = (id: string, dir: -1 | 1) =>
    setFields((arr) => {
      const i = arr.findIndex((f) => f.id === id);
      if (i < 0) return arr;
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = arr.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const handleSave = async (overrideStatus?: IntakeFormStatus) => {
    try {
      await save.mutateAsync({
        id: form.id,
        project_id: projectId,
        title: title.trim() || "Untitled form",
        description: description.trim() || null,
        status: overrideStatus ?? status,
        visibility,
        allow_anonymous: form.allow_anonymous,
        fields,
      });
      if (overrideStatus) setStatus(overrideStatus);
      toast.success(overrideStatus === "published" ? "Form published" : "Saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Form title" />
          <Select value={visibility} onValueChange={(v) => setVisibility(v as IntakeFormVisibility)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Client visible</SelectItem>
              <SelectItem value="internal">Internal only</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as IntakeFormStatus)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description shown to clients above the questions"
          rows={2}
        />
      </Card>

      <div className="space-y-3">
        {fields.map((f, i) => (
          <FieldRow
            key={f.id}
            field={f}
            index={i}
            total={fields.length}
            onChange={(patch) => updateField(f.id, patch)}
            onRemove={() => removeField(f.id)}
            onMove={(d) => move(f.id, d)}
          />
        ))}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FIELD_TYPE_LABELS) as IntakeFieldType[]).map((t) => (
            <Button
              key={t}
              size="sm"
              variant="outline"
              onClick={() => setFields((arr) => [...arr, newField(t)])}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> {FIELD_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2 border-t border-border bg-background/80 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={async () => {
            if (!confirm("Delete this form and all responses?")) return;
            await del.mutateAsync(form.id);
            toast.success("Deleted");
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave()}>
            <Save className="mr-2 h-4 w-4" /> Save
          </Button>
          {status !== "published" ? (
            <Button size="sm" onClick={() => handleSave("published")}>
              <Send className="mr-2 h-4 w-4" /> Publish
            </Button>
          ) : (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Eye className="mr-1 h-3 w-3" /> Live in portal
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  field: IntakeField;
  index: number;
  total: number;
  onChange: (patch: Partial<IntakeField>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const hasOptions = field.type === "select" || field.type === "multiselect";
  return (
    <Card className="p-3">
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-center gap-1 pt-1 text-muted-foreground">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="text-[10px] disabled:opacity-30"
            title="Move up"
          >
            ▲
          </button>
          <GripVertical className="h-3 w-3" />
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="text-[10px] disabled:opacity-30"
            title="Move down"
          >
            ▼
          </button>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
            <Input
              value={field.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Question"
            />
            <Select
              value={field.type}
              onValueChange={(v) => {
                const type = v as IntakeFieldType;
                onChange({
                  type,
                  options:
                    type === "select" || type === "multiselect"
                      ? (field.options ?? ["Option 1"])
                      : undefined,
                });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FIELD_TYPE_LABELS) as IntakeFieldType[]).map((t) => (
                  <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            value={field.help ?? ""}
            onChange={(e) => onChange({ help: e.target.value })}
            placeholder="Helper text (optional)"
            className="text-xs"
          />
          {hasOptions && (
            <div className="space-y-1 rounded-md border border-border/60 bg-muted/30 p-2">
              {(field.options ?? []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = (field.options ?? []).slice();
                      next[i] = e.target.value;
                      onChange({ options: next });
                    }}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      const next = (field.options ?? []).filter((_, j) => j !== i);
                      onChange({ options: next.length ? next : ["Option 1"] });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onChange({ options: [...(field.options ?? []), `Option ${(field.options ?? []).length + 1}`] })}
              >
                <Plus className="mr-1.5 h-3 w-3" /> Add option
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <Label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={!!field.required}
                onCheckedChange={(c) => onChange({ required: c })}
              />
              Required
            </Label>
            <Button size="icon" variant="ghost" onClick={onRemove} title="Remove">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ResponsesView({
  projectId,
  formId,
  fields,
}: {
  projectId: string;
  formId: string;
  fields: IntakeField[];
}) {
  const { data: responses = [], isLoading } = useIntakeResponses(projectId, formId);

  const columns = useMemo(() => fields.slice(0, 6), [fields]);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (responses.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No responses yet. Share the client portal link — clients will see this form under
        "Forms" once it's published and visibility is set to "Client visible".
      </Card>
    );
  }
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="p-2 text-left">Submitted</th>
            <th className="p-2 text-left">From</th>
            {columns.map((c) => (
              <th key={c.id} className="p-2 text-left">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {responses.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="p-2 text-xs text-muted-foreground">
                {new Date(r.submitted_at).toLocaleString()}
              </td>
              <td className="p-2 text-xs">
                <div className="font-medium">{r.respondent_name ?? "—"}</div>
                <div className="text-muted-foreground">{r.respondent_email ?? ""}</div>
              </td>
              {columns.map((c) => (
                <td key={c.id} className="max-w-[260px] truncate p-2 text-xs">
                  {formatAnswer((r.answers as Record<string, unknown>)?.[c.id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function formatAnswer(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
