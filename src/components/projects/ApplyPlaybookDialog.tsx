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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Rocket } from "lucide-react";
import { usePlaybooks, useApplyPlaybook } from "@/hooks/use-playbooks";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ApplyPlaybookDialog({ projectId, open, onOpenChange }: Props) {
  const { data: playbooks = [] } = usePlaybooks();
  const apply = useApplyPlaybook();
  const [playbookId, setPlaybookId] = useState<string>("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  const onSubmit = async () => {
    if (!playbookId) return;
    await apply.mutateAsync({ playbook_id: playbookId, project_id: projectId, start_date: startDate });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4" /> Apply playbook
          </DialogTitle>
          <DialogDescription>
            Spawns milestones and tasks from a saved blueprint, scheduled relative to the start
            date you pick.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Playbook</Label>
            <Select value={playbookId} onValueChange={setPlaybookId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    playbooks.length === 0 ? "No playbooks yet — create one in Settings" : "Pick a playbook"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {playbooks.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Start date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              All relative dates (Day +N) are computed from this anchor.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!playbookId || apply.isPending}>
            {apply.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
