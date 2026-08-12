import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useProjects } from "@/hooks/use-projects";
import { listClientAccounts } from "@/lib/clients.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Briefcase,
  Building2,
  Search,
  LayoutGrid,
  List as ListIcon,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { cn } from "@/lib/utils";

type GroupMode = "client" | "flat";
type StatusFilter = "all" | "active" | "archived";

type ProjectsSearch = {
  group?: GroupMode;
  q?: string;
  status?: StatusFilter;
  client?: string;
};

export const Route = createFileRoute("/app/projects")({
  component: ProjectsPage,
  validateSearch: (s: Record<string, unknown>): ProjectsSearch => ({
    group: s.group === "flat" || s.group === "client" ? s.group : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    status:
      s.status === "active" || s.status === "archived" || s.status === "all"
        ? s.status
        : undefined,
    client: typeof s.client === "string" ? s.client : undefined,
  }),
});

const UNASSIGNED = "__unassigned__";

function ProjectsPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const vocab = useVocabulary();
  const nav = useNavigate();
  const search = Route.useSearch();
  const groupMode: GroupMode = search.group ?? "client";
  const [q, setQ] = useState(search.q ?? "");
  const statusFilter: StatusFilter = search.status ?? "active";

  const { data: projects = [], isLoading } = useProjects();

  // Folders carry the client_account_id link
  const { data: folders = [] } = useQuery({
    queryKey: ["folders-min", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("id, client_account_id")
        .eq("workspace_id", ws!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const listClients = useServerFn(listClientAccounts);
  const { data: clients = [] } = useQuery({
    queryKey: ["client-accounts", ws?.id],
    queryFn: () => listClients({ data: { workspace_id: ws!.id } }),
    enabled: !!ws?.id,
  });

  const folderClientMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const f of folders) m.set(f.id, f.client_account_id ?? null);
    return m;
  }, [folders]);

  const clientMap = useMemo(() => {
    const m = new Map<string, (typeof clients)[number]>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  function projectClientId(p: { folder_id?: string | null }): string | null {
    if (!p.folder_id) return null;
    return folderClientMap.get(p.folder_id) ?? null;
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter === "active" && p.is_archived) return false;
      if (statusFilter === "archived" && !p.is_archived) return false;
      if (search.client) {
        const cid = projectClientId(p);
        if (search.client === UNASSIGNED ? cid !== null : cid !== search.client) return false;
      }
      if (!needle) return true;
      const cid = projectClientId(p);
      const cname = cid ? clientMap.get(cid)?.name?.toLowerCase() ?? "" : "";
      return (
        p.name.toLowerCase().includes(needle) ||
        (p.description ?? "").toLowerCase().includes(needle) ||
        (p.client_name ?? "").toLowerCase().includes(needle) ||
        cname.includes(needle)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, q, statusFilter, search.client, folderClientMap, clientMap]);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof projects>();
    for (const p of filtered) {
      const cid = projectClientId(p) ?? UNASSIGNED;
      const arr = groups.get(cid) ?? [];
      arr.push(p);
      groups.set(cid, arr);
    }
    // Sort: linked clients first by name, then unassigned last
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === UNASSIGNED) return 1;
      if (b === UNASSIGNED) return -1;
      const an = clientMap.get(a)?.name ?? "";
      const bn = clientMap.get(b)?.name ?? "";
      return an.localeCompare(bn);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, clientMap, folderClientMap]);

  function updateSearch(patch: Partial<ProjectsSearch>) {
    nav({
      to: "/app/projects",
      search: {
        ...search,
        ...patch,
        q: patch.q !== undefined ? patch.q || undefined : search.q || undefined,
      },
      replace: true,
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Briefcase className="h-6 w-6" /> Projects
          </h1>
          <p className="text-sm text-muted-foreground">
            Every project in this workspace. Toggle <span className="font-medium text-foreground">Group by {vocab.customer.singular.toLowerCase()}</span> to see them rolled up by CRM record.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-xs">
            <button
              onClick={() => updateSearch({ group: "client" })}
              className={cn(
                "rounded-sm px-2 py-1 inline-flex items-center gap-1",
                groupMode === "client" ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> By {vocab.customer.singular.toLowerCase()}
            </button>
            <button
              onClick={() => updateSearch({ group: "flat" })}
              className={cn(
                "rounded-sm px-2 py-1 inline-flex items-center gap-1",
                groupMode === "flat" ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              <ListIcon className="h-3.5 w-3.5" /> Flat list
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              updateSearch({ q: e.target.value });
            }}
            placeholder="Search projects…"
            className="pl-8 h-9 w-72"
          />
        </div>
        <Select
          value={search.client ?? "__any__"}
          onValueChange={(v) => updateSearch({ client: v === "__any__" ? undefined : v })}
        >
          <SelectTrigger className="h-9 w-56">
            <SelectValue placeholder={`Any ${vocab.customer.singular.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__any__">Any {vocab.customer.singular.toLowerCase()}</SelectItem>
            <SelectItem value={UNASSIGNED}>— Unassigned —</SelectItem>
            {clients
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => updateSearch({ status: v as StatusFilter })}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered.length} {filtered.length === 1 ? "project" : "projects"}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          No projects match these filters.
        </Card>
      ) : groupMode === "flat" ? (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Project</th>
                <th className="px-3 py-2 text-left font-medium">{vocab.customer.singular}</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Health</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const cid = projectClientId(p);
                const client = cid ? clientMap.get(cid) : null;
                return (
                  <tr
                    key={p.id}
                    className="border-t border-border hover:bg-accent/50 cursor-pointer"
                    onClick={() => nav({ to: "/app/p/$projectId", params: { projectId: p.id } })}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: p.color ?? "#8b5cf6" }}
                        />
                        <span className="font-medium">{p.name}</span>
                        {p.is_archived && (
                          <Badge variant="outline" className="text-[10px]">
                            archived
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {client ? (
                        <Link
                          to="/app/clients/$accountId"
                          params={{ accountId: client.id }}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-foreground hover:underline"
                        >
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {client.name}
                        </Link>
                      ) : p.client_name ? (
                        <span className="text-muted-foreground">{p.client_name}</span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {p.phase ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {p.health ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([cid, items]) => {
            const client = cid === UNASSIGNED ? null : clientMap.get(cid);
            return (
              <Card key={cid} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {client ? (
                      <Link
                        to="/app/clients/$accountId"
                        params={{ accountId: client.id }}
                        className="font-semibold hover:underline"
                      >
                        {client.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-muted-foreground">
                        Unassigned
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {items.length}
                    </Badge>
                  </div>
                  {client && (
                    <Link
                      to="/app/clients/$accountId"
                      params={{ accountId: client.id }}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Open {vocab.customer.singular.toLowerCase()}{" "}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                <ul className="divide-y divide-border">
                  {items.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/50 cursor-pointer"
                      onClick={() => nav({ to: "/app/p/$projectId", params: { projectId: p.id } })}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: p.color ?? "#8b5cf6" }}
                        />
                        <span className="font-medium truncate">{p.name}</span>
                        {p.is_archived && (
                          <Badge variant="outline" className="text-[10px]">
                            archived
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {p.phase && <span>{p.phase}</span>}
                        {p.health && <span>· {p.health}</span>}
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
