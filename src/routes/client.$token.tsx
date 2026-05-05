import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  usePortalSession,
  usePortalDeliverables,
  useSubmitPortalDeliverable,
  useUploadPortalFile,
  usePortalImpact,
  type PortalDeliverableView,
  type PortalImpactNode,
} from "@/hooks/use-client-portal";
import {
  DELIVERABLE_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
} from "@/lib/client-portal-types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Upload,
  Paperclip,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/client/$token")({
  component: PortalPage,
});

function formatDeadline(date: string | null): { label: string; tone: "ok" | "soon" | "overdue" } {
  if (!date) return { label: "No deadline", tone: "ok" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, tone: "overdue" };
  if (diff === 0) return { label: "Due today", tone: "soon" };
  if (diff <= 3) return { label: `Due in ${diff}d`, tone: "soon" };
  return { label: `Due ${d.toLocaleDateString()}`, tone: "ok" };
}

function PortalPage() {
  const { token } = Route.useParams();
  const { data: session, isLoading, error } = usePortalSession(token);
  const { data: deliverables = [] } = usePortalDeliverables(token);
  const { data: impact = [] } = usePortalImpact(token);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="max-w-md p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h1 className="text-lg font-semibold">Link not valid</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This portal link has expired or been revoked. Please contact your project team for a new invite.
          </p>
        </Card>
      </div>
    );
  }

  const { access, project } = session;
  const pending = deliverables.filter(
    (d) => d.review_status === "pending" || d.review_status === "needs_revision",
  );
  const completed = deliverables.filter(
    (d) => d.review_status === "approved" || d.review_status === "submitted",
  );
  const overdueImpact = impact.filter((n) => n.is_overdue && n.downstream.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-base font-semibold"
              style={{ backgroundColor: `${project.color}22`, color: project.color }}
            >
              {project.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">{project.name}</h1>
              <p className="text-xs text-muted-foreground">
                Welcome, {access.name}
                {access.company ? ` · ${access.company}` : ""}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="capitalize">{access.role}</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Your action items {pending.length > 0 && <span className="text-foreground">· {pending.length}</span>}
          </h2>
          {pending.length === 0 ? (
            <Card className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              You're all caught up — nothing needs your attention right now.
            </Card>
          ) : (
            <div className="space-y-3">
              {pending.map((d) => (
                <DeliverableCard key={d.id} d={d} token={token} />
              ))}
            </div>
          )}
        </section>

        {overdueImpact.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Impact map · what's blocked right now
            </h2>
            <div className="space-y-3">
              {overdueImpact.map((node) => (
                <ImpactCard key={node.deliverable_id} node={node} />
              ))}
            </div>
          </section>
        )}

        {completed.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recently submitted
            </h2>
            <div className="space-y-2">
              {completed.map((d) => (
                <Card key={d.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">{d.task_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {DELIVERABLE_TYPE_LABELS[d.deliverable_type]}
                    </p>
                  </div>
                  <Badge variant="outline">{REVIEW_STATUS_LABELS[d.review_status]}</Badge>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function ImpactCard({ node }: { node: PortalImpactNode }) {
  const deadline = formatDeadline(node.client_deadline);
  return (
    <Card className="border-destructive/40 bg-destructive/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="destructive">{deadline.label}</Badge>
        <Badge variant="secondary">{DELIVERABLE_TYPE_LABELS[node.deliverable_type as keyof typeof DELIVERABLE_TYPE_LABELS] ?? node.deliverable_type}</Badge>
        <span className="text-sm font-medium">{node.task_title}</span>
      </div>
      {node.impact_description && (
        <p className="mt-2 text-xs text-muted-foreground">{node.impact_description}</p>
      )}
      <div className="mt-3 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Currently blocking:</p>
        {node.downstream.map((t) => (
          <div key={t.id} className="flex items-center gap-2 text-xs">
            <ArrowRight className="h-3 w-3 text-destructive" />
            <span className="font-medium">{t.title}</span>
            {t.due_date && (
              <span className="text-muted-foreground">· planned {t.due_date}</span>
            )}
            <Badge variant="outline" className="ml-auto text-[10px] capitalize">
              {t.status.replace(/_/g, " ")}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DeliverableCard({ d, token }: { d: PortalDeliverableView; token: string }) {
  const submit = useSubmitPortalDeliverable(token);
  const upload = useUploadPortalFile(token);
  const fileInput = useRef<HTMLInputElement>(null);
  const [comments, setComments] = useState("");
  const [decision, setDecision] = useState<string>("");

  const isRevision = d.review_status === "needs_revision";
  const deadline = formatDeadline(d.client_deadline);
  const files =
    (d.submitted_content as { files?: Array<{ name: string; path: string; size: number }> } | null)
      ?.files ?? [];

  const allowsUpload =
    d.deliverable_type === "content_upload" ||
    d.deliverable_type === "data_provision" ||
    d.deliverable_type === "signature";

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{DELIVERABLE_TYPE_LABELS[d.deliverable_type]}</Badge>
            {isRevision && <Badge variant="destructive">Revision requested</Badge>}
          </div>
          <h3 className="mt-2 text-base font-semibold">{d.task_title}</h3>
        </div>
        {d.client_deadline && (
          <div
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
              deadline.tone === "overdue"
                ? "bg-destructive/10 text-destructive"
                : deadline.tone === "soon"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5" /> {deadline.label}
          </div>
        )}
      </div>

      {d.client_instructions && (
        <p className="text-sm text-muted-foreground">{d.client_instructions}</p>
      )}

      {d.impact_description && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <span className="font-medium">Impact: </span>
          {d.impact_description}
        </div>
      )}

      {isRevision && d.review_notes && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
          <span className="font-medium">Team notes: </span>
          {d.review_notes}
        </div>
      )}

      {(d.deliverable_type === "approval" ||
        d.deliverable_type === "decision" ||
        d.deliverable_type === "review") && (
        <div className="flex gap-2">
          {["approve", "request_changes"].map((opt) => (
            <Button
              key={opt}
              variant={decision === opt ? "default" : "outline"}
              size="sm"
              onClick={() => setDecision(opt)}
            >
              {opt === "approve" ? "Approve" : "Request changes"}
            </Button>
          ))}
        </div>
      )}

      {allowsUpload && (
        <div className="space-y-2">
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate({ deliverable_id: d.id, file: f });
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
            disabled={upload.isPending}
          >
            <Upload className="mr-2 h-4 w-4" />
            {upload.isPending ? "Uploading…" : "Attach file"}
          </Button>
          {files.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {files.map((f) => (
                <li key={f.path} className="flex items-center gap-2">
                  <Paperclip className="h-3 w-3" />
                  <span>{f.name}</span>
                  <span className="text-[10px]">({Math.round(f.size / 1024)} KB)</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder="Add a note to your submission (optional)"
        rows={3}
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {d.revision_count > 0 && `Revision ${d.revision_count} of ${d.max_revisions}`}
        </span>
        <Button
          size="sm"
          onClick={() =>
            submit.mutate({
              deliverable_id: d.id,
              decision: decision || undefined,
              comments: comments || undefined,
            })
          }
          disabled={submit.isPending}
        >
          {submit.isPending ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </Card>
  );
}
