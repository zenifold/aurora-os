import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { useProject } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { useSprints } from "@/hooks/use-sprints";
import { useMilestones } from "@/hooks/use-milestones";
import { useTeamMembers } from "@/hooks/use-team";
import {
  useProjectFinancials,
  useProjectTimeLogs,
  computeSummary,
} from "@/hooks/use-project-financials";
import { computeHealthReport, BAND_META } from "@/lib/health-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Activity, AlertTriangle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/p/$projectId/health")({
  component: HealthPage,
});

function HealthPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: tasks = [] } = useTasks(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const { data: milestones = [] } = useMilestones(projectId);
  const { data: members = [] } = useTeamMembers();
  const { data: financials } = useProjectFinancials(projectId);
  const { data: logs = [] } = useProjectTimeLogs(projectId);

  const paymentMs = useMemo(
    () => milestones.filter((m) => m.milestone_type === "payment"),
    [milestones],
  );
  const summary = useMemo(
    () => computeSummary(financials ?? null, logs, members, paymentMs),
    [financials, logs, members, paymentMs],
  );

  const report = useMemo(
    () =>
      computeHealthReport({
        milestones,
        sprints,
        tasks,
        members,
        financial: summary,
      }),
    [milestones, sprints, tasks, members, summary],
  );

  const radarData = report.dimensions.map((d) => ({
    dim: d.label,
    score: d.score,
  }));

  const bandMeta = BAND_META[report.band];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/p/$projectId" params={{ projectId }}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Link>
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <Activity className="h-5 w-5" /> Delivery health
              </h1>
              <p className="text-xs text-muted-foreground">{project?.name ?? ""}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("font-semibold", bandMeta.tone)}>
            {bandMeta.label}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr,1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overall score</CardTitle>
              <CardDescription>Weighted across 5 delivery dimensions</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <div className="relative flex h-40 w-40 items-center justify-center">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    className="fill-none stroke-muted"
                    strokeWidth="10"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    className={cn("fill-none transition-all", scoreStroke(report.overall))}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(report.overall / 100) * 326.7} 326.7`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold">{report.overall}</span>
                  <span className={cn("text-xs font-medium", bandMeta.tone)}>
                    {bandMeta.label}
                  </span>
                </div>
              </div>
              {report.flags.length > 0 ? (
                <div className="w-full space-y-1">
                  {report.flags.map((f) => (
                    <div
                      key={f}
                      className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {f}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No risks detected</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dimension breakdown</CardTitle>
              <CardDescription>Click a dimension below for details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="80%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="dim"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.35}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {report.dimensions.map((d) => (
            <Card key={d.key}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{d.label}</span>
                  <span className={cn("text-lg font-bold", scoreText(d.score))}>
                    {Math.round(d.score)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full transition-all", scoreFill(d.score))}
                    style={{ width: `${d.score}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{d.insight}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  Weight {Math.round(d.weight * 100)}%
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-amber-500" /> Suggested actions
            </CardTitle>
            <CardDescription>
              Generated from current schedule, scope, budget, quality and team signals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.dimensions.filter((d) => d.action).length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Project is healthy across all tracked dimensions. 🎉
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {report.dimensions
                  .filter((d) => d.action)
                  .map((d) => (
                    <li key={d.key} className="flex items-start gap-3 py-3">
                      <span
                        className={cn(
                          "mt-1 inline-flex h-2 w-2 shrink-0 rounded-full",
                          scoreFill(d.score),
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {d.label}: {d.insight}
                        </p>
                        <p className="text-sm text-muted-foreground">{d.action}</p>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function scoreText(score: number): string {
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 70) return "text-blue-600 dark:text-blue-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function scoreFill(score: number): string {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-blue-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function scoreStroke(score: number): string {
  if (score >= 85) return "stroke-emerald-500";
  if (score >= 70) return "stroke-blue-500";
  if (score >= 50) return "stroke-amber-500";
  return "stroke-rose-500";
}
