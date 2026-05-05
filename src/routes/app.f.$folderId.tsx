import { createFileRoute, Link, Navigate, useNavigate, useParams } from "@tanstack/react-router";
import { useFolder, useFolders, useUpdateFolder, useDeleteFolder, useDivisions } from "@/hooks/use-folders";
import { useProjects } from "@/hooks/use-projects";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Folder as FolderIcon,
  FolderOpen,
  Loader2,
  Mail,
  Building2,
  ChevronRight,
  MoreHorizontal,
  Archive,
  ArchiveRestore,
  Trash2,
  Move,
  Palette,
  Pencil,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { MoveToFolderDialog } from "@/components/folders/MoveToFolderDialog";
import { toast } from "sonner";
import type { Folder } from "@/lib/folder-types";
import { cn } from "@/lib/utils";
import { PresenceStack } from "@/components/app/PresenceStack";
import { usePresence } from "@/hooks/use-presence";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/app/f/$folderId")({
  component: FolderPage,
});

const FOLDER_COLORS = [
  "#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9",
  "#10b981", "#84cc16", "#f59e0b", "#f97316",
  "#ef4444", "#ec4899", "#a855f7", "#64748b",
];

function FolderPage() {
  const { folderId } = useParams({ from: "/app/f/$folderId" });
  const navigate = useNavigate();
  const { data: folder, isLoading } = useFolder(folderId);
  const { data: divisions = [] } = useDivisions();
  const { data: allFolders = [] } = useFolders();
  const { data: allProjects = [] } = useProjects();
  const update = useUpdateFolder();
  const remove = useDeleteFolder();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setDescription(folder.description ?? "");
    }
  }, [folder]);

  const descendants = useMemo(() => {
    if (!folder) return { folders: [] as Folder[], projects: [] as typeof allProjects };
    const folderIds = new Set<string>([folder.id]);
    let added = true;
    while (added) {
      added = false;
      for (const f of allFolders) {
        if (f.parent_id && folderIds.has(f.parent_id) && !folderIds.has(f.id)) {
          folderIds.add(f.id);
          added = true;
        }
      }
    }
    folderIds.delete(folder.id);
    return {
      folders: allFolders.filter((f) => folderIds.has(f.id)),
      projects: allProjects.filter((p) => p.folder_id && folderIds.has(p.folder_id)),
    };
  }, [folder, allFolders, allProjects]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!folder) return <Navigate to="/app" />;

  const division = divisions.find((d) => d.id === folder.division_id);
  const childFolders = allFolders.filter((f) => f.parent_id === folder.id);
  const childProjects = allProjects.filter((p) => p.folder_id === folder.id);
  const directProjectCount = childProjects.length;

  // Build breadcrumb chain (root → ... → current)
  const chain: Folder[] = [];
  {
    let cur: Folder | null = folder;
    while (cur) {
      chain.unshift(cur);
      cur = cur.parent_id ? allFolders.find((f) => f.id === cur!.parent_id) ?? null : null;
    }
  }

  const isClient = folder.folder_type === "client";
  const accent = folder.color ?? division?.color ?? "#8b5cf6";

  const saveEdit = async () => {
    await update.mutateAsync({ id: folder.id, name, description });
    setEditing(false);
  };
  const cancelEdit = () => {
    setEditing(false);
    setName(folder.name);
    setDescription(folder.description ?? "");
  };

  const handleArchiveToggle = async () => {
    await update.mutateAsync({
      id: folder.id,
      is_archived: !folder.is_archived,
      archived_at: !folder.is_archived ? new Date().toISOString() : null,
    });
    toast.success(folder.is_archived ? "Folder restored" : "Folder archived");
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(folder.id);
      navigate({ to: "/app" });
    } catch {
      // toast handled in mutation
    }
  };

  const handleMove = async (target: { division_id: string; folder_id: string | null }) => {
    await update.mutateAsync({
      id: folder.id,
      division_id: target.division_id,
      parent_id: target.folder_id,
    });
    toast.success("Folder moved");
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto animate-page-in">
      <div
        className="border-b border-border"
        style={{ background: `linear-gradient(180deg, ${accent}10, transparent)` }}
      >
        <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-8">
          {/* Breadcrumb */}
          <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {division && (
              <>
                <Link
                  to="/app/d/$divisionSlug"
                  params={{ divisionSlug: division.slug }}
                  className="hover:text-foreground"
                >
                  {division.name}
                </Link>
                <ChevronRight className="h-3 w-3" />
              </>
            )}
            {chain.slice(0, -1).map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <Link
                  to="/app/f/$folderId"
                  params={{ folderId: c.id }}
                  className="hover:text-foreground"
                >
                  {c.name}
                </Link>
                <ChevronRight className="h-3 w-3" />
              </span>
            ))}
            <span className="text-foreground">{folder.name}</span>
          </div>

          {/* Title row */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setColorOpen((v) => !v)}
              className="relative flex h-11 w-11 items-center justify-center rounded-lg transition-transform hover:scale-105"
              style={{ backgroundColor: `${accent}22`, color: accent }}
              title="Change color"
            >
              {childFolders.length || childProjects.length ? (
                <FolderOpen className="h-5 w-5" />
              ) : (
                <FolderIcon className="h-5 w-5" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              {editing ? (
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 max-w-md text-xl font-semibold"
                  autoFocus
                />
              ) : (
                <h1 className="text-2xl font-semibold tracking-tight">{folder.name}</h1>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {folder.folder_type}
                </Badge>
                {folder.is_archived && (
                  <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">
                    Archived
                  </Badge>
                )}
                {folder.client_company && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    {folder.client_company}
                  </span>
                )}
                {folder.client_email && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {folder.client_email}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <PresenceStack users={presenceUsers} />
              {editing ? (
                <>
                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveEdit} disabled={update.isPending}>
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Folder</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setColorOpen(true)}>
                        <Palette className="mr-2 h-4 w-4 text-muted-foreground" /> Change color
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setMoveOpen(true)}>
                        <Move className="mr-2 h-4 w-4 text-muted-foreground" /> Move to…
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleArchiveToggle}>
                        {folder.is_archived ? (
                          <>
                            <ArchiveRestore className="mr-2 h-4 w-4 text-muted-foreground" /> Restore
                          </>
                        ) : (
                          <>
                            <Archive className="mr-2 h-4 w-4 text-muted-foreground" /> Archive
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>

          {/* Color picker pop */}
          {colorOpen && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
              <span className="text-xs text-muted-foreground">Color:</span>
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={async () => {
                    await update.mutateAsync({ id: folder.id, color: c });
                    setColorOpen(false);
                  }}
                  className={cn(
                    "h-6 w-6 rounded-md ring-1 ring-border transition-transform hover:scale-110",
                    folder.color === c && "ring-2 ring-foreground",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Set color ${c}`}
                />
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 px-2 text-xs"
                onClick={async () => {
                  await update.mutateAsync({ id: folder.id, color: null });
                  setColorOpen(false);
                }}
              >
                Reset
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">
              Projects {directProjectCount > 0 && <span className="ml-1 text-muted-foreground">{directProjectCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="folders">
              Folders {childFolders.length > 0 && <span className="ml-1 text-muted-foreground">{childFolders.length}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Sub-folders" value={childFolders.length} />
              <Kpi label="Projects" value={directProjectCount} />
              <Kpi label="Folder type" value={folder.folder_type} />
              <Kpi label="Tags" value={folder.tags.length} />
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </div>
              {editing ? (
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this folder for?"
                  rows={4}
                />
              ) : folder.description ? (
                <p className="text-sm leading-relaxed text-foreground/80">{folder.description}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground">No description yet.</p>
              )}
            </div>

            {isClient && (folder.client_company || folder.client_email) && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Client
                </div>
                <Card className="p-4">
                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    {folder.client_company && (
                      <div>
                        <div className="text-xs text-muted-foreground">Company</div>
                        <div className="font-medium">{folder.client_company}</div>
                      </div>
                    )}
                    {folder.client_email && (
                      <div>
                        <div className="text-xs text-muted-foreground">Email</div>
                        <div className="font-medium">{folder.client_email}</div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="projects" className="mt-4">
            <ProjectGrid projects={childProjects} />
          </TabsContent>

          <TabsContent value="folders" className="mt-4">
            <FolderGrid folders={childFolders} />
          </TabsContent>
        </Tabs>
      </div>

      <MoveToFolderDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title="Move folder"
        excludeFolderIds={[folder.id, ...descendants.folders.map((f) => f.id)]}
        current={{ division_id: folder.division_id, folder_id: folder.parent_id }}
        onConfirm={handleMove}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this folder?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will permanently delete <strong>{folder.name}</strong>.
                </p>
                {(descendants.folders.length > 0 || descendants.projects.length > 0 || directProjectCount > 0) && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-amber-600 dark:text-amber-400">
                    <div className="text-xs font-semibold uppercase tracking-wider">Cascade impact</div>
                    <ul className="mt-1 list-disc pl-5 text-sm">
                      {childFolders.length > 0 && (
                        <li>{childFolders.length} direct sub-folder(s)</li>
                      )}
                      {descendants.folders.length > 0 && (
                        <li>{descendants.folders.length} nested folder(s)</li>
                      )}
                      {(directProjectCount > 0 || descendants.projects.length > 0) && (
                        <li>
                          {directProjectCount + descendants.projects.length} project(s) will become unfiled
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function FolderGrid({ folders }: { folders: Folder[] }) {
  if (folders.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No sub-folders. Add one from the sidebar.
      </div>
    );
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {folders.map((f) => (
        <Link key={f.id} to="/app/f/$folderId" params={{ folderId: f.id }}>
          <Card className="cursor-pointer p-4 transition-colors hover:border-primary/50">
            <div className="flex items-center gap-2">
              <FolderIcon
                className="h-4 w-4"
                style={{ color: f.color ?? "var(--muted-foreground)" }}
              />
              <span className="font-medium">{f.name}</span>
            </div>
            {f.description && (
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{f.description}</p>
            )}
          </Card>
        </Link>
      ))}
    </div>
  );
}

function ProjectGrid({ projects }: { projects: ReturnType<typeof useProjects>["data"] }) {
  const list = projects ?? [];
  if (list.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No projects in this folder yet.
      </div>
    );
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
