import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  usePortalChangeRequests,
  useSubmitPortalChangeRequest,
  type PortalChangeRequest,
} from "@/hooks/use-client-portal";
import { GitPullRequest, Plus, X } from "lucide-react";

const URGENCY_TONE: Record<PortalChangeRequest["urgency"], string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  urgent: "bg-destructive/15 text-destructive",
};

const STATUS_TONE: Record<PortalChangeRequest["status"], string> = {
  submitted: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  in_review: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-destructive/15 text-destructive",
  scheduled: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
};

const STATUS_LABEL: Record<PortalChangeRequest["status"], string> = {
  submitted: "Submitted",
  in_review: "In review",
  approved: "Approved",
  rejected: "Declined",
  scheduled: "Scheduled",
};

const IMPACT_AREAS: Array<{
  k: PortalChangeRequest["impact_areas"][number];
  label: string;
}> = [
  { k: "scope", label: "Scope" },
  { k: "timeline", label: "Timeline" },
  { k: "cost", label: "Cost" },
  { k: "quality", label: "Quality" },
];

export function PortalChangeRequests({ token }: { token: string }) {
  const { data: requests = [] } = usePortalChangeRequests(token);
  const submit = useSubmitPortalChangeRequest(token);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<PortalChangeRequest["urgency"]>("normal");
  const [areas, setAreas] = useState<PortalChangeRequest["impact_areas"]>([]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setUrgency("normal");
    setAreas([]);
    setOpen(false);
  };

  const send = async () => {
    if (title.trim().length < 3 || description.trim().length < 10) return;
    await submit.mutateAsync({
      title: title.trim(),
      description: description.trim(),
      urgency,
      impact_areas: areas,
    });
    reset();
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <GitPullRequest className="h-4 w-4" /> Change requests
        </h2>
        {!open && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New request
          </Button>
        )}
      </div>

      {open && (
        <Card className="mb-3 space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Submit a change request</p>
            <Button variant="ghost" size="icon" onClick={reset}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr-title" className="text-xs">
              Title
            </Label>
            <Input
              id="cr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add an additional analytics dashboard"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr-desc" className="text-xs">
              What needs to change and why?
            </Label>
            <Textarea
              id="cr-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the request, motivations, and any constraints."
              maxLength={4000}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Urgency</Label>
              <Select
                value={urgency}
                onValueChange={(v) => setUrgency(v as PortalChangeRequest["urgency"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low — whenever fits</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High — soon</SelectItem>
                  <SelectItem value="urgent">Urgent — blocking</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expected impact</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {IMPACT_AREAS.map((a) => {
                  const active = areas.includes(a.k);
                  return (
                    <button
                      key={a.k}
                      type="button"
                      onClick={() =>
                        setAreas((prev) =>
                          active ? prev.filter((x) => x !== a.k) : [...prev, a.k],
                        )
                      }
                      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button
              onClick={send}
              disabled={
                submit.isPending ||
                title.trim().length < 3 ||
                description.trim().length < 10
              }
            >
              {submit.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </Card>
      )}

      {requests.length === 0 && !open ? (
        <Card className="p-4 text-sm text-muted-foreground">
          No change requests yet. Use this to formally request scope, timeline, or cost
          changes — your team will review and respond.
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <Card key={r.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                <Badge variant="outline" className={URGENCY_TONE[r.urgency]}>
                  {r.urgency}
                </Badge>
                {r.impact_areas.map((a) => (
                  <Badge key={a} variant="outline" className="capitalize">
                    {a}
                  </Badge>
                ))}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm font-semibold">{r.title}</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {r.description}
              </p>
              {(r.estimated_cost != null || r.estimated_days != null) && (
                <div className="flex flex-wrap gap-3 text-xs">
                  {r.estimated_cost != null && (
                    <span>
                      <span className="text-muted-foreground">Est. cost: </span>
                      <span className="font-medium">
                        {new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: "USD",
                        }).format(r.estimated_cost)}
                      </span>
                    </span>
                  )}
                  {r.estimated_days != null && (
                    <span>
                      <span className="text-muted-foreground">Est. impact: </span>
                      <span className="font-medium">+{r.estimated_days}d</span>
                    </span>
                  )}
                </div>
              )}
              {r.review_notes && (
                <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
                  <span className="font-medium">Team response: </span>
                  {r.review_notes}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
