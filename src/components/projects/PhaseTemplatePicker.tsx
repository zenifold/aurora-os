import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, Layers, Plus, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listPhaseTemplatesForProject,
  applyPhaseTemplateToProject,
  saveProjectPhasesAsTemplate,
} from "@/lib/phases.functions";

type TemplatePhase = {
  id: string;
  key: string;
  name: string;
  color: string | null;
  order_index: number;
  owner_role: string | null;
  target_days: number | null;
  is_terminal: boolean;
};
type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  default_duration_days: number | null;
  phases: TemplatePhase[];
};

/** "Apply phase template" dialog. */
export function ApplyPhaseTemplateDialog({
  projectId,
  open,
  onOpenChange,
  hasExistingPhases,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  hasExistingPhases: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPhaseTemplatesForProject);
  const applyFn = useServerFn(applyPhaseTemplateToProject);
  const [selected, setSelected] = useState<string | null>(null);
  const [replace, setReplace] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["phase-templates", projectId],
    enabled: open,
    queryFn: () =>
      listFn({ data: { project_id: projectId } }) as Promise<TemplateRow[]>,
  });

  const apply = useMutation({
    mutationFn: () =>
      applyFn({
        data: { project_id: projectId, template_id: selected!, replace },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["engagement-phases", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      const r = res as { applied: number; skipped: number };
      toast.success(
        `Applied ${r.applied} phase${r.applied === 1 ? "" : "s"}` +
          (r.skipped ? ` (${r.skipped} skipped, key already in use)` : ""),
      );
      onOpenChange(false);
      setSelected(null);
      setReplace(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withPhases = data.filter((t) => t.phases.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" /> Apply a phase template
          </DialogTitle>
          <DialogDescription>
            Templates instantiate a set of phases on this project. You can edit
            or skip phases afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto rounded-md border border-border">
          {isLoading && (
            <div className="p-6 text-sm text-muted-foreground">Loading templates…</div>
          )}
          {!isLoading && withPhases.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              No templates with phases yet in this workspace. Save your current
              project's phases as a template to reuse them next time.
            </div>
          )}
          <ul className="divide-y divide-border">
            {withPhases.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelected(t.id)}
                  className={`flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted ${
                    selected === t.id ? "bg-muted/70" : ""
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      selected === t.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {selected === t.id && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{t.name}</p>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t.category.replace("_", " ")}
                      </span>
                      {t.default_duration_days != null && (
                        <span className="text-[11px] text-muted-foreground">
                          ~{t.default_duration_days}d
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {t.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {t.phases.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px]"
                          style={p.color ? { borderColor: p.color, color: p.color } : undefined}
                        >
                          <Flag className="h-2.5 w-2.5" />
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {hasExistingPhases && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={replace}
              onCheckedChange={(v) => setReplace(v === true)}
            />
            Replace the existing phases on this project
            <span className="text-xs text-muted-foreground">
              (otherwise we'll skip any phase whose key already exists)
            </span>
          </label>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selected || apply.isPending}
            onClick={() => apply.mutate()}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {apply.isPending ? "Applying…" : "Apply template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Save current phases as a new template" dialog. */
export function SavePhasesAsTemplateDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveProjectPhasesAsTemplate);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"web_build" | "retainer" | "consulting" | "implementation" | "custom">(
    "custom",
  );

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          project_id: projectId,
          name,
          description: description || null,
          category,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["phase-templates", projectId] });
      toast.success(`Saved "${name}" as a phase template`);
      onOpenChange(false);
      setName("");
      setDescription("");
      setCategory("custom");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-4 w-4" /> Save as phase template
          </DialogTitle>
          <DialogDescription>
            Snapshots this project's current phases into a reusable workspace template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="tpl-name">Template name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Agency engagement"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="tpl-desc">Description</Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When should the team reach for this template?"
              rows={3}
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="web_build">Web build</SelectItem>
                <SelectItem value="retainer">Retainer</SelectItem>
                <SelectItem value="consulting">Consulting</SelectItem>
                <SelectItem value="implementation">Implementation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
