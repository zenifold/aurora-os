import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Smile, Frown, MessageSquare, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ListSkeleton } from "@/components/ui/loading-scaffolds";
import { cn } from "@/lib/utils";

type Project = { id: string; name: string };

interface CsatResponse {
  id: string;
  project_id: string;
  score: number;
  comment: string | null;
  respondent_name: string | null;
  source: string;
  created_at: string;
}

interface StatusUpdate {
  id: string;
  project_id: string;
  created_at: string;
  summary: string | null;
  health: string | null;
}

export function ClientHealthTab({ projects, clientHealth }: { projects: Project[]; clientHealth?: string | null }) {
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const { data: csat = [], isLoading: csatLoading } = useQuery({
    queryKey: ["client-csat", projectIds.join(",")],
    queryFn: async () => {
      if (projectIds.length === 0) return [] as CsatResponse[];
      const { data, error } = await supabase
        .from("csat_responses")
        .select("id, project_id, score, comment, respondent_name, source, created_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as CsatResponse[];
    },
    enabled: projectIds.length > 0,
    staleTime: 60_000,
  });

  const { data: updates = [] } = useQuery({
    queryKey: ["client-status-updates", projectIds.join(",")],
    queryFn: async () => {
      if (projectIds.length === 0) return [] as StatusUpdate[];
      const { data, error } = await supabase
        .from("project_status_updates")
        .select("id, project_id, created_at, summary, health")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as StatusUpdate[];
    },
    enabled: projectIds.length > 0,
    staleTime: 60_000,
  });

  const csatStats = useMemo(() => {
    if (csat.length === 0) return { avg: 0, count: 0, promoters: 0, detractors: 0 };
    const total = csat.reduce((s, r) => s + r.score, 0);
    const promoters = csat.filter((r) => r.score >= 4).length;
    const detractors = csat.filter((r) => r.score <= 2).length;
    return { avg: total / csat.length, count: csat.length, promoters, detractors };
  }, [csat]);

  const lastTouchAt = updates[0]?.created_at ?? csat[0]?.created_at ?? null;

  if (projects.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        No engagements yet — health metrics will populate once projects begin.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Heart className="h-4 w-4" />
            <span>Account health</span>
          </div>
          <div className="mt-1 text-2xl font-semibold capitalize">{clientHealth ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Smile className="h-4 w-4" />
            <span>Average CSAT</span>
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {csatStats.count > 0 ? csatStats.avg.toFixed(1) : "—"}
            {csatStats.count > 0 && <span className="text-sm text-muted-foreground font-normal"> / 5</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{csatStats.count} responses</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            <span>Promoters</span>
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">{csatStats.promoters}</div>
          <div className="text-xs text-muted-foreground mt-0.5">scores 4–5</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Frown className="h-4 w-4" />
            <span>Detractors</span>
          </div>
          <div className={cn("mt-1 text-2xl font-semibold tabular-nums", csatStats.detractors > 0 && "text-destructive")}>{csatStats.detractors}</div>
          <div className="text-xs text-muted-foreground mt-0.5">scores 1–2</div>
        </Card>
      </div>

      {lastTouchAt && (
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Last touch:</span>
            <span className="font-medium">{formatDistanceToNow(new Date(lastTouchAt), { addSuffix: true })}</span>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Recent CSAT responses</h3>
        </div>
        {csatLoading ? (
          <div className="p-4"><ListSkeleton rows={3} /></div>
        ) : csat.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No CSAT responses yet. Requests sent at milestone completion will appear here.</p>
        ) : (
          <ul className="divide-y divide-border">
            {csat.slice(0, 10).map((r) => {
              const proj = projectById.get(r.project_id);
              return (
                <li key={r.id} className="p-4 flex items-start gap-3">
                  <div className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center font-semibold tabular-nums shrink-0",
                    r.score >= 4 ? "bg-emerald-500/15 text-emerald-700" : r.score === 3 ? "bg-amber-500/15 text-amber-700" : "bg-destructive/15 text-destructive",
                  )}>
                    {r.score}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-medium">{r.respondent_name ?? "Anonymous"}</span>
                      {proj && (
                        <Link to="/app/p/$projectId" params={{ projectId: r.project_id }} className="text-muted-foreground hover:underline">
                          · {proj.name}
                        </Link>
                      )}
                      <Badge variant="outline" className="text-xs">{r.source}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">{format(new Date(r.created_at), "MMM d, yyyy")}</span>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{r.comment}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Recent status updates</h3>
        </div>
        {updates.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No status updates yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {updates.map((u) => {
              const proj = projectById.get(u.project_id);
              return (
                <li key={u.id} className="p-4">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    {proj && (
                      <Link to="/app/p/$projectId" params={{ projectId: u.project_id }} className="font-medium hover:underline">
                        {proj.name}
                      </Link>
                    )}
                    {u.health && <Badge variant="outline" className="text-xs capitalize">{u.health}</Badge>}
                    <span className="text-xs text-muted-foreground ml-auto">{format(new Date(u.created_at), "MMM d, yyyy")}</span>
                  </div>
                  {u.summary && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{u.summary}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
