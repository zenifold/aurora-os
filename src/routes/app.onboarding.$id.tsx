import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle, AlertCircle, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  getOnboarding,
  completeOnboardingStep,
  advanceOnboardingStage,
  createHandoverPacket,
  submitHandover,
  acceptHandover,
  rejectHandover,
  toggleChecklistItem,
} from "@/lib/onboarding.functions";
import { useWorkspaceStore } from "@/stores/workspace-store";

export const Route = createFileRoute("/app/onboarding/$id")({ component: OnboardingDetail });

const STAGES = ["kickoff_pending", "intake", "setup", "handover", "active", "cancelled"] as const;
const TEAMS = ["sales", "delivery", "ops", "support", "finance"] as const;

function OnboardingDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const ws = useWorkspaceStore((s) => s.current);
  const getFn = useServerFn(getOnboarding);
  const stepFn = useServerFn(completeOnboardingStep);
  const advanceFn = useServerFn(advanceOnboardingStage);
  const createPacketFn = useServerFn(createHandoverPacket);
  const submitFn = useServerFn(submitHandover);
  const acceptFn = useServerFn(acceptHandover);
  const rejectFn = useServerFn(rejectHandover);
  const toggleFn = useServerFn(toggleChecklistItem);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["onboarding", id] });

  const stepMut = useMutation({
    mutationFn: (vars: { id: string; status: "pending" | "in_progress" | "complete" | "skipped" | "blocked" }) =>
      stepFn({ data: vars }),
    onSuccess: invalidate,
  });
  const stageMut = useMutation({
    mutationFn: (stage: typeof STAGES[number]) => advanceFn({ data: { id, stage } }),
    onSuccess: () => { invalidate(); toast.success("Stage updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const submitMut = useMutation({ mutationFn: (pid: string) => submitFn({ data: { id: pid } }), onSuccess: invalidate });
  const acceptMut = useMutation({ mutationFn: (pid: string) => acceptFn({ data: { id: pid } }), onSuccess: () => { invalidate(); toast.success("Handover accepted"); } });
  const rejectMut = useMutation({
    mutationFn: (vars: { id: string; reason: string }) => rejectFn({ data: vars }),
    onSuccess: () => { invalidate(); toast.info("Handover rejected"); },
  });
  const toggleMut = useMutation({
    mutationFn: (vars: { id: string; is_complete: boolean }) => toggleFn({ data: vars }),
    onSuccess: invalidate,
  });

  const [packetOpen, setPacketOpen] = useState(false);
  const [fromTeam, setFromTeam] = useState<typeof TEAMS[number]>("sales");
  const [toTeam, setToTeam] = useState<typeof TEAMS[number]>("delivery");
  const [summary, setSummary] = useState("");
  const [scope, setScope] = useState("");
  const [risks, setRisks] = useState("");

  const createPacketMut = useMutation({
    mutationFn: () => createPacketFn({
      data: {
        workspace_id: ws!.id,
        onboarding_id: id,
        from_team: fromTeam,
        to_team: toTeam,
        summary,
        scope,
        risks,
      },
    }),
    onSuccess: () => {
      setPacketOpen(false);
      setSummary(""); setScope(""); setRisks("");
      invalidate();
      toast.success("Handover packet created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">Loading…</div>;
  const { onboarding, steps, packets } = data;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Link to="/app/onboarding"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Pipeline</Button></Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{onboarding.name}</h1>
          <div className="flex flex-wrap gap-2 mt-2 text-sm">
            {onboarding.client_account && (
              <Link to="/app/clients/$accountId" params={{ accountId: onboarding.client_account.id }}>
                <Badge variant="secondary" className="cursor-pointer">{onboarding.client_account.name}</Badge>
              </Link>
            )}
            {onboarding.template && <Badge variant="outline">Template: {onboarding.template.name}</Badge>}
            {onboarding.target_go_live && <Badge variant="outline">Go-live {onboarding.target_go_live}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={onboarding.stage} onValueChange={(v) => stageMut.mutate(v as typeof STAGES[number])}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm text-muted-foreground">{onboarding.progress}%</span>
        </div>
        <Progress value={onboarding.progress} />
      </Card>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Onboarding checklist</h2>
        <div className="space-y-1">
          {steps.map((s) => {
            const done = s.status === "complete" || s.status === "skipped";
            return (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <button
                  onClick={() => stepMut.mutate({ id: s.id, status: done ? "pending" : "complete" })}
                  className="shrink-0"
                  aria-label="toggle"
                >
                  {done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                </button>
                <span className={`flex-1 text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{s.title}</span>
                {s.is_blocking && !done && <AlertCircle className="h-4 w-4 text-amber-500" />}
                <Select value={s.status} onValueChange={(v) => stepMut.mutate({ id: s.id, status: v as never })}>
                  <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending", "in_progress", "complete", "skipped", "blocked"].map((x) => (
                      <SelectItem key={x} value={x}>{x.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
          {steps.length === 0 && <p className="text-sm text-muted-foreground">No steps.</p>}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Handover packets</h2>
          <Dialog open={packetOpen} onOpenChange={setPacketOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New packet</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create handover packet</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>From team</Label>
                    <Select value={fromTeam} onValueChange={(v) => setFromTeam(v as typeof TEAMS[number])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TEAMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>To team</Label>
                    <Select value={toTeam} onValueChange={(v) => setToTeam(v as typeof TEAMS[number])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TEAMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Summary</Label><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} /></div>
                <div><Label>Scope</Label><Textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={2} /></div>
                <div><Label>Known risks</Label><Textarea value={risks} onChange={(e) => setRisks(e.target.value)} rows={2} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPacketOpen(false)}>Cancel</Button>
                <Button onClick={() => createPacketMut.mutate()} disabled={createPacketMut.isPending}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {packets.length === 0 && <p className="text-sm text-muted-foreground">No packets yet.</p>}
          {packets.map((p) => (
            <div key={p.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{p.from_team}</Badge>
                  <ArrowRight className="h-3 w-3" />
                  <Badge variant="outline">{p.to_team}</Badge>
                  <Badge variant={p.status === "accepted" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>{p.status}</Badge>
                </div>
                <div className="flex gap-1">
                  {p.status === "draft" && <Button size="sm" variant="outline" onClick={() => submitMut.mutate(p.id)}>Submit</Button>}
                  {p.status === "sent" && (
                    <>
                      <Button size="sm" onClick={() => acceptMut.mutate(p.id)}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        const reason = window.prompt("Reason for rejection?");
                        if (reason) rejectMut.mutate({ id: p.id, reason });
                      }}>Reject</Button>
                    </>
                  )}
                </div>
              </div>
              {p.summary && <p className="text-xs text-muted-foreground">{p.summary}</p>}
              {p.rejection_reason && <p className="text-xs text-destructive">Rejected: {p.rejection_reason}</p>}
              {p.items && p.items.length > 0 && (
                <ul className="space-y-1 pl-1">
                  {p.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={!!it.is_complete}
                        onChange={(e) => toggleMut.mutate({ id: it.id, is_complete: e.target.checked })}
                      />
                      <span className={it.is_complete ? "line-through text-muted-foreground" : ""}>{it.label}</span>
                      {it.is_required && <span className="text-amber-500">*</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
