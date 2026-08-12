import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useProject } from "@/hooks/use-projects";
import { useProjectDecisions } from "@/hooks/use-meetings";
import {
  useProjectOverview,
  useRefreshProjectOverview,
  useUpdateProjectOverviewSettings,
} from "@/hooks/use-project-overview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Settings,
  History,
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
  Receipt,
  Wallet,
} from "lucide-react";
import { REFRESH_CADENCE_LABELS, type RefreshCadence } from "@/lib/overview-types";
import {
  OverviewSectionCard,
  HealthBadge,
} from "@/components/overview/OverviewSnapshotCard";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { EntityLinksPanel } from "@/components/entity-links/EntityLinksPanel";
import { EntityBacklinksPanel } from "@/components/entity-links/EntityBacklinksPanel";

export const Route = createFileRoute("/app/p/$projectId/overview")({
  component: OverviewPage,
});

function OverviewPage() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading: loadingProject } = useProject(projectId);
  const { data, isLoading } = useProjectOverview(projectId);
  const refresh = useRefreshProjectOverview(projectId);
  const updateSettings = useUpdateProjectOverviewSettings(projectId);
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);

  if (loadingProject || isLoading || !project || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { overview, snapshots: rawSnaps, template } = data;
  const snapshots = rawSnaps as unknown as import("@/lib/overview-types").OverviewSnapshot[];
  const activeSnap =
    snapshots.find((s) => s.id === activeSnapshotId) ?? snapshots[0] ?? null;
  const sections =
    activeSnap?.sections && activeSnap.sections.length > 0
      ? activeSnap.sections
      : template.map((t) => ({
          ...t,
          content_md: "_No snapshot yet — click Refresh to generate one._",
          content_text: "",
        }));

  const onRefresh = async () => {
    try {
      const r = await refresh.mutateAsync();
      if (r && typeof r === "object" && "error" in r) toast.error(String((r as { error: unknown }).error));
      else toast.success("Overview refreshed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/app/p/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to work
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/p/$projectId/settings" params={{ projectId }}>
            <Settings className="mr-1.5 h-4 w-4" /> Project settings
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <Badge variant="secondary">Overview</Badge>
            <HealthBadge health={activeSnap?.health ?? null} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeSnap?.summary ||
              "AI-generated TL;DR of this project — refresh to populate."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeSnap
              ? `Updated ${formatDistanceToNow(new Date(activeSnap.generated_at), { addSuffix: true })}`
              : "No snapshot yet"}
            {overview.refresh_status === "running" && " · refreshing…"}
            {overview.refresh_status === "error" && overview.refresh_error && (
              <span className="text-destructive"> · {overview.refresh_error}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={overview.refresh_cadence}
            onValueChange={(v) =>
              updateSettings.mutate({ refresh_cadence: v as RefreshCadence })
            }
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(REFRESH_CADENCE_LABELS) as RefreshCadence[]).map((k) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {REFRESH_CADENCE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={onRefresh}
            disabled={refresh.isPending || overview.refresh_status === "running"}
          >
            {refresh.isPending || overview.refresh_status === "running" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh now
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
        {/* Sections */}
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((s) => (
            <OverviewSectionCard key={s.key} section={s} />
          ))}
        </div>

        {/* Sidebar: timeline + nav */}
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Snapshot timeline
            </h3>
            <Card>
              <CardContent className="p-2">
                {snapshots.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    No snapshots yet.
                  </p>
                )}
                <ul className="space-y-0.5">
                  {snapshots.map((s) => {
                    const isActive = (activeSnap?.id ?? null) === s.id;
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => setActiveSnapshotId(s.id)}
                          className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                            isActive
                              ? "bg-accent text-foreground"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          }`}
                        >
                          <div className="font-medium text-foreground">
                            {formatDistanceToNow(new Date(s.generated_at), {
                              addSuffix: true,
                            })}
                          </div>
                          <div className="truncate opacity-80">
                            {s.summary || "—"}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Drill down
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <NavTile to="/app/p/$projectId" params={{ projectId }} icon={ListChecks} label="Tasks" />
              <NavTile to="/app/p/$projectId/sprints" params={{ projectId }} icon={Target} label="Sprints" />
              <NavTile to="/app/p/$projectId/milestones" params={{ projectId }} icon={Flag} label="Milestones" />
              <NavTile to="/app/p/$projectId/health" params={{ projectId }} icon={Activity} label="Health" />
              <NavTile to="/app/p/$projectId/financials" params={{ projectId }} icon={DollarSign} label="Financials" />
              <NavTile to="/app/p/$projectId/invoices" params={{ projectId }} icon={Receipt} label="Invoices" />
              <NavTile to="/app/p/$projectId/expenses" params={{ projectId }} icon={Wallet} label="Expenses" />
              <NavTile to="/app/p/$projectId/change-orders" params={{ projectId }} icon={FileEdit} label="Changes" />
              <NavTile to="/app/p/$projectId/allocations" params={{ projectId }} icon={UsersRound} label="Allocations" />
              <NavTile to="/app/p/$projectId/clients" params={{ projectId }} icon={Users} label="Clients" />
              <NavTile to="/app/p/$projectId/documents" params={{ projectId }} icon={FileText} label="Documents" />
              <NavTile to="/app/p/$projectId/pages" params={{ projectId }} icon={StickyNote} label="Pages" />
              <NavTile to="/app/notes" search={{ project: projectId, archived: false }} icon={StickyNote} label="Notes" />
              <NavTile to="/app/meetings" search={{ project: projectId }} icon={Mic} label="Meetings" />
            </div>
          </div>

          <ProjectDecisionsPanel projectId={projectId} />
        </div>
      </div>
    </div>
  );
}

function NavTile({
  to,
  params,
  search,
  icon: Icon,
  label,
}: {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      search={search as never}
      className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}

function ProjectDecisionsPanel({ projectId }: { projectId: string }) {
  const { data: rows = [] } = useProjectDecisions(projectId);
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Recent decisions
      </h3>
      <Card>
        <CardContent className="p-3">
          <ul className="space-y-2 text-sm">
            {rows.slice(0, 8).map((r, i) => (
              <li key={`${r.meetingId}-${i}`} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground">{r.text}</p>
                  <Link
                    to="/app/meetings/$meetingId"
                    params={{ meetingId: r.meetingId }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {r.meetingTitle} · {formatDistanceToNow(new Date(r.at), { addSuffix: true })}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <EntityLinksPanel kind="project" id={projectId} title="Related items" />
        <EntityBacklinksPanel kind="project" id={projectId} hideWhenEmpty />
      </div>
    </div>
  );
}
