import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { convertWonDealToProject } from "@/lib/clients-mission.functions";

export function WonDealBridgeDialog({
  open,
  onOpenChange,
  dealId,
  defaultName,
  accountId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dealId: string;
  defaultName: string;
  accountId: string;
}) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const convertFn = useServerFn(convertWonDealToProject);
  const [name, setName] = useState(defaultName);
  const [targetEnd, setTargetEnd] = useState("");

  const mut = useMutation({
    mutationFn: () => convertFn({ data: { dealId, name: name.trim(), target_end_date: targetEnd || null } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["client-account", accountId] });
      onOpenChange(false);
      toast.success(r.already ? "Already linked to a project" : "Project created");
      nav({ to: "/app/p/$projectId", params: { projectId: r.project_id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Spin up project from won deal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Project name</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div><Label>Target end date (optional)</Label><Input type="date" value={targetEnd} onChange={(e) => setTargetEnd(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!name.trim() || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
