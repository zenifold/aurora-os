import { createFileRoute, Link, Navigate, useParams } from "@tanstack/react-router";
import { useFolder, useFolders, useUpdateFolder } from "@/hooks/use-folders";
import { useDivisions } from "@/hooks/use-folders";
import { useProjects } from "@/hooks/use-projects";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Folder, FolderOpen, Loader2, Mail, Building2, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/app/f/$folderId")({
  component: FolderPage,
});

function FolderPage() {
  const { folderId } = useParams({ from: "/app/f/$folderId" });
  const { data: folder, isLoading } = useFolder(folderId);
  const { data: divisions = [] } = useDivisions();
  const { data: allFolders = [] } = useFolders();
  const { data: allProjects = [] } = useProjects();
  const update = useUpdateFolder();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setDescription(folder.description ?? "");
    }
  }, [folder]);

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!folder) return <Navigate to="/app" />;

  const division = divisions.find((d) => d.id === folder.division_id);
  const childFolders = allFolders.filter((f) => f.parent_id === folder.id);
  const childProjects = allProjects.filter((p) => p.folder_id === folder.id);

  // Build breadcrumb chain
  const chain: typeof allFolders = [];
  let cur = folder;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent_id ? (allFolders.find((f) => f.id === cur.parent_id) ?? null as never) : null as never;
    if (!cur) break;
  }

  const isClient = folder.folder_type === "client";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-border" style={{ background: division ? `linear-gradient(180deg, ${division.color}10, transparent)` : undefined }}>
        <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-8">
          <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {division && (
              <>
                <Link to="/app/d/$divisionSlug" params={{ divisionSlug: division.slug }} className="hover:text-foreground">{division.name}</Link>
                <ChevronRight className="h-3 w-3" />
              </>
            )}
            {chain.slice(0, -1).map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <Link to="/app/f/$folderId" params={{ folderId: c.id }} className="hover:text-foreground">{c.name}</Link>
                <ChevronRight className="h-3 w-3" />
              </span>
            ))}
            <span className="text-foreground">{folder.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: `${(folder.color ?? division?.color ?? "#8b5cf6")}22`, color: folder.color ?? division?.color ?? "#8b5cf6" }}>
              {childFolders.length || childProjects.length ? <FolderOpen className="h-5 w-5" /> : <Folder className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 max-w-md text-xl font-semibold" />
              ) : (
                <h1 className="text-2xl font-semibold tracking-tight">{folder.name}</h1>
              )}
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] uppercase">{folder.folder_type}</Badge>
                {folder.client_company && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="h-3 w-3" />{folder.client_company}</span>
                )}
                {folder.client_email && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{folder.client_email}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setName(folder.name); setDescription(folder.description ?? ""); }}>Cancel</Button>
                  <Button size="sm" onClick={async () => { await update.mutateAsync({ id: folder.id, name, description }); setEditing(false); }}>Save</Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8">
        {isClient ? (
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="folders">Folders</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="Active projects" value={childProjects.filter((p) => !p.is_archived).length} />
                <Kpi label="Sub-folders" value={childFolders.length} />
                <Kpi label="Folder type" value={folder.folder_type} />
                <Kpi label="Tags" value={folder.tags.length} />
              </div>
              {editing ? (
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-4" placeholder="Description" />
              ) : folder.description ? (
                <p className="mt-4 text-sm text-muted-foreground">{folder.description}</p>
              ) : null}
            </TabsContent>
            <TabsContent value="projects" className="mt-4">
              <ProjectGrid projects={childProjects} />
            </TabsContent>
            <TabsContent value="folders" className="mt-4">
              <FolderGrid folders={childFolders} />
            </TabsContent>
          </Tabs>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Sub-folders" value={childFolders.length} />
              <Kpi label="Projects" value={childProjects.length} />
              <Kpi label="Folder type" value={folder.folder_type} />
              <Kpi label="Tags" value={folder.tags.length} />
            </div>
            {(editing || folder.description) && (
              <div className="mt-4">
                {editing ? (
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
                ) : (
                  <p className="text-sm text-muted-foreground">{folder.description}</p>
                )}
              </div>
            )}
            {childFolders.length > 0 && (
              <>
                <SectionHeader title="Folders" />
                <FolderGrid folders={childFolders} />
              </>
            )}
            {childProjects.length > 0 && (
              <>
                <SectionHeader title="Projects" />
                <ProjectGrid projects={childProjects} />
              </>
            )}
            {childFolders.length === 0 && childProjects.length === 0 && (
              <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Empty folder. Create sub-folders or projects from the sidebar.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold capitalize">{value}</div>
    </Card>
  );
}
function SectionHeader({ title }: { title: string }) {
  return <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>;
}
function FolderGrid({ folders }: { folders: ReturnType<typeof useFolders>["data"] }) {
  const list = folders ?? [];
  if (list.length === 0) return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No folders yet.</div>;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((f) => (
        <Link key={f.id} to="/app/f/$folderId" params={{ folderId: f.id }}>
          <Card className="cursor-pointer p-4 transition-colors hover:border-primary/50">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{f.name}</span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
function ProjectGrid({ projects }: { projects: ReturnType<typeof useProjects>["data"] }) {
  const list = projects ?? [];
  if (list.length === 0) return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No projects yet.</div>;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((p) => (
        <Link key={p.id} to="/app/p/$projectId" params={{ projectId: p.id }}>
          <Card className="cursor-pointer p-3 transition-colors hover:border-primary/50">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
              <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
