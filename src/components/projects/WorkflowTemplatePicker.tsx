import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from "@/lib/workflow-templates";
import { useApplyWorkflowTemplate } from "@/hooks/use-workflow-templates";
import { ArrowRight } from "lucide-react";

/**
 * Browse workflow templates and apply one to the project — replaces statuses
 * and transitions with the template's configuration.
 */
export function WorkflowTemplatePicker({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<WorkflowTemplate | null>(null);
  const apply = useApplyWorkflowTemplate(projectId);

  const onApply = async () => {
    if (!picked) return;
    if (!confirm(`Replace this project's workflow with "${picked.name}"? Existing tasks will keep their status name.`)) return;
    await apply.mutateAsync(picked);
    setOpen(false);
    setPicked(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Workflow templates</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {WORKFLOW_TEMPLATES.map((tpl) => {
            const selected = picked?.id === tpl.id;
            return (
              <button
                key={tpl.id}
                onClick={() => setPicked(tpl)}
                className={`flex flex-col rounded-lg border p-4 text-left transition ${
                  selected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{tpl.emoji}</span>
                  <span className="font-medium">{tpl.name}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tpl.description}</p>

                <div className="mt-3 flex flex-wrap items-center gap-1">
                  {tpl.statuses.map((s, i) => (
                    <div key={i} className="flex items-center gap-1">
                      {i > 0 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />}
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ background: s.color }}
                      >
                        {s.name}
                      </span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={onApply}
            disabled={!picked || apply.isPending}
            className="bg-aura-gradient text-primary-foreground"
          >
            {apply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
