import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Users, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listDealResources, createDealResource, deleteDealResource,
  type DealResource,
} from "@/lib/deal-workspace.functions";
import { toast } from "sonner";

export function ResourcesTab({ dealId }: { dealId: string }) {
  const list = useServerFn(listDealResources);
  const create = useServerFn(createDealResource);
  const remove = useServerFn(deleteDealResource);
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: ["deal-resources", dealId], queryFn: () => list({ data: { deal_id: dealId } }) });
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("");
  const [external, setExternal] = useState(false);
  const [vendor, setVendor] = useState("");
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");

  const reset = () => { setOpen(false); setRole(""); setExternal(false); setVendor(""); setHours(""); setRate(""); };

  const add = useMutation({
    mutationFn: () => create({ data: {
      deal_id: dealId, role, is_external: external,
      vendor_name: external ? vendor || null : null,
      hours: hours ? Number(hours) : null, hourly_rate: rate ? Number(rate) : null,
    }}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deal-resources", dealId] }); reset(); toast.success("Resource added"); },
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-resources", dealId] }),
  });

  const totalCost = rows.reduce((s, r) => s + (Number(r.hours) || 0) * (Number(r.hourly_rate) || 0), 0);
  const totalHours = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5"><Users className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{rows.length}</span> roles</div>
          {totalHours > 0 && <div className="text-muted-foreground">· {totalHours}h estimated</div>}
          {totalCost > 0 && <div className="text-muted-foreground">· ${totalCost.toLocaleString()} build cost</div>}
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add role</Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          Stage the team you'll need. Add internal roles and external vendors.
        </Card>
      ) : (
        <div className="grid gap-2">
          {rows.map((r: DealResource) => (
            <Card key={r.id} className="p-4 flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                {r.is_external ? <Building2 className="h-5 w-5 text-muted-foreground" /> : <Users className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{r.role}</span>
                  {r.is_external && <Badge variant="outline" className="text-xs">External{r.vendor_name ? ` · ${r.vendor_name}` : ""}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {r.hours ? `${r.hours}h` : "Hours TBD"}
                  {r.hourly_rate ? ` × $${r.hourly_rate}/h = $${((r.hours || 0) * (r.hourly_rate || 0)).toLocaleString()}` : ""}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100" onClick={() => del.mutate(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add role</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Role</Label>
              <Input placeholder="e.g. Senior Engineer" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Hours</Label>
                <Input type="number" placeholder="40" value={hours} onChange={(e) => setHours(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Rate ($/h)</Label>
                <Input type="number" placeholder="150" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/40">
              <Label className="cursor-pointer">External / vendor</Label>
              <Switch checked={external} onCheckedChange={setExternal} />
            </div>
            {external && <Input placeholder="Vendor name" value={vendor} onChange={(e) => setVendor(e.target.value)} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={reset}>Cancel</Button>
            <Button disabled={!role.trim() || add.isPending} onClick={() => add.mutate()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
