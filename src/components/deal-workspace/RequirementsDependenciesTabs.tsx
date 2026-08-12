import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listDealRequirements, createDealRequirement, updateDealRequirement, deleteDealRequirement,
  listDealDependencies, createDealDependency, updateDealDependency, deleteDealDependency,
  type DealRequirement, type DealDependency,
} from "@/lib/requirements.functions";
import { toast } from "sonner";

export function DealRequirements({ dealId }: { dealId: string }) {
  const list = useServerFn(listDealRequirements);
  const create = useServerFn(createDealRequirement);
  const update = useServerFn(updateDealRequirement);
  const remove = useServerFn(deleteDealRequirement);
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["deal-requirements", dealId],
    queryFn: () => list({ data: { deal_id: dealId } }),
  });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");

  const createMut = useMutation({
    mutationFn: () => create({ data: { deal_id: dealId, title, description, priority } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-requirements", dealId] });
      setOpen(false); setTitle(""); setDescription(""); setPriority("medium");
      toast.success("Requirement added");
    },
  });

  return (
    <div className="max-w-4xl">
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New requirement</Button>
      </div>
      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Capture what the customer needs. These shape scope, SOW, and downstream tasks.
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r: DealRequirement) => (
            <Card key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium">{r.title}</div>
                  <Badge variant="outline" className="text-xs capitalize">{r.priority}</Badge>
                  <Badge variant="secondary" className="text-xs capitalize">{r.status}</Badge>
                </div>
                {r.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{r.description}</p>}
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Select
                  value={r.status}
                  onValueChange={async (v) => {
                    await update({ data: { id: r.id, status: v } });
                    qc.invalidateQueries({ queryKey: ["deal-requirements", dealId] });
                  }}
                >
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={async () => {
                  if (!confirm(`Delete "${r.title}"?`)) return;
                  await remove({ data: { id: r.id } });
                  qc.invalidateQueries({ queryKey: ["deal-requirements", dealId] });
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New requirement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!title.trim() || createMut.isPending} onClick={() => createMut.mutate()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DealDependencies({ dealId }: { dealId: string }) {
  const list = useServerFn(listDealDependencies);
  const create = useServerFn(createDealDependency);
  const update = useServerFn(updateDealDependency);
  const remove = useServerFn(deleteDealDependency);
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["deal-dependencies", dealId],
    queryFn: () => list({ data: { deal_id: dealId } }),
  });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"internal" | "external" | "vendor" | "approval">("external");
  const [dueDate, setDueDate] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      create({ data: { deal_id: dealId, title, description, type, due_date: dueDate || null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-dependencies", dealId] });
      setOpen(false); setTitle(""); setDescription(""); setType("external"); setDueDate("");
      toast.success("Dependency added");
    },
  });

  return (
    <div className="max-w-4xl">
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New dependency</Button>
      </div>
      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Track sign-offs, vendor commitments, and approvals that must clear.
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r: DealDependency) => (
            <Card key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium">{r.title}</div>
                  <Badge variant="outline" className="text-xs capitalize">{r.type}</Badge>
                  <Badge variant={r.status === "blocked" || r.status === "at_risk" ? "destructive" : "secondary"} className="text-xs capitalize">{r.status.replace("_", " ")}</Badge>
                  {r.due_date && <span className="text-xs text-muted-foreground">Due {new Date(r.due_date).toLocaleDateString()}</span>}
                </div>
                {r.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{r.description}</p>}
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Select
                  value={r.status}
                  onValueChange={async (v) => {
                    await update({ data: { id: r.id, status: v } });
                    qc.invalidateQueries({ queryKey: ["deal-dependencies", dealId] });
                  }}
                >
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="at_risk">At risk</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={async () => {
                  if (!confirm(`Delete "${r.title}"?`)) return;
                  await remove({ data: { id: r.id } });
                  qc.invalidateQueries({ queryKey: ["deal-dependencies", dealId] });
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New dependency</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="external">External</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="approval">Approval</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!title.trim() || createMut.isPending} onClick={() => createMut.mutate()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
