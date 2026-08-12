import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileSignature, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSubmitMilestoneSignoff } from "@/hooks/use-client-portal";

interface Props {
  token: string;
  defaultName: string;
  milestone: {
    id: string;
    name: string;
    target_date: string | null;
    signoff_requested_at?: string | null;
  };
}

export function MilestoneSignoffCard({ token, defaultName, milestone }: Props) {
  const submit = useSubmitMilestoneSignoff(token);
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [name, setName] = useState(defaultName);
  const [notes, setNotes] = useState("");

  const onSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please type your name to sign");
      return;
    }
    try {
      await submit.mutateAsync({
        milestone_id: milestone.id,
        action: mode === "approve" ? "approve" : "reject",
        signed_name: name.trim(),
        notes: notes.trim() || undefined,
      });
      toast.success(mode === "approve" ? "Milestone approved" : "Feedback sent to the team");
      setMode("idle");
      setNotes("");
    } catch (e) {
      toast.error((e as Error).message || "Could not submit");
    }
  };

  return (
    <Card className="space-y-3 border-amber-500/40 bg-amber-500/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-base font-semibold">{milestone.name}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            The team has marked this milestone ready and is requesting your sign-off
            {milestone.target_date && ` · target ${new Date(milestone.target_date).toLocaleDateString()}`}.
          </p>
        </div>
        <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
          Awaiting your sign-off
        </Badge>
      </div>

      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setMode("approve")} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMode("reject")} className="gap-1.5">
            <XCircle className="h-4 w-4" /> Request changes
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">
              {mode === "approve" ? "Type your name to sign" : "Your name"}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              {mode === "approve" ? "Notes (optional)" : "What needs to change?"}
            </Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                mode === "approve"
                  ? "Anything you want the team to know"
                  : "Describe the changes you need before approval"
              }
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
              Cancel
            </Button>
            <Button size="sm" onClick={onSubmit} disabled={submit.isPending}>
              {submit.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {mode === "approve" ? "Sign & approve" : "Send feedback"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
