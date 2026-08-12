import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Activity, TrendingUp, Sparkles } from "lucide-react";
import { getClientPortalActivity } from "@/lib/clients-mission.functions";

type Project = {
  id: string;
  name: string;
  health: string | null;
  is_archived: boolean;
  target_end_date: string | null;
  lifecycle?: string | null;
};
type Deal = { id: string; title: string; status: string; value: number | null; currency: string | null };

function fmtMoney(v: number | null | undefined, c: string | null | undefined) {
  if (v == null) return "—";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: c || "USD", maximumFractionDigits: 0 }).format(v); }
  catch { return `${c ?? ""} ${v}`; }
}

export function OverviewTab({
  accountId,
  accountName,
  projects,
  deals,
}: {
  accountId: string;
  accountName: string;
  projects: Project[];
  deals: Deal[];
}) {
  const portalFn = useServerFn(getClientPortalActivity);
  const { data: portal } = useQuery({
    queryKey: ["mc-portal", accountId],
    queryFn: () => portalFn({ data: { accountId, limit: 5 } }),
    staleTime: 30_000,
  });

  const activeProjects = projects.filter((p) => !p.is_archived && (p.lifecycle ?? "active") === "active");
  const atRisk = activeProjects.filter((p) => p.health === "at_risk" || p.health === "off_track" || p.health === "blocked");
  const openDeals = deals.filter((d) => d.status === "open");
  const pipelineValue = openDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const currency = openDeals[0]?.currency ?? "USD";

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-aura-gradient-subtle p-2"><Sparkles className="h-4 w-4" /></div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">AI Client Brief</div>
            <p className="text-sm mt-1">
              <strong>{accountName}</strong> has {activeProjects.length} active {activeProjects.length === 1 ? "project" : "projects"}
              {atRisk.length > 0 && ` (${atRisk.length} at risk)`}, {openDeals.length} open {openDeals.length === 1 ? "deal" : "deals"}
              {openDeals.length > 0 && ` worth ${fmtMoney(pipelineValue, currency)}`}.
              {portal && portal.activity[0] ? ` Last portal activity ${new Date(portal.activity[0].created_at).toLocaleDateString()}.` : " No recent portal activity."}
            </p>
          </div>
        </div>
      </Card>

      {atRisk.length > 0 && (
        <Card className="p-4 border-destructive/40">
          <div className="flex items-center gap-2 text-destructive mb-2"><AlertTriangle className="h-4 w-4" /> <span className="font-medium">At-risk items</span></div>
          <ul className="space-y-1.5">
            {atRisk.map((p) => (
              <li key={p.id} className="text-sm flex items-center justify-between">
                <Link to="/app/p/$projectId" params={{ projectId: p.id }} className="hover:underline">{p.name}</Link>
                <Badge variant="destructive" className="text-[10px] capitalize">{p.health?.replace(/_/g, " ")}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium"><Activity className="h-4 w-4" /> Active projects</div>
          {activeProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active projects.</p>
          ) : (
            <ul className="space-y-2">
              {activeProjects.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <Link to="/app/p/$projectId" params={{ projectId: p.id }} className="hover:underline truncate">{p.name}</Link>
                  <Badge variant="outline" className="capitalize text-[10px]">{p.health?.replace(/_/g, " ") ?? "on track"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium"><TrendingUp className="h-4 w-4" /> Open pipeline</div>
          {openDeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open deals.</p>
          ) : (
            <>
              <div className="text-2xl font-semibold">{fmtMoney(pipelineValue, currency)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">across {openDeals.length} {openDeals.length === 1 ? "deal" : "deals"}</p>
            </>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium">Recent portal pulse</div>
        {!portal || portal.activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No portal activity yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {portal.activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between">
                <span className="truncate"><span className="text-muted-foreground capitalize">{a.activity_type.replace(/_/g, " ")}</span> on <strong>{a.project_name || "—"}</strong></span>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <Button variant="ghost" size="sm" asChild><a href="#portal">See all portal activity →</a></Button>
        </div>
      </Card>
    </div>
  );
}
