import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { useProjects } from "@/hooks/use-projects";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  ALL_TRANSFORMS,
  BINDING_SOURCES,
  defaultTransformFor,
  type BindingAttrs,
  type BindingSource,
  type BindingTransform,
} from "@/lib/bindings";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (attrs: BindingAttrs) => void;
  /** When opened from a project page, preselect that project. */
  defaultProjectId?: string | null;
}

export function BindingPickerDialog({ open, onOpenChange, onInsert, defaultProjectId }: Props) {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: projects = [] } = useProjects();

  const [source, setSource] = useState<BindingSource>("project");
  const [targetId, setTargetId] = useState<string | null>(defaultProjectId ?? null);
  const [field, setField] = useState<string>("name");
  const [transform, setTransform] = useState<BindingTransform | "none">("none");
  const [fallback, setFallback] = useState("—");
  const [taskQuery, setTaskQuery] = useState("");
  const [tasks, setTasks] = useState<Array<{ id: string; title: string }>>([]);

  const srcDef = useMemo(() => BINDING_SOURCES.find((s) => s.source === source), [source]);
  const fieldDef = useMemo(() => srcDef?.fields.find((f) => f.key === field), [srcDef, field]);

  // Reset child state when source changes
  useEffect(() => {
    const def = BINDING_SOURCES.find((s) => s.source === source);
    if (!def) return;
    setField(def.fields[0].key);
    if (source !== "project") setTargetId(null);
    else setTargetId(defaultProjectId ?? projects[0]?.id ?? null);
    setTaskQuery("");
    setTasks([]);
  }, [source, defaultProjectId, projects]);

  // Default transform when field changes
  useEffect(() => {
    if (!fieldDef) return;
    const def = defaultTransformFor(fieldDef.kind);
    setTransform(def ?? "none");
  }, [fieldDef]);

  // Task search
  useEffect(() => {
    if (source !== "task" || !ws) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const q = supabase
        .from("tasks")
        .select("id,title")
        .eq("workspace_id", ws.id)
        .order("updated_at", { ascending: false })
        .limit(20);
      const { data } = taskQuery ? await q.ilike("title", `%${taskQuery}%`) : await q;
      if (!cancelled) {
        setTasks(data ?? []);
        if (!targetId && data && data[0]) setTargetId(data[0].id);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, taskQuery, ws?.id]);

  const handleInsert = () => {
    if (!srcDef) return;
    if (srcDef.needsTarget && !targetId) return;
    const label =
      source === "project"
        ? projects.find((p) => p.id === targetId)?.name ?? null
        : source === "task"
          ? tasks.find((t) => t.id === targetId)?.title ?? null
          : null;
    onInsert({
      source,
      targetId: srcDef.needsTarget ? targetId : null,
      field,
      transform: transform === "none" ? null : transform,
      fallback: fallback || "—",
      label,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Insert live data</DialogTitle>
          <DialogDescription>
            The value updates automatically whenever the source data changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as BindingSource)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BINDING_SOURCES.map((s) => (
                  <SelectItem key={s.source} value={s.source}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {source === "project" && (
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={targetId ?? ""} onValueChange={setTargetId}>
                <SelectTrigger><SelectValue placeholder="Choose a project…" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {source === "task" && (
            <div className="space-y-1.5">
              <Label>Task</Label>
              <Input
                placeholder="Search tasks…"
                value={taskQuery}
                onChange={(e) => setTaskQuery(e.target.value)}
              />
              <Select value={targetId ?? ""} onValueChange={setTargetId}>
                <SelectTrigger><SelectValue placeholder="Choose a task…" /></SelectTrigger>
                <SelectContent>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Field</Label>
            <Select value={field} onValueChange={setField}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {srcDef?.fields.map((f) => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select value={transform} onValueChange={(v) => setTransform(v as BindingTransform | "none")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (raw)</SelectItem>
                  {ALL_TRANSFORMS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fallback if empty</Label>
              <Input value={fallback} onChange={(e) => setFallback(e.target.value)} placeholder="—" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleInsert} disabled={srcDef?.needsTarget && !targetId}>Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
