import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, DollarSign, Clock, FileText, AlertTriangle, Activity, TrendingUp } from "lucide-react";
import { getClientHub, generateClientSummary } from "@/lib/client-hub.functions";
import { useState } from "react";
import { toast } from "sonner";

function fmtMoney(v: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `${currency} ${Math.round(v)}`;
  }
}

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ClientHubOverview({ clientAccountId }: { clientAccountId: string }) {
  const hubFn = useServerFn(getClientHub);
  const summaryFn = useServerFn(generateClientSummary);

  const { data: hub, isLoading } = useQuery({
    queryKey: ["client-hub", clientAccountId],
    queryFn: () => hubFn({ data: { client_account_id: clientAccountId } }),
    staleTime: 30_000,
  });

  const [summary, setSummary] = useState<{ headline?: string; bullets?: string[]; next_action?: string } | null>(null);
  const summaryMut = useMutation({
    mutationFn: () => summaryFn({ data: { client_account_id: clientAccountId } }),
    onSuccess: (res) => {
      if (res.ok) setSummary(res.summary);
      else toast.error(res.error);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !hub) {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const f = hub.financials;
  const recent = hub.activity.slice(0, 6);
  const lastNote = hub.notes[0];

  return (
    <div className="space-y-4">
      {/* AI summary */}
      <Card className="p-4 bg-aura-gradient-subtle border-primary/20">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">AI client brief</h3>
          </div>
          <Button size="sm" variant={summary ? "outline" : "default"} onClick={() => summaryMut.mutate()} disabled={summaryMut.isPending}>
            {summaryMut.isPending ? "Thinking…" : summary ? "Refresh" : "Generate"}
          </Button>
        </div>
        {summary ? (
          <div className="space-y-2">
            {summary.headline && <p className="text-sm font-medium">{summary.headline}</p>}
            {summary.bullets && (
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                {summary.bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
            {summary.next_action && (
              <div className="mt-2 pt-2 border-t border-border/60 text-sm">
                <span className="font-medium">Next: </span>
                <span className="text-muted-foreground">{summary.next_action}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Generate an AI-written brief on this client's momentum, risks, and recommended next step.</p>
        )}
      </Card>

      {/* Financial bento */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Invoiced"
          value={fmtMoney(f.invoiced, f.currency)}
          sub={`${f.invoiceCount} invoice${f.invoiceCount === 1 ? "" : "s"}`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Paid"
          value={fmtMoney(f.paid, f.currency)}
          sub={f.invoiced > 0 ? `${Math.round((f.paid / f.invoiced) * 100)}% collected` : undefined}
        />
        <StatCard
          icon={<AlertTriangle className={f.overdue > 0 ? "h-4 w-4 text-destructive" : "h-4 w-4"} />}
          label="Outstanding"
          value={fmtMoney(f.outstanding, f.currency)}
          sub={f.overdue > 0 ? `${fmtMoney(f.overdue, f.currency)} overdue` : "On track"}
          accent={f.overdue > 0 ? "destructive" : undefined}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Hours logged"
          value={f.totalHours.toFixed(1)}
          sub={`${f.billableHours.toFixed(1)} billable · ${fmtMoney(f.timeRevenue, f.currency)}`}
        />
      </div>

      {/* Contracts & budget */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Active contracts"
          value={fmtMoney(f.activeContractValue, f.currency)}
          sub={`${f.activeContractCount} active · ${fmtMoney(f.contractTotal, f.currency)} lifetime`}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Budget"
          value={f.budgetTotal > 0 ? fmtMoney(f.budgetTotal, f.currency) : "—"}
          sub={f.budgetUtilization != null ? `${f.budgetUtilization}% used` : "No budget set"}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Hours budget"
          value={f.budgetHoursTotal > 0 ? `${f.budgetHoursTotal.toFixed(0)}h` : "—"}
          sub={f.hoursUtilization != null ? `${f.hoursUtilization}% used` : "No budget set"}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Last touch"
          value={hub.health.daysSinceTouch != null ? `${hub.health.daysSinceTouch}d ago` : "—"}
          sub={hub.health.lastTouchAt ? new Date(hub.health.lastTouchAt).toLocaleDateString() : "No activity"}
          accent={hub.health.daysSinceTouch != null && hub.health.daysSinceTouch > 14 ? "destructive" : undefined}
        />
      </div>

      {/* Recent activity + last note */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Recent activity
          </h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {recent.map((a) => (
                <li key={`${a.kind}-${a.id}`} className="text-sm flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-x-2 items-baseline">
                      <span className="font-medium">{a.actor?.name ?? "System"}</span>
                      <span className="text-muted-foreground">{(a.action ?? "updated").replace(/_/g, " ")}</span>
                      {"project_name" in a && a.project_name && (
                        <Badge variant="outline" className="text-xs">{a.project_name}</Badge>
                      )}
                    </div>
                    {a.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.body}</p>}
                    <div className="text-xs text-muted-foreground mt-0.5">{timeAgo(a.at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Latest note
          </h3>
          {lastNote ? (
            <div className="space-y-1.5">
              {lastNote.title && <p className="text-sm font-medium">{lastNote.title}</p>}
              <p className="text-xs text-muted-foreground">
                {lastNote.actor?.name ?? "Someone"} · {timeAgo(lastNote.updated_at)}
                {lastNote.project_name && ` · ${lastNote.project_name}`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: "destructive" }) {
  return (
    <Card className="p-4 hover-lift">
      <div className={`flex items-center gap-2 text-xs uppercase tracking-wide ${accent === "destructive" ? "text-destructive" : "text-muted-foreground"}`}>
        {icon} {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
