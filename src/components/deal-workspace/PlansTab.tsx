import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Calendar, Lightbulb, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listDealPhases, createDealPhase, deleteDealPhase,
  listDealMilestones, createDealMilestone, updateDealMilestone, deleteDealMilestone,
  listDealAssumptions, createDealAssumption, deleteDealAssumption,
  type DealPhase, type DealMilestone, type DealAssumption,
} from "@/lib/deal-workspace.functions";
import { toast } from "sonner";

export function PlansTab({ dealId }: { dealId: string }) {
  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 max-w-6xl">
      <Phases dealId={dealId} />
      <Milestones dealId={dealId} />
      <Assumptions dealId={dealId} />
    </div>
  );
}

function Phases({ dealId }: { dealId: string }) {
  const list = useServerFn(listDealPhases);
  const create = useServerFn(createDealPhase);
  const remove = useServerFn(deleteDealPhase);
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: ["deal-phases", dealId], queryFn: () => list({ data: { deal_id: dealId } }) });
  const [name, setName] = useState("");
  const [weeks, setWeeks] = useState("");

  const add = useMutation({
    mutationFn: () => create({ data: { deal_id: dealId, name, duration_weeks: weeks ? Number(weeks) : null } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deal-phases", dealId] }); setName(""); setWeeks(""); },
  });
  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-phases", dealId] }),
  });

  const totalWeeks = rows.reduce((s, p) => s + (Number(p.duration_weeks) || 0), 0);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Delivery phases</h3>
        </div>
        {totalWeeks > 0 && <Badge variant="secondary">{totalWeeks} wk total</Badge>}
      </div>
      <div className="space-y-2 mb-3">
        {rows.map((p: DealPhase, i) => (
          <div key={p.id} className="flex items-center gap-2 group">
            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{p.name}</div>
              {p.duration_weeks ? <div className="text-xs text-muted-foreground">{p.duration_weeks} wk</div> : null}
            </div>
            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100" onClick={() => del.mutate(p.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No phases yet. Sketch out the delivery shape.</p>}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Phase name (e.g. Discovery)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <Input type="number" placeholder="Weeks" className="w-24" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
          <Button size="icon" disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
    </Card>
  );
}

function Milestones({ dealId }: { dealId: string }) {
  const list = useServerFn(listDealMilestones);
  const create = useServerFn(createDealMilestone);
  const update = useServerFn(updateDealMilestone);
  const remove = useServerFn(deleteDealMilestone);
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: ["deal-milestones", dealId], queryFn: () => list({ data: { deal_id: dealId } }) });
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  const add = useMutation({
    mutationFn: () => create({ data: { deal_id: dealId, title, target_date: date || null } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deal-milestones", dealId] }); setTitle(""); setDate(""); },
  });

  const inv = () => qc.invalidateQueries({ queryKey: ["deal-milestones", dealId] });

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Milestones</h3>
      </div>
      <div className="space-y-2 mb-3">
        {rows.map((m: DealMilestone) => (
          <div key={m.id} className="flex items-center gap-2 group flex-wrap sm:flex-nowrap">
            <div className="flex-1 min-w-0 basis-full sm:basis-auto">
              <div className="font-medium truncate">{m.title}</div>
              {m.target_date && <div className="text-xs text-muted-foreground">{new Date(m.target_date).toLocaleDateString()}</div>}
            </div>
            <Select value={m.status} onValueChange={async (v) => { await update({ data: { id: m.id, status: v as any } }); inv(); }}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="at_risk">At risk</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              onClick={async () => { await remove({ data: { id: m.id } }); inv(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No milestones yet.</p>}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Milestone (e.g. Kickoff)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex gap-2">
          <Input type="date" className="flex-1 sm:w-40" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button size="icon" disabled={!title.trim() || add.isPending} onClick={() => add.mutate()}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
    </Card>
  );
}

function Assumptions({ dealId }: { dealId: string }) {
  const list = useServerFn(listDealAssumptions);
  const create = useServerFn(createDealAssumption);
  const remove = useServerFn(deleteDealAssumption);
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: ["deal-assumptions", dealId], queryFn: () => list({ data: { deal_id: dealId } }) });
  const [text, setText] = useState("");

  const add = useMutation({
    mutationFn: () => create({ data: { deal_id: dealId, text } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deal-assumptions", dealId] }); setText(""); toast.success("Captured"); },
  });

  return (
    <Card className="p-5 lg:col-span-2">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Assumptions</h3>
      </div>
      <div className="space-y-1.5 mb-3">
        {rows.map((a: DealAssumption) => (
          <div key={a.id} className="flex items-start gap-2 group p-2 rounded hover:bg-accent/40">
            <span className="text-muted-foreground mt-0.5">·</span>
            <p className="flex-1 text-sm">{a.text}</p>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              onClick={async () => { await remove({ data: { id: a.id } }); qc.invalidateQueries({ queryKey: ["deal-assumptions", dealId] }); }}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">e.g. "Client has API docs ready" · "Two-week feedback cycles"</p>}
      </div>
      <div className="flex gap-2">
        <Textarea placeholder="Add an assumption..." value={text} onChange={(e) => setText(e.target.value)}
          rows={2} className="resize-none" />
        <Button size="icon" disabled={!text.trim() || add.isPending} onClick={() => add.mutate()} className="self-end"><Plus className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}
