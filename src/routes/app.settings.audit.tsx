import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { RoleGuard } from "@/components/app/RoleGuard";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, ScrollText } from "lucide-react";
import { format, subDays } from "date-fns";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";

export const Route = createFileRoute("/app/settings/audit")({
  component: () => (
    <RoleGuard min="manager">
      <AuditPage />
    </RoleGuard>
  ),
});

interface AuditRow {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  metadata: unknown;
  created_at: string;
}

const DATE_RANGES: Record<string, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

function AuditPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { can } = usePermissions();
  const canExport = can(PERMISSIONS.AUDIT_EXPORT);

  const [targetType, setTargetType] = useState<string>("__all__");
  const [action, setAction] = useState<string>("__all__");
  const [actorFilter, setActorFilter] = useState<string>("__all__");
  const [dateRange, setDateRange] = useState<string>("7d");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(200);

  const { data: rows = [], isFetching, refetch } = useQuery({
    queryKey: ["audit-log", ws?.id, targetType, action, actorFilter, dateRange, limit],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("audit_log_entries")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (targetType !== "__all__") q = q.eq("target_type", targetType);
      if (action !== "__all__") q = q.eq("action", action);
      if (actorFilter !== "__all__") q = q.eq("actor_id", actorFilter);
      const days = DATE_RANGES[dateRange];
      if (days != null) q = q.gte("created_at", subDays(new Date(), days).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const actorIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x))),
    [rows],
  );
  const { data: actors = [] } = useQuery({
    queryKey: ["audit-actors", actorIds.sort().join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", actorIds);
      return data ?? [];
    },
  });
  const actorMap = useMemo(() => new Map(actors.map((a) => [a.id, a])), [actors]);

  const { data: workspaceMembers = [] } = useQuery({
    queryKey: ["audit-workspace-actors", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data: members } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", ws!.id);
      const ids = (members ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [] as Array<{ user_id: string; display_name: string | null }>;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      const pm = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
      return ids.map((id) => ({ user_id: id, display_name: pm.get(id) ?? null }));
    },
  });


  const targetTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.target_type).filter(Boolean) as string[])).sort(),
    [rows],
  );
  const actions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.action.toLowerCase().includes(q) ||
        (r.target_type ?? "").toLowerCase().includes(q) ||
        (r.target_id ?? "").toLowerCase().includes(q) ||
        (r.target_label ?? "").toLowerCase().includes(q) ||
        (r.actor_email ?? "").toLowerCase().includes(q) ||
        JSON.stringify(r.metadata ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const exportCsv = () => {
    const header = ["timestamp", "actor", "actor_email", "action", "target_type", "target_id", "target_label", "metadata"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const actor = r.actor_id ? actorMap.get(r.actor_id)?.display_name ?? r.actor_id : "system";
      const cells = [
        r.created_at,
        actor,
        r.actor_email ?? "",
        r.action,
        r.target_type ?? "",
        r.target_id ?? "",
        r.target_label ?? "",
        JSON.stringify(r.metadata ?? ""),
      ].map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`);
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ScrollText className="h-4 w-4" /> Audit log
          </h2>
          <p className="text-sm text-muted-foreground">
            Workspace activity for compliance and access reviews. Showing up to {limit} entries.
          </p>
        </div>
        {canExport && (
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search action, target, actor…"
          className="h-9 w-64"
        />
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actorFilter} onValueChange={setActorFilter}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All actors</SelectItem>
            {workspaceMembers.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {m.display_name ?? m.user_id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={targetType} onValueChange={setTargetType}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All targets</SelectItem>
            {targetTypes.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All actions</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
          <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="100">100 rows</SelectItem>
            <SelectItem value="200">200 rows</SelectItem>
            <SelectItem value="500">500 rows</SelectItem>
            <SelectItem value="1000">1000 rows</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          {isFetching && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Refresh
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Actor</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Target</th>
              <th className="px-3 py-2 text-left">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !isFetching && (
              <tr>
                <td colSpan={5} className="px-3 py-12 text-center text-sm text-muted-foreground">
                  No activity matches these filters.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const actor = r.actor_id ? actorMap.get(r.actor_id) : null;
              return (
                <tr key={r.id} className="border-t border-border align-top hover:bg-muted/20">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "MMM d, HH:mm:ss")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    <div>{actor?.display_name ?? r.actor_email ?? "system"}</div>
                    {r.actor_email && actor?.display_name && (
                      <div className="text-[10px] text-muted-foreground">{r.actor_email}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px]">{r.action}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.target_type && <span className="font-medium">{r.target_type}</span>}{" "}
                    <span className="text-muted-foreground">
                      {r.target_label ?? (r.target_id ? r.target_id.slice(0, 8) : "—")}
                    </span>
                  </td>
                  <td className="max-w-md px-3 py-2 text-xs">
                    {r.metadata && Object.keys(r.metadata as object).length > 0 ? (
                      <pre className="overflow-hidden text-ellipsis whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
                        {JSON.stringify(r.metadata, null, 0).slice(0, 240)}
                      </pre>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
