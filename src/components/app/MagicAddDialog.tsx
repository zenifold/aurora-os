import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { generateTasksFromPrompt } from "@/server/magic-add.functions";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sparkles, Loader2, Wand2, X } from "lucide-react";
import { AssigneePicker } from "@/components/tasks/AssigneePicker";

type Generated = {
  title: string;
  description?: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  tags: string[];
};

const SUGGESTIONS = [
  "Plan a Q1 product launch",
  "Onboard a new engineer",
  "Run a customer research sprint",
  "Migrate database to a new region",
];

export function MagicAddDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
}) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  const generate = useServerFn(generateTasksFromPrompt);

  const [prompt, setPrompt] = useState("");
  const [maxTasks, setMaxTasks] = useState(8);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<Generated[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [inserting, setInserting] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [meta, setMeta] = useState<{ tokens: number | null; model: string | null }>({
    tokens: null,
    model: null,
  });

  const reset = () => {
    setPrompt("");
    setGenerated(null);
    setSelected(new Set());
    setMeta({ tokens: null, model: null });
  };

  const close = () => {
    if (loading || inserting) return;
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const onGenerate = async () => {
    if (!ws || !prompt.trim()) return;
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error("Please sign in again before using Magic Add.");
        return;
      }

      const res = await generate({
        data: { workspace_id: ws.id, prompt: prompt.trim(), max_tasks: maxTasks },
        headers: { authorization: `Bearer ${token}` },
      });
      const serverError = (res as { error?: unknown })?.error;
      if (typeof serverError === "string" && serverError) {
        toast.error(serverError);
        return;
      }
      const tasks = (res as { tasks?: unknown })?.tasks;
      if (!Array.isArray(tasks) || tasks.length === 0) {
        toast.error("AI didn't return any tasks. Try rephrasing your prompt.");
        return;
      }
      setGenerated(tasks as Generated[]);
      setSelected(new Set(tasks.map((_, i) => i)));
      setMeta({
        tokens: (res as { tokens_used?: number | null })?.tokens_used ?? null,
        model: (res as { model_used?: string | null })?.model_used ?? null,
      });
    } catch (err) {
      let msg = "Generation failed";
      if (err instanceof Response) {
        try { msg = (await err.text()) || `HTTP ${err.status}`; } catch { msg = `HTTP ${err.status}`; }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onInsert = async () => {
    if (!ws || !user || !generated) return;
    const toInsert = generated.filter((_, i) => selected.has(i));
    if (toInsert.length === 0) return;
    setInserting(true);

    const { data: existing } = await supabase
      .from("tasks")
      .select("position")
      .eq("project_id", projectId)
      .order("position", { ascending: false })
      .limit(1);
    let nextPos =
      existing && existing.length > 0 ? Number(existing[0].position) + 1000 : 0;

    const rows = toInsert.map((t) => {
      const row = {
        workspace_id: ws.id,
        project_id: projectId,
        title: t.title,
        priority: t.priority,
        tags: t.tags ?? [],
        status: "todo",
        position: nextPos,
        created_by: user.id,
        description: t.description
          ? {
              type: "doc",
              content: [
                { type: "paragraph", content: [{ type: "text", text: t.description }] },
              ],
            }
          : null,
      };
      nextPos += 1000;
      return row;
    });

    const { error } = await supabase.from("tasks").insert(rows as never);
    setInserting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${toInsert.length} task${toInsert.length === 1 ? "" : "s"} added`);
    qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    close();
  };

  const updateField = (idx: number, patch: Partial<Generated>) => {
    if (!generated) return;
    setGenerated(generated.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const toggleSelected = (idx: number) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelected(next);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" /> Magic Add — generate tasks with AI
          </DialogTitle>
        </DialogHeader>

        {!generated && (
          <div className="space-y-3">
            <div>
              <Label>Describe what you want to accomplish</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="e.g. Launch a beta of our new analytics dashboard"
                className="mt-1.5"
                autoFocus
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrompt(s)}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground">Max tasks</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={maxTasks}
                onChange={(e) => setMaxTasks(Math.max(1, Math.min(20, Number(e.target.value) || 8)))}
                className="h-8 w-20"
              />
            </div>
          </div>
        )}

        {generated && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {selected.size} of {generated.length} selected
              </span>
              <span className="font-mono">
                {meta.model}
                {meta.tokens != null && ` · ${meta.tokens} tok`}
              </span>
            </div>
            <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
              {generated.map((t, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition ${
                    selected.has(i)
                      ? "border-primary/40 bg-aura-gradient-subtle"
                      : "border-border bg-card opacity-60"
                  }`}
                >
                  <Checkbox
                    checked={selected.has(i)}
                    onCheckedChange={() => toggleSelected(i)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Input
                      value={t.title}
                      onChange={(e) => updateField(i, { title: e.target.value })}
                      className="h-8 border-transparent bg-transparent px-1 font-medium focus-visible:bg-background"
                    />
                    {t.description && (
                      <p className="px-1 text-xs text-muted-foreground">{t.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 px-1">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {t.priority}
                      </Badge>
                      {t.tags?.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGenerated(generated.filter((_, j) => j !== i));
                      const next = new Set(selected);
                      next.delete(i);
                      setSelected(next);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {generated && (
            <Button variant="ghost" onClick={() => setGenerated(null)} disabled={inserting}>
              Try another prompt
            </Button>
          )}
          <Button variant="ghost" onClick={close} disabled={loading || inserting}>
            Cancel
          </Button>
          {!generated ? (
            <Button
              onClick={onGenerate}
              disabled={loading || prompt.trim().length < 3}
              className="bg-aura-gradient text-primary-foreground hover:opacity-90"
            >
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
              Generate
            </Button>
          ) : (
            <Button
              onClick={onInsert}
              disabled={inserting || selected.size === 0}
              className="bg-aura-gradient text-primary-foreground hover:opacity-90"
            >
              {inserting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Add {selected.size} task{selected.size === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
