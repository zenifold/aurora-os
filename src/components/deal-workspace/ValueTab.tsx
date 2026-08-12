import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listDealQuoteOptions, createDealQuoteOption,
  updateDealQuoteOption, deleteDealQuoteOption,
  type DealQuoteOption,
} from "@/lib/deal-workspace.functions";
import { toast } from "sonner";

const MODELS: Record<string, string> = { fixed: "Fixed fee", tm: "Time & materials", retainer: "Retainer", hybrid: "Hybrid" };

export function ValueTab({ dealId, currency }: { dealId: string; currency: string }) {
  const list = useServerFn(listDealQuoteOptions);
  const create = useServerFn(createDealQuoteOption);
  const update = useServerFn(updateDealQuoteOption);
  const remove = useServerFn(deleteDealQuoteOption);
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: ["deal-quotes", dealId], queryFn: () => list({ data: { deal_id: dealId } }) });
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [model, setModel] = useState<"fixed"|"tm"|"retainer"|"hybrid">("fixed");
  const [total, setTotal] = useState("");
  const [prob, setProb] = useState("");
  const [terms, setTerms] = useState("");

  const reset = () => { setOpen(false); setLabel(""); setModel("fixed"); setTotal(""); setProb(""); setTerms(""); };

  const add = useMutation({
    mutationFn: () => create({ data: {
      deal_id: dealId, label, pricing_model: model, currency,
      total_value: total ? Number(total) : null,
      win_probability: prob ? Number(prob) : null,
      terms: terms || null,
    }}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deal-quotes", dealId] }); reset(); toast.success("Option added"); },
  });

  const fmt = (n: number | null) => n == null ? "—" :
    new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Build pricing options. Mark one as selected to highlight your recommendation.</div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add option</Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <DollarSign className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          No pricing options yet. Offer alternatives so the client picks the shape that fits.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((q: DealQuoteOption) => (
            <Card key={q.id} className={`p-5 relative group ${q.is_selected ? "ring-2 ring-primary" : ""}`}>
              {q.is_selected && (
                <Badge className="absolute top-3 right-3"><Check className="h-3 w-3 mr-1" /> Selected</Badge>
              )}
              <div className="font-semibold">{q.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{MODELS[q.pricing_model] ?? q.pricing_model}</div>
              <div className="mt-3 text-3xl font-bold tracking-tight">{fmt(q.total_value)}</div>
              {q.win_probability != null && (
                <div className="mt-1 text-xs text-muted-foreground">{q.win_probability}% win likelihood</div>
              )}
              {q.terms && <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{q.terms}</p>}
              <div className="mt-4 flex gap-2">
                {!q.is_selected && (
                  <Button size="sm" variant="outline" className="flex-1"
                    onClick={async () => { await update({ data: { id: q.id, is_selected: true } }); qc.invalidateQueries({ queryKey: ["deal-quotes", dealId] }); }}>
                    Select
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={async () => {
                  if (!confirm(`Delete "${q.label}"?`)) return;
                  await remove({ data: { id: q.id } });
                  qc.invalidateQueries({ queryKey: ["deal-quotes", dealId] });
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New pricing option</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Label</Label>
              <Input placeholder="e.g. Option A — Full scope" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Model</Label>
                <Select value={model} onValueChange={(v) => setModel(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MODELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Total ({currency})</Label>
                <Input type="number" placeholder="85000" value={total} onChange={(e) => setTotal(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Win probability (%)</Label>
              <Input type="number" min={0} max={100} placeholder="65" value={prob} onChange={(e) => setProb(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Terms</Label>
              <Textarea placeholder="50% upfront, 50% on delivery. Valid 30 days." value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={reset}>Cancel</Button>
            <Button disabled={!label.trim() || add.isPending} onClick={() => add.mutate()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
