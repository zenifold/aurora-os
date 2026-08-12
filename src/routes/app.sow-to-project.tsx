import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  FileText,
  Wand2,
  Loader2,
  Flag,
  ListChecks,
  Rocket,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  draftProjectFromBrief,
  createProjectFromPlan,
  type GeneratedPlan,
} from "@/server/sow-project.functions";

export const Route = createFileRoute("/app/sow-to-project")({
  component: SowToProjectPage,
});

const SAMPLE = `Client: Acme Corp (B2B SaaS)
Project: Rebuild marketing site & launch new pricing page
Budget: USD 60,000 fixed fee
Timeline: 10 weeks starting in 2 weeks
Scope:
- Discovery workshops with marketing + sales
- New brand-aligned visual design
- Build on Webflow with CMS for blog
- New pricing page with interactive plan comparison
- Analytics setup (GA4, segment events) and 301 redirects from old site
- Soft launch then full cutover
Out of scope: paid media, content production (client provides copy).
`;

function SowToProjectPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const navigate = useNavigate();
  const [brief, setBrief] = useState("");
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);

  const draft = useServerFn(draftProjectFromBrief);
  const create = useServerFn(createProjectFromPlan);

  const draftMut = useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("No workspace");
      return draft({ data: { workspace_id: ws.id, brief: brief.trim() } });
    },
    onSuccess: (p) => {
      setPlan(p);
      toast.success("Plan drafted — review and adjust below");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!ws || !plan) throw new Error("No plan");
      return create({ data: { workspace_id: ws.id, plan } });
    },
    onSuccess: (res) => {
      toast.success(
        `Project created · ${res.milestone_count} phases · ${res.task_count} tasks`,
      );
      navigate({
        to: "/app/p/$projectId/overview",
        params: { projectId: res.project_id },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePlan = (patch: Partial<GeneratedPlan>) =>
    setPlan((p) => (p ? { ...p, ...patch } : p));

  const updatePhase = (idx: number, patch: Partial<GeneratedPlan["phases"][number]>) =>
    setPlan((p) => {
      if (!p) return p;
      const phases = [...p.phases];
      phases[idx] = { ...phases[idx], ...patch };
      return { ...p, phases };
    });

  const removePhase = (idx: number) =>
    setPlan((p) =>
      p ? { ...p, phases: p.phases.filter((_, i) => i !== idx) } : p,
    );

  const addPhase = () =>
    setPlan((p) =>
      p
        ? {
            ...p,
            phases: [
              ...p.phases,
              {
                name: "New phase",
                description: "",
                target_date: null,
                payment_amount: null,
                tasks: [],
              },
            ],
          }
        : p,
    );

  const totalAmount = plan?.phases.reduce(
    (s, ph) => s + (ph.payment_amount ?? 0),
    0,
  );
  const totalTasks = plan?.phases.reduce((s, ph) => s + ph.tasks.length, 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8">
      <Link
        to="/app"
        className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 p-2">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="bg-aura-gradient bg-clip-text text-2xl font-semibold text-transparent">
            SOW → Project
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste a brief or statement of work. Aura drafts phases, tasks, financials,
            and a kickoff page in one go.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" /> Brief
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Paste the SOW, statement of work, RFP response, or short engagement brief…"
            rows={10}
            className="font-mono text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setBrief(SAMPLE)}
            >
              Try sample brief
            </Button>
            <Button
              onClick={() => draftMut.mutate()}
              disabled={brief.trim().length < 20 || draftMut.isPending}
            >
              {draftMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Drafting plan…
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" /> Draft plan with Aura
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {plan && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Plan preview</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="gap-1">
                  <Flag className="h-3 w-3" /> {plan.phases.length} phases
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <ListChecks className="h-3 w-3" /> {totalTasks ?? 0} tasks
                </Badge>
                {totalAmount ? (
                  <Badge variant="outline">
                    {plan.currency} {totalAmount.toLocaleString()}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Project name</Label>
                <Input
                  value={plan.project_name}
                  onChange={(e) => updatePlan({ project_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Client</Label>
                <Input
                  value={plan.client_name ?? ""}
                  onChange={(e) =>
                    updatePlan({ client_name: e.target.value || null })
                  }
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={plan.start_date ?? ""}
                  onChange={(e) => updatePlan({ start_date: e.target.value || null })}
                />
              </div>
              <div>
                <Label>Target end date</Label>
                <Input
                  type="date"
                  value={plan.target_end_date ?? ""}
                  onChange={(e) =>
                    updatePlan({ target_end_date: e.target.value || null })
                  }
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Input
                  value={plan.currency}
                  onChange={(e) => updatePlan({ currency: e.target.value })}
                />
              </div>
              <div>
                <Label>Contract value</Label>
                <Input
                  type="number"
                  value={plan.contract_value ?? ""}
                  onChange={(e) =>
                    updatePlan({
                      contract_value: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Phases &amp; tasks</Label>
                <Button size="sm" variant="ghost" onClick={addPhase}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add phase
                </Button>
              </div>
              <div className="space-y-3">
                {plan.phases.map((ph, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-card/60 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Input
                        value={ph.name}
                        onChange={(e) => updatePhase(i, { name: e.target.value })}
                        className="h-8 max-w-xs font-medium"
                      />
                      <Input
                        type="date"
                        value={ph.target_date ?? ""}
                        onChange={(e) =>
                          updatePhase(i, { target_date: e.target.value || null })
                        }
                        className="h-8 w-40"
                      />
                      <Input
                        type="number"
                        placeholder="Payment"
                        value={ph.payment_amount ?? ""}
                        onChange={(e) =>
                          updatePhase(i, {
                            payment_amount: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        className="h-8 w-32"
                      />
                      <span className="text-xs text-muted-foreground">
                        {ph.tasks.length} task{ph.tasks.length === 1 ? "" : "s"}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto h-7 w-7"
                        onClick={() => removePhase(i)}
                        aria-label="Remove phase"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {ph.description && (
                      <p className="mb-2 text-xs text-muted-foreground">
                        {ph.description}
                      </p>
                    )}
                    {ph.tasks.length > 0 && (
                      <ul className="space-y-1 text-sm">
                        {ph.tasks.map((t, ti) => (
                          <li
                            key={ti}
                            className="flex items-center gap-2 rounded px-2 py-1 hover:bg-accent/30"
                          >
                            <span className="text-muted-foreground">·</span>
                            <span className="flex-1">{t.title}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {t.priority}
                            </Badge>
                            {t.estimate_hours ? (
                              <span className="text-xs text-muted-foreground">
                                {t.estimate_hours}h
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setPlan(null)}>
                Discard
              </Button>
              <Button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending}
              >
                {createMut.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-4 w-4" /> Create project
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
