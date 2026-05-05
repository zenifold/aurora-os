import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEscalation, useUpdateEscalation } from "@/hooks/use-escalations";
import { useProjects } from "@/hooks/use-projects";
import { TIER_COLORS, TIER_LABELS } from "@/lib/escalation-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/app/escalations/$escalationId")({
  component: EscalationDetailPage,
});

function EscalationDetailPage() {
  const { escalationId } = useParams({ from: "/app/escalations/$escalationId" });
  const { data: escalation, isLoading } = useEscalation(escalationId);
  const { data: projects = [] } = useProjects();
  const update = useUpdateEscalation();
  const [resolutionNotes, setResolutionNotes] = useState("");

  if (isLoading || !escalation) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  const tier = escalation.tier as 1 | 2 | 3 | 4 | 5;
  const project = projects.find((p) => p.id === escalation.project_id);
  const triggers = escalation.triggered_by as Record<string, unknown>;
  const impact = escalation.impact;

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-8">
      <Link to="/app/escalations" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All escalations
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge style={{ backgroundColor: TIER_COLORS[tier] + "22", color: TIER_COLORS[tier] }}>
          {TIER_LABELS[tier]}
        </Badge>
        <Badge variant="outline" className="capitalize">{escalation.status.replace("_", " ")}</Badge>
        {project && (
          <Link to="/app/p/$projectId/overview" params={{ projectId: project.id }} className="text-xs text-muted-foreground hover:underline">
            {project.client_name || project.name}
          </Link>
        )}
      </div>

      <h1 className="mt-2 text-2xl font-semibold">{escalation.title}</h1>
      <p className="text-xs text-muted-foreground">
        Triggered {new Date(escalation.created_at).toLocaleString()}
      </p>

      {escalation.detail && (
        <p className="mt-4 text-sm text-foreground/90">{escalation.detail}</p>
      )}

      {/* Triggers */}
      {Object.keys(triggers).length > 0 && (
        <Section title="Conditions met">
          <ul className="space-y-1 text-sm">
            {Object.entries(triggers).map(([k, v]) => (
              <li key={k} className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.65_0.2_35)]" />
                <span className="text-muted-foreground">
                  <code className="font-mono text-xs">{k}</code>: {String(v)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Impact */}
      {(impact.resolve_by || impact.revenue_at_risk || impact.schedule_slip_days) && (
        <Section title="Impact projection">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {impact.resolve_by && (
              <Stat label="Resolve by" value={impact.resolve_by} />
            )}
            {impact.schedule_slip_days != null && (
              <Stat label="Schedule slip" value={`+${impact.schedule_slip_days} days`} />
            )}
            {impact.revenue_at_risk != null && (
              <Stat label="Revenue at risk" value={`$${impact.revenue_at_risk.toLocaleString()}`} />
            )}
            {impact.margin_delta_pp != null && (
              <Stat label="Margin impact" value={`${impact.margin_delta_pp}pp`} />
            )}
          </div>
          {impact.notes && <p className="mt-3 text-sm text-muted-foreground">{impact.notes}</p>}
        </Section>
      )}

      {/* Action plan */}
      {escalation.action_plan.length > 0 && (
        <Section title="Action plan">
          <ol className="space-y-2 text-sm">
            {escalation.action_plan.map((step, i) => (
              <li key={step.id} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {i + 1}
                </span>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Resolution */}
      {escalation.status !== "resolved" && (
        <Section title="Resolve">
          <Textarea
            placeholder="Resolution notes…"
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            className="min-h-[80px]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {escalation.status === "active" && (
              <Button
                variant="secondary"
                onClick={() => update.mutate({ id: escalation.id, action: "acknowledge" })}
              >
                Acknowledge
              </Button>
            )}
            <Button
              onClick={() =>
                update.mutate({
                  id: escalation.id,
                  action: "resolve",
                  patch: { resolution_notes: resolutionNotes || null },
                })
              }
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark resolved
            </Button>
            {tier < 5 && (
              <Button
                variant="outline"
                onClick={() => update.mutate({ id: escalation.id, action: "escalate" })}
              >
                <ArrowUpRight className="mr-1.5 h-4 w-4" /> Escalate to L{tier + 1}
              </Button>
            )}
          </div>
        </Section>
      )}

      {escalation.resolution_notes && (
        <Section title="Resolution notes">
          <p className="text-sm text-muted-foreground">{escalation.resolution_notes}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
