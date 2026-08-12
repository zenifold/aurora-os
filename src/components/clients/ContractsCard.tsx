import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listContracts, upsertContract, deleteContract } from "@/lib/contracts.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";

type Contract = {
  id: string;
  workspace_id: string;
  client_account_id: string;
  deal_id: string | null;
  project_id: string | null;
  title: string;
  contract_type: string;
  status: string;
  value: number | null;
  currency: string;
  signed_date: string | null;
  effective_start: string | null;
  effective_end: string | null;
  file_url: string | null;
  notes: string | null;
};

type Draft = {
  id?: string;
  title: string;
  contract_type: "sow" | "msa" | "order_form" | "retainer" | "amendment" | "other";
  status: "draft" | "sent" | "signed" | "active" | "expired" | "terminated";
  value: string;
  currency: string;
  signed_date: string;
  effective_start: string;
  effective_end: string;
  file_url: string;
  notes: string;
};

const empty: Draft = {
  title: "",
  contract_type: "sow",
  status: "draft",
  value: "",
  currency: "USD",
  signed_date: "",
  effective_start: "",
  effective_end: "",
  file_url: "",
  notes: "",
};

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  signed: "default",
  active: "default",
  expired: "outline",
  terminated: "destructive",
};

export function ContractsCard({ workspaceId, clientAccountId }: { workspaceId: string; clientAccountId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listContracts);
  const upsertFn = useServerFn(upsertContract);
  const delFn = useServerFn(deleteContract);

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts", workspaceId, clientAccountId],
    queryFn: () => listFn({ data: { workspace_id: workspaceId, client_account_id: clientAccountId } }),
  });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: draft.id,
          workspace_id: workspaceId,
          client_account_id: clientAccountId,
          title: draft.title,
          contract_type: draft.contract_type,
          status: draft.status,
          value: draft.value ? Number(draft.value) : null,
          currency: draft.currency || "USD",
          signed_date: draft.signed_date || null,
          effective_start: draft.effective_start || null,
          effective_end: draft.effective_end || null,
          file_url: draft.file_url || null,
          notes: draft.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success(draft.id ? "Contract updated" : "Contract added");
      setOpen(false);
      setDraft(empty);
      qc.invalidateQueries({ queryKey: ["contracts", workspaceId, clientAccountId] });
      qc.invalidateQueries({ queryKey: ["client-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Contract removed");
      qc.invalidateQueries({ queryKey: ["contracts", workspaceId, clientAccountId] });
      qc.invalidateQueries({ queryKey: ["client-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const edit = (c: Contract) => {
    setDraft({
      id: c.id,
      title: c.title,
      contract_type: c.contract_type as Draft["contract_type"],
      status: c.status as Draft["status"],
      value: c.value != null ? String(c.value) : "",
      currency: c.currency || "USD",
      signed_date: c.signed_date ?? "",
      effective_start: c.effective_start ?? "",
      effective_end: c.effective_end ?? "",
      file_url: c.file_url ?? "",
      notes: c.notes ?? "",
    });
    setOpen(true);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium">Contracts & SOWs ({contracts.length})</h2>
        <Button size="sm" variant="outline" onClick={() => { setDraft(empty); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contracts yet.</p>
      ) : (
        <ul className="space-y-2">
          {(contracts as Contract[]).map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 text-sm border rounded p-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{c.title}</span>
                  <Badge variant="outline" className="text-xs uppercase">{c.contract_type}</Badge>
                  <Badge variant={statusVariant[c.status] ?? "outline"} className="text-xs">{c.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                  {c.value != null && <span>{c.currency} {c.value.toLocaleString()}</span>}
                  {c.signed_date && <span>Signed {c.signed_date}</span>}
                  {c.effective_end && <span>Ends {c.effective_end}</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {c.file_url && (
                  <a href={c.file_url} target="_blank" rel="noreferrer">
                    <Button size="icon" variant="ghost" className="h-7 w-7"><FileText className="h-3.5 w-3.5" /></Button>
                  </a>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => edit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{draft.id ? "Edit contract" : "Add contract"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={draft.contract_type} onValueChange={(v) => setDraft({ ...draft, contract_type: v as Draft["contract_type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sow">SOW</SelectItem>
                    <SelectItem value="msa">MSA</SelectItem>
                    <SelectItem value="order_form">Order form</SelectItem>
                    <SelectItem value="retainer">Retainer</SelectItem>
                    <SelectItem value="amendment">Amendment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as Draft["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="signed">Signed</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Value</Label><Input type="number" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /></div>
              <div><Label>Currency</Label><Input maxLength={3} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Signed</Label><Input type="date" value={draft.signed_date} onChange={(e) => setDraft({ ...draft, signed_date: e.target.value })} /></div>
              <div><Label>Start</Label><Input type="date" value={draft.effective_start} onChange={(e) => setDraft({ ...draft, effective_start: e.target.value })} /></div>
              <div><Label>End</Label><Input type="date" value={draft.effective_end} onChange={(e) => setDraft({ ...draft, effective_end: e.target.value })} /></div>
            </div>
            <div><Label>File URL</Label><Input placeholder="https://…" value={draft.file_url} onChange={(e) => setDraft({ ...draft, file_url: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!draft.title || save.isPending}>{draft.id ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
