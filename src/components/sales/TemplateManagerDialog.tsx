import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Sparkles, Pencil, Lock, GripVertical } from "lucide-react";
import {
  useDeliverableTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useGenerateTemplate,
  type TemplateRow,
} from "@/hooks/use-deliverable-templates";

const SECTION_KINDS = [
  "text",
  "list",
  "table",
  "deliverables",
  "team",
  "timeline",
  "financials",
  "risks",
] as const;
type SectionKind = (typeof SECTION_KINDS)[number];

type Section = {
  key: string;
  label: string;
  kind: SectionKind;
  required?: boolean;
  ai_prompt?: string;
};

const KIND_OPTIONS = [
  { value: "custom", label: "Custom" },
  { value: "sow", label: "Statement of Work" },
  { value: "proposal", label: "Proposal" },
  { value: "discovery_report", label: "Discovery Report" },
  { value: "tech_architecture", label: "Tech Architecture" },
  { value: "business_case", label: "Business Case" },
  { value: "rfp_response", label: "RFP Response" },
  { value: "pricing_options", label: "Pricing Options" },
  { value: "security_questionnaire", label: "Security Questionnaire" },
  { value: "mutual_action_plan", label: "Mutual Action Plan" },
  { value: "capability_deck", label: "Capability Deck" },
  { value: "demo_script", label: "Demo Script" },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function TemplateEditor({
  initial,
  onCancel,
  onSubmit,
  submitting,
  isEdit,
}: {
  initial: Partial<TemplateRow>;
  onCancel: () => void;
  onSubmit: (payload: {
    kind: string;
    name: string;
    description?: string;
    schema: { sections: Section[] };
    default_model?: string;
  }) => void;
  submitting: boolean;
  isEdit: boolean;
}) {
  const [kind, setKind] = useState(initial.kind ?? "custom");
  const [name, setName] = useState(initial.name ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [sections, setSections] = useState<Section[]>(
    (initial.schema?.sections as Section[] | undefined) ?? [
      { key: "summary", label: "Summary", kind: "text", required: true },
    ],
  );

  const updateSection = (i: number, patch: Partial<Section>) => {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const move = (i: number, dir: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const valid =
    name.trim().length > 0 &&
    sections.length > 0 &&
    sections.every((s) => s.key && s.label) &&
    new Set(sections.map((s) => s.key)).size === sections.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Enterprise SaaS SOW" />
        </div>
        <div>
          <Label className="text-xs">Archetype</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((k) => (
                <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Description</Label>
        <Textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="When should this template be used?"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs">Sections ({sections.length})</Label>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setSections((p) => [
                ...p,
                { key: `section_${p.length + 1}`, label: "New section", kind: "text" },
              ])
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add section
          </Button>
        </div>
        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {sections.map((s, i) => (
            <div key={i} className="rounded-md border border-border p-2 space-y-2 bg-background">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button onClick={() => move(i, -1)} className="text-muted-foreground hover:text-foreground">▴</button>
                  <button onClick={() => move(i, 1)} className="text-muted-foreground hover:text-foreground">▾</button>
                </div>
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="h-8 flex-1"
                  value={s.label}
                  onChange={(e) => updateSection(i, { label: e.target.value, key: s.key || slugify(e.target.value) })}
                  placeholder="Label"
                />
                <Input
                  className="h-8 w-40 font-mono text-xs"
                  value={s.key}
                  onChange={(e) => updateSection(i, { key: slugify(e.target.value) })}
                  placeholder="snake_case_key"
                />
                <Select value={s.kind} onValueChange={(v) => updateSection(i, { kind: v as SectionKind })}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SECTION_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1 text-xs">
                  <Switch checked={!!s.required} onCheckedChange={(v) => updateSection(i, { required: v })} />
                  <span className="text-muted-foreground">req</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => setSections((p) => p.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea
                rows={1}
                className="text-xs"
                value={s.ai_prompt ?? ""}
                onChange={(e) => updateSection(i, { ai_prompt: e.target.value })}
                placeholder="Optional AI guidance for this section…"
              />
            </div>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button
          disabled={!valid || submitting}
          onClick={() =>
            onSubmit({
              kind,
              name: name.trim(),
              description: description.trim() || undefined,
              schema: { sections },
            })
          }
        >
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Create template"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function AiTemplateForm({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
  const [desc, setDesc] = useState("");
  const [baseKind, setBaseKind] = useState<string>("custom");
  const gen = useGenerateTemplate(workspaceId);
  return (
    <div className="space-y-3 rounded-md border border-dashed border-border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" /> Draft a template with AI
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2">
        <Textarea
          rows={3}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder='e.g. "A short technical due-diligence report for AI engagements covering data, model, infra, risks."'
        />
        <Select value={baseKind} onValueChange={setBaseKind}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((k) => (
              <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={desc.trim().length < 10 || gen.isPending}
          onClick={async () => {
            await gen.mutateAsync({ description: desc.trim(), base_kind: baseKind });
            setDesc("");
            onDone();
          }}
        >
          {gen.isPending ? "Drafting…" : "Generate template"}
        </Button>
      </div>
    </div>
  );
}

export function TemplateManagerDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: rows, isLoading } = useDeliverableTemplates(workspaceId);
  const create = useCreateTemplate(workspaceId);
  const update = useUpdateTemplate(workspaceId);
  const del = useDeleteTemplate(workspaceId);

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editing, setEditing] = useState<TemplateRow | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deliverable templates</DialogTitle>
          <DialogDescription>
            Define custom pre-sales artifacts your team can spin up. The agent uses each template's sections as the generation schema.
          </DialogDescription>
        </DialogHeader>

        {mode === "list" && (
          <>
            <AiTemplateForm workspaceId={workspaceId} onDone={() => setMode("list")} />
            <div className="flex justify-between items-center pt-2">
              <div className="text-xs text-muted-foreground">
                {rows?.length ?? 0} workspace template{(rows?.length ?? 0) === 1 ? "" : "s"}
              </div>
              <Button size="sm" variant="outline" onClick={() => { setEditing(null); setMode("create"); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Blank template
              </Button>
            </div>
            <div className="space-y-2 mt-2">
              {isLoading ? (
                <div className="text-sm text-muted-foreground text-center py-6">Loading…</div>
              ) : !rows?.length ? (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No custom templates yet. Use AI above or create a blank one.
                </div>
              ) : (
                rows.map((t) => (
                  <div key={t.id} className="rounded-md border border-border p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium truncate">{t.name}</div>
                        <Badge variant="outline" className="text-[10px]">{t.kind}</Badge>
                        {t.is_system && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Lock className="h-3 w-3" /> system
                          </Badge>
                        )}
                      </div>
                      {t.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {t.schema?.sections?.length ?? 0} sections
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={t.is_system}
                        onClick={() => { setEditing(t); setMode("edit"); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        disabled={t.is_system}
                        onClick={() => {
                          if (confirm(`Delete "${t.name}"?`)) del.mutate(t.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {mode === "create" && (
          <TemplateEditor
            initial={{}}
            isEdit={false}
            submitting={create.isPending}
            onCancel={() => setMode("list")}
            onSubmit={async (payload) => {
              await create.mutateAsync(payload);
              setMode("list");
            }}
          />
        )}

        {mode === "edit" && editing && (
          <TemplateEditor
            initial={editing}
            isEdit
            submitting={update.isPending}
            onCancel={() => { setEditing(null); setMode("list"); }}
            onSubmit={async (payload) => {
              await update.mutateAsync({
                template_id: editing.id,
                name: payload.name,
                description: payload.description ?? null,
                schema: payload.schema,
              });
              setEditing(null);
              setMode("list");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
