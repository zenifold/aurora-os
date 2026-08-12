// Client-first sidebar tree. Replaces the divisions/sections tree.
// Shows: Pinned (clients + projects) → Containers grouped by kind (Personal,
// Clients, Internal). Sections shown depend on workspace_mode.
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, KeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  User,
  Boxes,
  Star,
  Pin,
  PinOff,
  Plus,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useContainers, type Container, type ContainerKind } from "@/hooks/use-containers";
import { useSidebarPins, useTogglePin } from "@/hooks/use-sidebar-pins";
import { useProjects } from "@/hooks/use-projects";
import { useTreeState } from "@/hooks/use-tree-state";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { renameContainer } from "@/lib/containers.functions";
import { NewSpaceDialog } from "@/components/app/NewSpaceDialog";
import type { Project } from "@/lib/types";

const KIND_META: Record<ContainerKind, { label: string; icon: LucideIcon }> = {
  personal: { label: "Personal", icon: User },
  client: { label: "Clients", icon: Building2 },
  internal: { label: "Spaces", icon: Boxes },
};

export function ContainerTree({ currentPath }: { currentPath: string }) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const { data: containers = [] } = useContainers();
  const { data: projects = [] } = useProjects();
  const { data: pins = [] } = useSidebarPins();
  const togglePin = useTogglePin();
  const tree = useTreeState();
  const navigate = useNavigate();
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);

  const mode = ws?.workspace_mode ?? "client_services";

  const personal = containers.find(
    (c) => c.kind === "personal" && c.owner_user_id === user?.id,
  );
  const internals = containers.filter((c) => c.kind === "internal");
  const clients = containers.filter((c) => c.kind === "client");

  const personalHasProjects = !!personal && projects.some((p) => p.client_account_id === personal.id);
  const showPersonal = !!personal && personalHasProjects;

  const showClients = mode !== "internal_team" ? true : clients.length > 0;
  const internalHasProjects = internals.some((i) =>
    projects.some((p) => p.client_account_id === i.id),
  );
  const showInternal = mode !== "solo" || internalHasProjects || internals.length > 1;
  const showClientsGroup = showClients && (mode !== "solo" || clients.length > 0);

  const pinnedClients = pins
    .filter((p) => p.target_type === "client")
    .map((p) => containers.find((c) => c.id === p.target_id))
    .filter(Boolean) as Container[];
  const pinnedProjects = pins
    .filter((p) => p.target_type === "project")
    .map((p) => projects.find((pr) => pr.id === p.target_id))
    .filter(Boolean) as Project[];

  const handleNewInternal = () => setNewSpaceOpen(true);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-3">
        {/* Pinned */}
        {(pinnedClients.length > 0 || pinnedProjects.length > 0) && (
          <Section title="Pinned" icon={Star}>
            {pinnedClients.map((c) => (
              <ContainerRow
                key={`pc-${c.id}`}
                container={c}
                projects={projects.filter((p) => p.client_account_id === c.id)}
                currentPath={currentPath}
                tree={tree}
                pinned
                onTogglePin={() =>
                  togglePin.mutate({ target_type: "client", target_id: c.id, pinned: true })
                }
              />
            ))}
            {pinnedProjects.map((p) => (
              <ProjectRow
                key={`pp-${p.id}`}
                project={p}
                currentPath={currentPath}
                pinned
                onTogglePin={() =>
                  togglePin.mutate({ target_type: "project", target_id: p.id, pinned: true })
                }
              />
            ))}
          </Section>
        )}

        {/* My space (personal) */}
        {showPersonal && personal && (
          <Section title={KIND_META.personal.label} icon={KIND_META.personal.icon}>
            <ContainerRow
              container={personal}
              projects={projects.filter((p) => p.client_account_id === personal.id)}
              currentPath={currentPath}
              tree={tree}
              defaultOpen
              renameable
              onTogglePin={() => {}}
            />
          </Section>
        )}

        {/* Clients */}
        {showClientsGroup && (
          <Section
            title={`${KIND_META.client.label}${clients.length ? ` · ${clients.length}` : ""}`}
            icon={KIND_META.client.icon}
            action={
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate({ to: "/app/clients" })}
                    className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                    aria-label="Add client"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">New client</TooltipContent>
              </Tooltip>
            }
          >
            {clients.length === 0 ? (
              <EmptyHint>No clients yet</EmptyHint>
            ) : (
              clients.map((c) => {
                const isPinned = pins.some(
                  (p) => p.target_type === "client" && p.target_id === c.id,
                );
                return (
                  <ContainerRow
                    key={c.id}
                    container={c}
                    projects={projects.filter((p) => p.client_account_id === c.id)}
                    currentPath={currentPath}
                    tree={tree}
                    pinned={isPinned}
                    renameable
                    onTogglePin={() =>
                      togglePin.mutate({
                        target_type: "client",
                        target_id: c.id,
                        pinned: isPinned,
                      })
                    }
                  />
                );
              })
            )}
          </Section>
        )}

        {/* Internal */}
        {showInternal && (
          <Section
            title={`${KIND_META.internal.label}${internals.length > 1 ? ` · ${internals.length}` : ""}`}
            icon={KIND_META.internal.icon}
            action={
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleNewInternal}
                    className="rounded p-0.5 text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                    aria-label="New Space"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">New Space</TooltipContent>
              </Tooltip>
            }
          >
            {internals.length === 0 ? (
              <EmptyHint>No spaces yet</EmptyHint>
            ) : (
              internals.map((i) => (
                <ContainerRow
                  key={i.id}
                  container={i}
                  projects={projects.filter((p) => p.client_account_id === i.id)}
                  currentPath={currentPath}
                  tree={tree}
                  renameable
                  onTogglePin={() => {}}
                />
              ))
            )}
          </Section>
        )}
      </div>
      <NewSpaceDialog open={newSpaceOpen} onOpenChange={setNewSpaceOpen} />
    </TooltipProvider>
  );
}

function Section({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        <Icon className="h-3 w-3" />
        <span className="flex-1">{title}</span>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1 text-xs italic text-muted-foreground/70">{children}</div>
  );
}

function ContainerRow({
  container,
  projects,
  currentPath,
  tree,
  defaultOpen,
  pinned,
  renameable,
  onTogglePin,
}: {
  container: Container;
  projects: Project[];
  currentPath: string;
  tree: ReturnType<typeof useTreeState>;
  defaultOpen?: boolean;
  pinned?: boolean;
  renameable?: boolean;
  onTogglePin: () => void;
}) {
  const treeKey = `container:${container.id}`;
  const isActive = currentPath.startsWith(`/app/clients/${container.id}`)
    || projects.some((p) => currentPath.startsWith(`/app/p/${p.id}`));
  const open = tree.isOpen(treeKey, defaultOpen ?? isActive);
  const canPin = container.kind === "client";

  const qc = useQueryClient();
  const ws = useWorkspaceStore((s) => s.current);
  const renameFn = useServerFn(renameContainer);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(container.name);

  const renameMut = useMutation({
    mutationFn: (name: string) => renameFn({ data: { id: container.id, name } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["containers", ws?.id] });
      setEditing(false);
      toast.success("Renamed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    const v = draft.trim();
    if (!v || v === container.name) return setEditing(false);
    renameMut.mutate(v);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") {
      setDraft(container.name);
      setEditing(false);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "group/row flex items-center gap-1 rounded-md px-1 py-1 text-sm",
          isActive
            ? "bg-aura-gradient-subtle font-medium"
            : "text-foreground/90 hover:bg-sidebar-accent/40",
        )}
      >
        <button
          onClick={() => tree.toggle(treeKey, defaultOpen ?? isActive)}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submit}
            onKeyDown={onKey}
            className="min-w-0 flex-1 rounded border border-sidebar-border bg-background px-1 text-sm outline-none focus:border-ring"
          />
        ) : (
          <Link
            to="/app/clients/$accountId"
            params={{ accountId: container.id }}
            className="min-w-0 flex-1 truncate"
            onDoubleClick={(e) => {
              if (renameable) {
                e.preventDefault();
                setEditing(true);
              }
            }}
          >
            {container.name}
          </Link>
        )}
        {renameable && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-sidebar-accent/60 hover:text-foreground group-hover/row:opacity-100"
            title="Rename"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {canPin && !editing && (
          <button
            onClick={onTogglePin}
            className={cn(
              "rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-sidebar-accent/60 hover:text-foreground group-hover/row:opacity-100",
              pinned && "opacity-100 text-amber-500",
            )}
            title={pinned ? "Unpin" : "Pin to sidebar"}
          >
            {pinned ? <Pin className="h-3 w-3 fill-current" /> : <PinOff className="h-3 w-3" />}
          </button>
        )}
      </div>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border/60 pl-2">
          {projects.length === 0 ? (
            <EmptyHint>No projects</EmptyHint>
          ) : (
            projects.map((p) => (
              <ProjectRow key={p.id} project={p} currentPath={currentPath} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  currentPath,
  pinned,
  onTogglePin,
}: {
  project: Project;
  currentPath: string;
  pinned?: boolean;
  onTogglePin?: () => void;
}) {
  const active = currentPath.startsWith(`/app/p/${project.id}`);
  return (
    <div
      className={cn(
        "group/p flex items-center gap-1 rounded-md px-1.5 py-1 text-sm",
        active
          ? "bg-aura-gradient-subtle font-medium"
          : "text-foreground/80 hover:bg-sidebar-accent/40 hover:text-foreground",
      )}
    >
      <span
        className="h-2 w-2 flex-shrink-0 rounded-sm"
        style={{ backgroundColor: project.color ?? "hsl(var(--muted))" }}
      />
      <Link
        to="/app/p/$projectId"
        params={{ projectId: project.id }}
        className="min-w-0 flex-1 truncate"
      >
        {project.name}
      </Link>
      {onTogglePin && (
        <button
          onClick={onTogglePin}
          className={cn(
            "rounded p-0.5 text-muted-foreground opacity-0 hover:bg-sidebar-accent/60 hover:text-foreground group-hover/p:opacity-100",
            pinned && "opacity-100 text-amber-500",
          )}
          title={pinned ? "Unpin" : "Pin to sidebar"}
        >
          {pinned ? <Pin className="h-3 w-3 fill-current" /> : <PinOff className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}
