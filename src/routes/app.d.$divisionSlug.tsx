import { createFileRoute, Link, useParams, Navigate } from "@tanstack/react-router";
import { useDivisionBySlug, useFolders } from "@/hooks/use-folders";
import { useProjects } from "@/hooks/use-projects";
import { useEscalations } from "@/hooks/use-escalations";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Folder, FolderPlus, Loader2, TrendingUp, Settings2, AlertTriangle } from "lucide-react";
import type { Division } from "@/lib/folder-types";

export const Route = createFileRoute("/app/d/$divisionSlug")({
  component: DivisionPage,
});

function DivisionPage() {
  const { divisionSlug } = useParams({ from: "/app/d/$divisionSlug" });
  const { data: division, isLoading } = useDivisionBySlug(divisionSlug);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!division) return <Navigate to="/app" />;

  if (division.division_type === "delivery") return <DeliveryOverview division={division} />;
  if (division.division_type === "operations") return <OpsOverview division={division} />;
  if (division.division_type === "sales") return <SalesOverview division={division} />;
  return <GenericDivision division={division} />;
}

function DivisionHeader({ division, icon: Icon, subtitle }: { division: Division; icon: React.ComponentType<{ className?: string }>; subtitle: string }) {
  return (
    <div className="border-b border-border" style={{ background: `linear-gradient(180deg, ${division.color}10, transparent)` }}>
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-6 sm:px-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: `${division.color}22`, color: division.color }}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{division.name}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function DeliveryOverview({ division }: { division: Division }) {
  const { data: folders = [] } = useFolders(division.id);
  const { data: projects = [] } = useProjects();
  const { data: escalations = [] } = useEscalations({ status: "open" });
  const divisionProjects = projects.filter((p) => p.division_id === division.id);
  const rootFolders = folders.filter((f) => !f.parent_id);
  const clientFolders = rootFolders.filter((f) => f.folder_type === "client" || f.folder_type === "portfolio");
  const atRisk = divisionProjects.filter((p) => p.health === "at_risk" || p.health === "critical");

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <DivisionHeader division={division} icon={Briefcase} subtitle="Client work and external delivery" />
      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Active projects" value={divisionProjects.filter((p) => !p.is_archived).length} />
          <KpiCard label="Clients & portfolios" value={clientFolders.length} />
          <KpiCard label="At risk" value={atRisk.length} tone={atRisk.length ? "warn" : undefined} />
          <KpiCard label="Open escalations" value={escalations.length} tone={escalations.length ? "warn" : undefined} />
        </div>

        <SectionHeader title="Clients & portfolios" action={<NewFolderButton divisionId={division.id} />} />
        {clientFolders.length === 0 ? (
          <EmptyHint text="No client folders yet. Create one to organize a client's projects." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clientFolders.map((f) => (
              <Link key={f.id} to="/app/f/$folderId" params={{ folderId: f.id }}>
                <Card className="cursor-pointer p-4 transition-colors hover:border-primary/50">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{f.name}</span>
                    {f.folder_type === "client" && <Badge variant="secondary" className="text-[10px]">Client</Badge>}
                  </div>
                  {f.description && <p className="mt-2 text-xs text-muted-foreground">{f.description}</p>}
                </Card>
              </Link>
            ))}
          </div>
        )}

        <SectionHeader title="All projects" />
        {divisionProjects.length === 0 ? (
          <EmptyHint text="No projects in this division yet." />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {divisionProjects.map((p) => (
              <Link key={p.id} to="/app/p/$projectId" params={{ projectId: p.id }}>
                <Card className="cursor-pointer p-3 transition-colors hover:border-primary/50">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
                    <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
                    {p.health && <HealthBadge health={p.health} />}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OpsOverview({ division }: { division: Division }) {
  const { data: folders = [] } = useFolders(division.id);
  const { data: projects = [] } = useProjects();
  const divisionProjects = projects.filter((p) => p.division_id === division.id);
  const rootFolders = folders.filter((f) => !f.parent_id);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <DivisionHeader division={division} icon={Settings2} subtitle="Internal operations and enablement" />
      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Internal projects" value={divisionProjects.length} />
          <KpiCard label="Folders" value={rootFolders.length} />
          <KpiCard label="Active" value={divisionProjects.filter((p) => !p.is_archived).length} />
          <KpiCard label="Archived" value={divisionProjects.filter((p) => p.is_archived).length} />
        </div>
        <SectionHeader title="Sub-folders" action={<NewFolderButton divisionId={division.id} />} />
        <FolderGrid folders={rootFolders} />
        <SectionHeader title="Projects" />
        <ProjectGrid projects={divisionProjects} />
      </div>
    </div>
  );
}

function SalesOverview({ division }: { division: Division }) {
  const { data: folders = [] } = useFolders(division.id);
  const rootFolders = folders.filter((f) => !f.parent_id);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <DivisionHeader division={division} icon={TrendingUp} subtitle="Pipeline, proposals, and commercial activity" />
      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Pipeline</div>
            <Link to="/app/crm" className="mt-2 inline-flex text-sm font-medium text-primary hover:underline">Open CRM →</Link>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Contacts</div>
            <Link to="/app/contacts" className="mt-2 inline-flex text-sm font-medium text-primary hover:underline">View contacts →</Link>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Forecast</div>
            <Link to="/app/executive" className="mt-2 inline-flex text-sm font-medium text-primary hover:underline">Executive view →</Link>
          </Card>
        </div>
        <SectionHeader title="Sub-folders" action={<NewFolderButton divisionId={division.id} />} />
        <FolderGrid folders={rootFolders} />
      </div>
    </div>
  );
}

function GenericDivision({ division }: { division: Division }) {
  const { data: folders = [] } = useFolders(division.id);
  const { data: projects = [] } = useProjects();
  const divisionProjects = projects.filter((p) => p.division_id === division.id);
  const rootFolders = folders.filter((f) => !f.parent_id);
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <DivisionHeader division={division} icon={Folder} subtitle="Custom division" />
      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8">
        <SectionHeader title="Folders" action={<NewFolderButton divisionId={division.id} />} />
        <FolderGrid folders={rootFolders} />
        <SectionHeader title="Projects" />
        <ProjectGrid projects={divisionProjects} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number | string; tone?: "warn" }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-500" : ""}`}>{value}</div>
    </Card>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {action}
    </div>
  );
}

function NewFolderButton({ divisionId }: { divisionId: string }) {
  // Create handled inline in sidebar; this is a hint for division pages.
  void divisionId;
  return (
    <Button variant="outline" size="sm" disabled title="Use sidebar to create folders for now">
      <FolderPlus className="mr-1.5 h-4 w-4" /> New folder
    </Button>
  );
}

function FolderGrid({ folders }: { folders: ReturnType<typeof useFolders>["data"] }) {
  const list = folders ?? [];
  if (list.length === 0) return <EmptyHint text="No folders yet." />;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((f) => (
        <Link key={f.id} to="/app/f/$folderId" params={{ folderId: f.id }}>
          <Card className="cursor-pointer p-4 transition-colors hover:border-primary/50">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{f.name}</span>
            </div>
            {f.description && <p className="mt-2 text-xs text-muted-foreground">{f.description}</p>}
          </Card>
        </Link>
      ))}
    </div>
  );
}

function ProjectGrid({ projects }: { projects: ReturnType<typeof useProjects>["data"] }) {
  const list = projects ?? [];
  if (list.length === 0) return <EmptyHint text="No projects yet." />;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((p) => (
        <Link key={p.id} to="/app/p/$projectId" params={{ projectId: p.id }}>
          <Card className="cursor-pointer p-3 transition-colors hover:border-primary/50">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
              <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
              {p.health && <HealthBadge health={p.health} />}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function HealthBadge({ health }: { health: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    on_track: { label: "On track", cls: "bg-emerald-500/15 text-emerald-600" },
    at_risk: { label: "At risk", cls: "bg-amber-500/15 text-amber-600" },
    off_track: { label: "Off track", cls: "bg-rose-500/15 text-rose-600" },
  };
  const m = map[health] ?? { label: health, cls: "bg-muted text-muted-foreground" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] ${m.cls}`}>{m.label}</span>;
}

function EmptyHint({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
