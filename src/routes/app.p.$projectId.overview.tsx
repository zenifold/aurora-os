import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useProject } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { useMilestones } from "@/hooks/use-milestones";
import { useSprints } from "@/hooks/use-sprints";
import { useNotes } from "@/hooks/use-notes";
import { useProjectDocuments } from "@/hooks/use-resources";
import { useTeamMembers } from "@/hooks/use-team";
import { useProjectFinancials, useProjectTimeLogs, computeSummary } from "@/hooks/use-project-financials";
import { formatMoney } from "@/lib/financial-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  ListChecks,
  Target,
  Flag,
  StickyNote,
  Mic,
  FileText,
  DollarSign,
  Activity,
  FileEdit,
  UsersRound,
  Users,
  Loader2,
  Settings,
} from "lucide-react";
import { PROJECT_PHASES, PROJECT_HEALTH } from "@/lib/types";

export const Route = createFileRoute("/app/p/$projectId/overview")({
  component: OverviewPage,
});

function SectionCard({
  title,
  description,
  to,
  params,
  search,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  icon: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      search={search as never}
      className="group block"
    >
      <Card className="h-full transition-all hover:border-primary/40 hover:shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-sm">{title}</CardTitle>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          {description && (
            <CardDescription className="pt-1 text-xs">{description}</CardDescription>
          )}
        </CardHeader>
        {children && <CardContent className="pt-0 text-xs">{children}</CardContent>}
      </Card>
    </Link>
  );
}

function OverviewPage() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading } = useProject(projectId);
  const { data: tasks = [] } = useTasks(projectId);
  const { data: milestones = [] } = useMilestones(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const { data: notes = [] } = useNotes({ projectId });
  const { data: documents = [] } = useProjectDocuments(projectId);
  const { data: financials } = useProjectFinancials(projectId);
  const { data: timeLogs = [] } = useProjectTimeLogs(projectId);
  const { data: members = [] } = useTeamMembers();

  const summary = useMemo(
    () => computeSummary(financials ?? null, timeLogs, members, []),
    [financials, timeLogs, members]
  );

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const overdue = tasks.filter(
      (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done"
    ).length;
    return { total, done, inProgress, overdue, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [tasks]);

  const activeSprint = sprints.find((s) => s.status === "active");
  const upcomingMilestone = milestones
    .filter((m) => m.status !== "completed" && m.target_date)
    .sort((a, b) => (a.target_date! > b.target_date! ? 1 : -1))[0];

  if (isLoading || !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const phaseMeta = project.phase ? PROJECT_PHASE_META[project.phase] : null;
  const healthMeta = project.health ? PROJECT_HEALTH_META[project.health] : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/app/p/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to work
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/p/$projectId/settings" params={{ projectId }}>
            <Settings className="mr-1.5 h-4 w-4" /> Settings
          </Link>
        </Button>
      </div>

      <div className="mb-8 flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl font-semibold"
          style={{ backgroundColor: `${project.color}22`, color: project.color }}
        >
          {project.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            {phaseMeta && <Badge variant="secondary">{phaseMeta.label}</Badge>}
            {healthMeta && (
              <Badge className={healthMeta.tone}>{healthMeta.label}</Badge>
            )}
            {project.is_client_project && (
              <Badge variant="outline">
                Client{project.client_name ? ` · ${project.client_name}` : ""}
              </Badge>
            )}
          </div>
          {project.description && (
            <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Progress</p>
            <p className="text-xl font-semibold">{taskStats.pct}%</p>
            <Progress value={taskStats.pct} className="mt-2 h-1" />
            <p className="mt-1 text-xs text-muted-foreground">
              {taskStats.done}/{taskStats.total} tasks
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">In progress</p>
            <p className="text-xl font-semibold">{taskStats.inProgress}</p>
            <p className="mt-1 text-xs text-destructive">
              {taskStats.overdue > 0 ? `${taskStats.overdue} overdue` : "On track"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Budget burn</p>
            <p className="text-xl font-semibold">
              {summary.contractValue
                ? `${Math.round(((summary.spent ?? 0) / summary.contractValue) * 100)}%`
                : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatMoney(summary.spent, financials?.currency ?? "USD")} spent
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active sprint</p>
            <p className="truncate text-xl font-semibold">
              {activeSprint?.name ?? "None"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {sprints.length} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Work */}
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Work
      </h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          title="Tasks"
          description="All work, views & filters"
          to="/app/p/$projectId"
          params={{ projectId }}
          icon={ListChecks}
        >
          <span className="text-muted-foreground">
            {taskStats.total} tasks · {taskStats.inProgress} active
          </span>
        </SectionCard>
        <SectionCard
          title="Sprints"
          description="Backlog, planning & active sprint"
          to="/app/p/$projectId/sprints"
          params={{ projectId }}
          icon={Target}
        >
          <span className="text-muted-foreground">
            {activeSprint ? `${activeSprint.name} active` : `${sprints.length} sprints`}
          </span>
        </SectionCard>
        <SectionCard
          title="Milestones"
          description="Key deliverables & dates"
          to="/app/p/$projectId/milestones"
          params={{ projectId }}
          icon={Flag}
        >
          <span className="text-muted-foreground">
            {upcomingMilestone
              ? `Next: ${upcomingMilestone.name}`
              : `${milestones.length} milestones`}
          </span>
        </SectionCard>
      </div>

      {/* Knowledge */}
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Knowledge
      </h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          title="Notes"
          description="Project notes & docs"
          to="/app/notes"
          search={{ project: projectId, archived: false }}
          icon={StickyNote}
        >
          <span className="text-muted-foreground">{notes.length} notes</span>
        </SectionCard>
        <SectionCard
          title="Meetings"
          description="Recordings & summaries"
          to="/app/meetings"
          search={{ project: projectId }}
          icon={Mic}
        >
          <span className="text-muted-foreground">View meetings</span>
        </SectionCard>
        <SectionCard
          title="Documents"
          description="Files & deliverables"
          to="/app/p/$projectId/documents"
          params={{ projectId }}
          icon={FileText}
        >
          <span className="text-muted-foreground">{documents.length} files</span>
        </SectionCard>
      </div>

      {/* Delivery */}
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Delivery & client
      </h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          title="Financials"
          description="Budget, billing & margin"
          to="/app/p/$projectId/financials"
          params={{ projectId }}
          icon={DollarSign}
        >
          <span className="text-muted-foreground">
            {summary.contractValue
              ? formatMoney(summary.contractValue, financials?.currency ?? "USD")
              : "Not set up"}
          </span>
        </SectionCard>
        <SectionCard
          title="Health"
          description="Risks, status & RAG"
          to="/app/p/$projectId/health"
          params={{ projectId }}
          icon={Activity}
        >
          <span className="text-muted-foreground">
            {healthMeta ? healthMeta.label : "No status"}
          </span>
        </SectionCard>
        <SectionCard
          title="Change orders"
          description="Scope changes & approvals"
          to="/app/p/$projectId/change-orders"
          params={{ projectId }}
          icon={FileEdit}
        />
        <SectionCard
          title="Allocations"
          description="Team capacity & assignments"
          to="/app/p/$projectId/allocations"
          params={{ projectId }}
          icon={UsersRound}
        />
        <SectionCard
          title="Client portal"
          description="External access & approvals"
          to="/app/p/$projectId/clients"
          params={{ projectId }}
          icon={Users}
        />
      </div>
    </div>
  );
}
