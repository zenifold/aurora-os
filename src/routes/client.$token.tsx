import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  usePortalSession,
  usePortalDeliverables,
  useSubmitPortalDeliverable,
  useUploadPortalFile,
  usePortalImpact,
  usePortalOverview,
  usePortalComments,
  useAddPortalComment,
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
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Upload,
  Paperclip,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  Flag,
} from "lucide-react";
import { CsatWidget } from "@/components/portal/CsatWidget";
import { MilestoneSignoffCard } from "@/components/portal/MilestoneSignoffCard";
import { PortalIntakeForms } from "@/components/portal/PortalIntakeForms";
import { PortalInvoices } from "@/components/portal/PortalInvoices";
import { PortalDocuments } from "@/components/portal/PortalDocuments";
import { PortalChangeRequests } from "@/components/portal/PortalChangeRequests";


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
  const { data: overview } = usePortalOverview(token);

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
  const branding = (overview?.workspace?.branding ?? {}) as {
    appName?: string;
    logoUrl?: string;
    primaryColor?: string;
  };
  const brandName = branding.appName ?? overview?.workspace?.name ?? "Client portal";
  const brandColor =
    access.custom_brand_color || branding.primaryColor || project.color || undefined;

  const pending = deliverables.filter(
    (d) => d.review_status === "pending" || d.review_status === "needs_revision",
  );
  const completed = deliverables.filter(
    (d) => d.review_status === "approved" || d.review_status === "submitted",
  );
  const overdueImpact = impact.filter((n) => n.is_overdue && n.downstream.length > 0);
  const milestones = overview?.milestones ?? [];
  const progress = overview?.progress;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={brandName}
                className="h-9 w-9 rounded-lg object-cover"
              />
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-base font-semibold"
                style={{
                  backgroundColor: brandColor ? `${brandColor}22` : undefined,
                  color: brandColor,
                }}
              >
                {brandName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {brandName}
              </p>
              <h1 className="truncate text-base font-semibold leading-tight">{project.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-right">
            <div className="hidden sm:block">
              <p className="text-sm font-medium leading-tight">{access.name}</p>
              {access.company && (
                <p className="text-xs text-muted-foreground">{access.company}</p>
              )}
            </div>
            <Badge variant="outline" className="capitalize">{access.role}</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        {(() => {
          const pendingSignoffs = milestones.filter((m) => m.signoff_status === "requested");
          if (pendingSignoffs.length === 0) return null;
          return (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Flag className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Approvals needed · {pendingSignoffs.length}
              </h2>
              <div className="space-y-3">
                {pendingSignoffs.map((m) => (
                  <MilestoneSignoffCard
                    key={m.id}
                    token={token}
                    defaultName={access.name}
                    milestone={m}
                  />
                ))}
              </div>
            </section>
          );
        })()}

        {progress && progress.total > 0 && (
          <section className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Progress</p>
              <p className="mt-1 text-2xl font-semibold">{progress.percent}%</p>
              <Progress value={progress.percent} className="mt-2 h-1.5" />
              <p className="mt-2 text-xs text-muted-foreground">
                {progress.done} of {progress.total} tasks done
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">In progress</p>
              <p className="mt-1 text-2xl font-semibold">{progress.in_progress}</p>
              <p className="mt-2 text-xs text-muted-foreground">Active work right now</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Your queue</p>
              <p className="mt-1 text-2xl font-semibold">{pending.length}</p>
              <p className="mt-2 text-xs text-muted-foreground">Items awaiting your input</p>
            </Card>
          </section>
        )}

        {access.can_see_timeline && milestones.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Flag className="h-4 w-4" /> Milestones
            </h2>
            <Card className="divide-y divide-border">
              {milestones.map((m) => {
                const isDone = m.status === "completed";
                const isAtRisk = m.status === "at_risk" || m.status === "delayed";
                const signoff = m.signoff_status;
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                        isDone
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : isAtRisk
                            ? "bg-destructive/15 text-destructive"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : m.order_index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {isDone && m.actual_date
                          ? `Completed ${new Date(m.actual_date).toLocaleDateString()}`
                          : m.target_date
                            ? `Target ${new Date(m.target_date).toLocaleDateString()}`
                            : "No target date"}
                        {signoff === "approved" && m.signoff_signed_name && (
                          <> · approved by {m.signoff_signed_name}</>
                        )}
                      </p>
                    </div>
                    {signoff === "requested" && (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                        Sign-off requested
                      </Badge>
                    )}
                    {signoff === "approved" && (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        Approved
                      </Badge>
                    )}
                    {signoff === "rejected" && (
                      <Badge variant="destructive">Changes requested</Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {m.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                );
              })}
            </Card>
          </section>
        )}

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
                <DeliverableCard key={d.id} d={d} token={token} viewerName={access.name} />
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

        <PortalDocuments token={token} enabled={access.can_see_documents} />

        <PortalInvoices
          token={token}
          enabled={access.can_see_invoices || access.can_see_financials}
        />

        <PortalChangeRequests token={token} />

        <section>
          <PortalIntakeForms token={token} />
        </section>

        <section>
          <CsatWidget token={token} />
        </section>

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

function DeliverableCard({
  d,
  token,
  viewerName,
}: {
  d: PortalDeliverableView;
  token: string;
  viewerName: string;
}) {
  const submit = useSubmitPortalDeliverable(token);
  const upload = useUploadPortalFile(token);
  const fileInput = useRef<HTMLInputElement>(null);
  const [comments, setComments] = useState("");
  const [decision, setDecision] = useState<string>("");
  const [showThread, setShowThread] = useState(false);

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
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={async () => {
                      const res = await fetch(
                        `/api/public/portal/${token}/download?path=${encodeURIComponent(f.path)}`,
                      );
                      if (res.ok) {
                        const { url } = (await res.json()) as { url: string };
                        window.open(url, "_blank", "noopener");
                      }
                    }}
                  >
                    {f.name}
                  </button>
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowThread((v) => !v)}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          {showThread ? "Hide discussion" : "Discuss with team"}
        </Button>
        <div className="flex items-center gap-3">
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
      </div>

      {showThread && (
        <DeliverableThread token={token} deliverableId={d.id} viewerName={viewerName} />
      )}
    </Card>
  );
}

function DeliverableThread({
  token,
  deliverableId,
  viewerName,
}: {
  token: string;
  deliverableId: string;
  viewerName: string;
}) {
  const { data: comments = [], isLoading } = usePortalComments(token, deliverableId);
  const add = useAddPortalComment(token);
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    add.mutate(
      { deliverable_id: deliverableId, body: text.trim() },
      { onSuccess: () => setText("") },
    );
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No messages yet. Start the conversation.</p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className={`flex flex-col gap-1 rounded-md p-2 text-xs ${
                c.author_kind === "client"
                  ? "ml-auto max-w-[85%] bg-primary/10"
                  : "mr-auto max-w-[85%] bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{c.author_name}</span>
                <span className="text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </div>
          ))
        )}
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={`Reply as ${viewerName}…`}
        />
        <Button size="sm" onClick={send} disabled={add.isPending || !text.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
