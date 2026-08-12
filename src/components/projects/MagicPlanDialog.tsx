import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Flag, CheckSquare, Users, ShieldCheck, RotateCw } from "lucide-react";
import { usePlaybooks } from "@/hooks/use-playbooks";
import { useGenerateMagicPlan, useApplyMagicPlan, type MagicPlan } from "@/hooks/use-magic-plan";
import { MILESTONE_TYPE_META, type MilestoneType } from "@/lib/milestone-types";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function MagicPlanDialog({ projectId, open, onOpenChange }: Props) {
  const { data: playbooks = [] } = usePlaybooks();
  const generate = useGenerateMagicPlan();
  const apply = useApplyMagicPlan();

  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [playbookId, setPlaybookId] = useState<string>("_none");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [plan, setPlan] = useState<MagicPlan | null>(null);

  const reset = () => {
    setPlan(null);
    setPrompt("");
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const onGenerate = async () => {
    if (prompt.trim().length < 10) return;
    const result = await generate.mutateAsync({
      prompt: prompt.trim(),
      duration_days: duration,
      playbook_id: playbookId === "_none" ? null : playbookId,
    });
    setPlan(result);
  };

  const onApply = async () => {
    if (!plan) return;
    await apply.mutateAsync({ project_id: projectId, start_date: startDate, plan });
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Magic Plan
          </DialogTitle>
          <DialogDescription>
            Describe the engagement in a sentence or two. AI drafts the milestones and tasks —
            you preview, then apply.
          </DialogDescription>
        </DialogHeader>

        {!plan ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">What are we delivering?</Label>
              <Textarea
                rows={4}
                placeholder="e.g. 6-week Salesforce CPQ implementation for a 200-seat manufacturing client — config, data migration, training, go-live."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Duration (days)</Label>
                <Input
                  type="number"
                  min={7}
                  max={365}
                  value={duration}
                  onChange={(e) => setDuration(Math.max(7, Math.min(365, parseInt(e.target.value) || 30)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Seed playbook (optional)</Label>
                <Select value={playbookId} onValueChange={setPlaybookId}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None — pure AI draft</SelectItem>
                    {playbooks.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {generate.isError && (
              <p className="text-xs text-rose-600">{(generate.error as Error).message}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs font-medium">Draft plan</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setPlan(null)} className="h-7 gap-1.5 text-xs">
                  <RotateCw className="h-3 w-3" /> Re-prompt
                </Button>
              </div>
              {plan.summary && (
                <p className="mt-1.5 text-xs text-muted-foreground">{plan.summary}</p>
              )}
            </div>

            <div className="max-h-[40vh] space-y-4 overflow-y-auto pr-1">
              <section>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                  <Flag className="h-3.5 w-3.5" /> Milestones ({plan.milestones.length})
                </div>
                <ul className="space-y-1.5">
                  {plan.milestones.map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant="secondary" className={MILESTONE_TYPE_META[m.milestone_type as MilestoneType].tone}>
                          {MILESTONE_TYPE_META[m.milestone_type as MilestoneType].label}
                        </Badge>
                        <span className="truncate text-sm">{m.name}</span>
                        {m.requires_signoff && (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <ShieldCheck className="h-3 w-3" /> Sign-off
                          </Badge>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">Day +{m.day_offset}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                  <CheckSquare className="h-3.5 w-3.5" /> Tasks ({plan.tasks.length})
                </div>
                <ul className="space-y-1.5">
                  {plan.tasks.map((t, i) => {
                    const ms = t.milestone_index != null ? plan.milestones[t.milestone_index] : null;
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {t.is_customer_task && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <Users className="h-3 w-3" /> Customer
                            </Badge>
                          )}
                          <span className="truncate text-sm">{t.title}</span>
                          {ms && <span className="truncate text-xs text-muted-foreground">· {ms.name}</span>}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t.day_offset_due != null ? `Due +${t.day_offset_due}d` : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Start date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Relative offsets (Day +N) anchor here.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
          {!plan ? (
            <Button
              onClick={onGenerate}
              disabled={prompt.trim().length < 10 || generate.isPending}
            >
              {generate.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate plan
            </Button>
          ) : (
            <Button onClick={onApply} disabled={apply.isPending}>
              {apply.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Apply to project
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
