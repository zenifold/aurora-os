import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import {
  Activity as ActivityIcon,
  Filter,
  CheckSquare,
  FolderKanban,
  Users as UsersIcon,
  FileText,
  Briefcase,
  MessageSquare,
  DollarSign,
  Clock as ClockIcon,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ListSkeleton } from "@/components/ui/loading-scaffolds";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useWorkspaceActivity, type WorkspaceActivityEntry } from "@/hooks/use-workspace-activity";
import { useWorkspaceMembers } from "@/hooks/use-comments";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/activity")({
  component: ActivityPage,
});

type EntityMeta = { label: string; icon: typeof ActivityIcon; tone: string };

const ENTITY_META: Record<string, EntityMeta> = {
  task: { label: "Tasks", icon: CheckSquare, tone: "text-blue-500" },
  project: { label: "Projects", icon: FolderKanban, tone: "text-violet-500" },
  contact: { label: "Contacts", icon: UsersIcon, tone: "text-emerald-500" },
  deal: { label: "Deals", icon: Briefcase, tone: "text-amber-500" },
  document: { label: "Documents", icon: FileText, tone: "text-foreground/70" },
  comment: { label: "Comments", icon: MessageSquare, tone: "text-pink-500" },
  invoice: { label: "Invoices", icon: DollarSign, tone: "text-emerald-600" },
  time_entry: { label: "Time", icon: ClockIcon, tone: "text-cyan-500" },
  agent_run: { label: "Agent runs", icon: Sparkles, tone: "text-purple-500" },
};

function bucketLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return "This week";
  return "Earlier";
}

function entityLink(e: WorkspaceActivityEntry): string | null {
  if (e.entity_type === "task" || e.entity_type === "comment") {
    const projectId = (e.changes as { project_id?: string } | null)?.project_id;
    if (projectId) return `/app/p/${projectId}`;
  }
  if (e.entity_type === "project") return `/app/p/${e.entity_id}`;
  if (e.entity_type === "contact") return `/app/contacts/${e.entity_id}`;
  if (e.entity_type === "deal") return `/app/crm`;
  return null;
}

function describe(e: WorkspaceActivityEntry): string {
  const actor = e.actor?.display_name ?? "Someone";
  const verb = e.action.replace(/_/g, " ");
  const meta = ENTITY_META[e.entity_type];
  const label = meta?.label.toLowerCase().replace(/s$/, "") ?? e.entity_type;
  const title = (e.changes as { title?: string; name?: string } | null);
  const name = title?.title ?? title?.name;
  return name ? `${actor} ${verb} ${label} “${name}”` : `${actor} ${verb} a ${label}`;
}

function ActivityPage() {
  const { user } = useAuth();
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [actorId, setActorId] = useState<string | null>(null);
  const [scope, setScope] = useState<"all" | "mine">("all");

  const { data: members = [] } = useWorkspaceMembers();
  const effectiveActor = scope === "mine" ? user?.id ?? null : actorId;
  const { data: items = [], isLoading } = useWorkspaceActivity({
    entityTypes: selectedTypes.size ? Array.from(selectedTypes) : undefined,
    actorId: effectiveActor,
    limit: 200,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, WorkspaceActivityEntry[]>();
    for (const it of items) {
      const k = bucketLabel(new Date(it.created_at));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  const toggleType = (t: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ActivityIcon className="h-6 w-6" /> Activity
          </h1>
          <p className="text-sm text-muted-foreground">
            Everything happening across the workspace, as it happens.
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={scope}
          onValueChange={(v) => v && setScope(v as "all" | "mine")}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all">Everyone</ToggleGroupItem>
          <ToggleGroupItem value="mine" disabled={!user}>
            Just me
          </ToggleGroupItem>
        </ToggleGroup>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              {selectedTypes.size ? `${selectedTypes.size} type${selectedTypes.size > 1 ? "s" : ""}` : "All types"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Entity types</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(ENTITY_META).map(([k, m]) => (
              <DropdownMenuCheckboxItem
                key={k}
                checked={selectedTypes.has(k)}
                onCheckedChange={() => toggleType(k)}
              >
                <m.icon className={cn("mr-2 h-3.5 w-3.5", m.tone)} />
                {m.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {actorId
                ? members.find((m) => m.id === actorId)?.display_name ?? "Member"
                : "Anyone"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
            <DropdownMenuLabel>Filter by member</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={!actorId} onCheckedChange={() => setActorId(null)}>
              Anyone
            </DropdownMenuCheckboxItem>
            {members.map((m) => (
              <DropdownMenuCheckboxItem
                key={m.id}
                checked={actorId === m.id}
                onCheckedChange={() => setActorId(m.id)}
              >
                {m.display_name ?? "Unnamed"}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {(selectedTypes.size > 0 || actorId) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedTypes(new Set());
              setActorId(null);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-4">
            <ListSkeleton rows={8} />
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <ActivityIcon className="h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">No activity yet.</p>
            <p className="text-xs">Changes across tasks, projects and contacts will appear here.</p>
          </div>
        ) : (
          grouped.map(([label, list]) => (
            <div key={label}>
              <div className="sticky top-0 z-[1] border-b border-border bg-card/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                {label}
              </div>
              {list.map((it) => {
                const meta = ENTITY_META[it.entity_type] ?? {
                  label: it.entity_type,
                  icon: ActivityIcon,
                  tone: "text-foreground/70",
                };
                const Icon = meta.icon;
                const link = entityLink(it);
                const initials = it.actor?.display_name?.slice(0, 2).toUpperCase() ?? "?";
                const row = (
                  <div className="flex items-start gap-3 border-b border-border/60 px-4 py-3 transition-colors hover:bg-accent/40">
                    <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                      <AvatarImage src={it.actor?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="truncate">{describe(it)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[10px]">
                          <Icon className={cn("h-3 w-3", meta.tone)} />
                          {meta.label}
                        </Badge>
                        <span>{formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                );
                return link ? (
                  <Link key={it.id} to={link}>
                    {row}
                  </Link>
                ) : (
                  <div key={it.id}>{row}</div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
