import { useMemo, useState } from "react";
import { promptDialog } from "@/lib/dialogs";
import { useParams } from "@tanstack/react-router";
import {
  useClientAccess,
  useDeliverables,
  useUpsertDeliverable,
  useReviewDeliverable,
  useDeliverableComments,
  useAddTeamDeliverableComment,
} from "@/hooks/use-client-portal";
import { useProfile } from "@/hooks/use-profile";
import {
  DELIVERABLE_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
  type DeliverableType,
  type DeliverableReviewStatus,
} from "@/lib/client-portal-types";
import type { Task } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCheck } from "lucide-react";

export function ClientDeliverableSection({ task }: { task: Task }) {
  const params = useParams({ strict: false });
  const projectId = (params as { projectId?: string }).projectId ?? task.project_id;
  const { data: clients = [] } = useClientAccess(projectId);
  const { data: deliverables = [] } = useDeliverables(projectId);
  const upsert = useUpsertDeliverable();
  const review = useReviewDeliverable();

  const existing = useMemo(
    () => deliverables.find((d) => d.task_id === task.id),
    [deliverables, task.id],
  );

  const [type, setType] = useState<DeliverableType>(existing?.deliverable_type ?? "approval");
  const [clientId, setClientId] = useState<string>(existing?.client_portal_access_id ?? "");
  const [deadline, setDeadline] = useState(existing?.client_deadline ?? "");
  const [instructions, setInstructions] = useState(existing?.client_instructions ?? "");
  const [impact, setImpact] = useState(existing?.impact_description ?? "");
  const [editing, setEditing] = useState(!existing);

  if (clients.length === 0 && !existing) {
    return null;
  }

  const save = async () => {
    await upsert.mutateAsync({
      id: existing?.id,
      project_id: projectId,
      task_id: task.id,
      client_portal_access_id: clientId || null,
      deliverable_type: type,
      client_deadline: deadline || null,
      client_instructions: instructions || null,
      impact_description: impact || null,
    });
    setEditing(false);
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Client deliverable</h4>
          {existing && (
            <Badge variant="outline" className="text-[10px]">
              {REVIEW_STATUS_LABELS[existing.review_status]}
            </Badge>
          )}
        </div>
        {existing && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {!editing && existing ? (
        <div className="space-y-1.5 text-sm">
          <p>
            <span className="text-muted-foreground">Type: </span>
            {DELIVERABLE_TYPE_LABELS[existing.deliverable_type]}
          </p>
          {existing.client_deadline && (
            <p>
              <span className="text-muted-foreground">Due: </span>
              {existing.client_deadline}
            </p>
          )}
          {existing.client_instructions && (
            <p className="text-xs text-muted-foreground">{existing.client_instructions}</p>
          )}
          {existing.review_status === "submitted" && (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  review.mutate({ id: existing.id, review_status: "approved" })
                }
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const note = await promptDialog({
                    title: "Request revision",
                    description: "Tell the team what needs to change.",
                    placeholder: "What needs revising?",
                    multiline: true,
                    confirmLabel: "Send request",
                    required: true,
                  });
                  if (note === null) return;
                  review.mutate({
                    id: existing.id,
                    review_status: "needs_revision",
                    review_notes: note,
                  });
                }}
              >
                Request revision
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Deliverable type</Label>
              <Select value={type} onValueChange={(v) => setType(v as DeliverableType)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DELIVERABLE_TYPE_LABELS) as DeliverableType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {DELIVERABLE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Assign to client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Any client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Client deadline</Label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="h-8"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Instructions for client</Label>
            <Textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="What do they need to do?"
            />
          </div>
          <div>
            <Label className="text-xs">Why this matters (impact)</Label>
            <Input
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
              placeholder="Blocks launch, delays sprint, etc."
            />
          </div>
          <div className="flex justify-end gap-2">
            {existing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={upsert.isPending}>
              {existing ? "Save" : "Assign to client"}
            </Button>
          </div>
        </div>
      )}

      {existing && (
        <p className="mt-3 text-[10px] text-muted-foreground">
          Status: {REVIEW_STATUS_LABELS[existing.review_status as DeliverableReviewStatus]}
          {existing.revision_count > 0 &&
            ` · Revision ${existing.revision_count}/${existing.max_revisions}`}
        </p>
      )}

      {existing && (
        <TeamDeliverableThread deliverableId={existing.id} projectId={projectId} />
      )}
    </div>
  );
}

function TeamDeliverableThread({
  deliverableId,
  projectId,
}: {
  deliverableId: string;
  projectId: string;
}) {
  const { data: comments = [], isLoading } = useDeliverableComments(deliverableId);
  const { data: profile } = useProfile();
  const add = useAddTeamDeliverableComment();
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    add.mutate(
      {
        deliverable_id: deliverableId,
        project_id: projectId,
        body: text.trim(),
        author_name: profile?.display_name ?? "Team",
      },
      { onSuccess: () => setText("") },
    );
  };

  return (
    <div className="mt-4 rounded-md border border-border bg-card p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Discussion with client
      </p>
      <div className="mb-2 max-h-56 space-y-2 overflow-y-auto">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No messages yet.</p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className={`rounded-md p-2 text-xs ${
                c.author_kind === "team"
                  ? "ml-auto max-w-[85%] bg-primary/10"
                  : "mr-auto max-w-[85%] bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.author_name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))
        )}
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Reply to client…"
          className="text-xs"
        />
        <Button size="sm" onClick={send} disabled={add.isPending || !text.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
