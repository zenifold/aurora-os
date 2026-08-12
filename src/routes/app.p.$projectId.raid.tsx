import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  AlertTriangle,
  HelpCircle,
  AlertCircle,
  Gavel,
  ShieldAlert,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useProject } from "@/hooks/use-projects";
import { useTeamMembers } from "@/hooks/use-team";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useRaidItems,
  useUpsertRaidItem,
  useDeleteRaidItem,
} from "@/hooks/use-raid";
import {
  RAID_TYPE_META,
  RAID_IMPACT_META,
  RAID_LIKELIHOOD_META,
  RAID_STATUS_META,
  raidRiskScore,
  raidScoreTone,
  type RaidItem,
  type RaidItemType,
  type RaidImpact,
  type RaidLikelihood,
  type RaidStatus,
} from "@/lib/raid-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/p/$projectId/raid")({
  head: () => ({ meta: [{ title: "RAID log" }] }),
  component: RaidPage,
});

const TYPE_ICONS = {
  risk: AlertTriangle,
  assumption: HelpCircle,
  issue: AlertCircle,
  decision: Gavel,
} as const;

function RaidPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: items = [] } = useRaidItems(projectId);
  const [tab, setTab] = useState<"all" | RaidItemType>("all");
  const [editing, setEditing] = useState<Partial<RaidItem> | null>(null);

  const byType = useMemo(() => {
    const m: Record<RaidItemType, RaidItem[]> = { risk: [], assumption: [], issue: [], decision: [] };
    items.forEach((i) => m[i.item_type].push(i));
    return m;
  }, [items]);

  const visible = tab === "all" ? items : byType[tab];

  const openCount = (t: RaidItemType) =>
    byType[t].filter((i) => i.status === "open" || i.status === "monitoring").length;

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
                <ShieldAlert className="h-5 w-5" /> RAID log
              </h1>
              <p className="text-xs text-muted-foreground">{project?.name ?? ""}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() =>
              setEditing({
                project_id: projectId,
                item_type: tab === "all" ? "risk" : tab,
                title: "",
                status: "open",
                tags: [],
                is_client_visible: false,
              })
            }
          >
            <Plus className="mr-1.5 h-4 w-4" /> New item
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        <div className="grid gap-3 sm:grid-cols-4">
          {(["risk", "assumption", "issue", "decision"] as RaidItemType[]).map((t) => {
            const meta = RAID_TYPE_META[t];
            const Icon = TYPE_ICONS[t];
            return (
              <Card key={t} className="cursor-pointer transition hover:border-primary/40" onClick={() => setTab(t)}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-2">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", meta.tone)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{meta.plural}</p>
                      <p className="text-xs text-muted-foreground">{openCount(t)} open</p>
                    </div>
                  </div>
                  <span className="text-xl font-semibold">{byType[t].length}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All ({items.length})</TabsTrigger>
            <TabsTrigger value="risk">Risks ({byType.risk.length})</TabsTrigger>
            <TabsTrigger value="assumption">Assumptions ({byType.assumption.length})</TabsTrigger>
            <TabsTrigger value="issue">Issues ({byType.issue.length})</TabsTrigger>
            <TabsTrigger value="decision">Decisions ({byType.decision.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            <RaidList items={visible} onEdit={(i) => setEditing(i)} projectId={projectId} />
          </TabsContent>
        </Tabs>
      </main>

      {editing && (
        <RaidEditDialog
          value={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RaidList({
  items,
  onEdit,
  projectId,
}: {
  items: RaidItem[];
  onEdit: (i: RaidItem) => void;
  projectId: string;
}) {
  const { data: members = [] } = useTeamMembers();
  const profiles = useProfilesByIds(members.map((m) => m.user_id));
  const del = useDeleteRaidItem();

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Nothing logged yet</p>
          <p className="text-xs text-muted-foreground">
            Track risks, working assumptions, live issues, and key decisions here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">Title</th>
              <th className="px-4 py-2 text-left font-medium">Owner</th>
              <th className="px-4 py-2 text-left font-medium">Score</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Due</th>
              <th className="px-4 py-2 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const ownerName = i.owner_id ? profiles[i.owner_id] ?? "—" : "—";
              const score = raidRiskScore(i);
              const typeMeta = RAID_TYPE_META[i.item_type];
              const statusMeta = RAID_STATUS_META[i.status];
              return (
                <tr key={i.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary" className={typeMeta.tone}>
                      {typeMeta.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        className="truncate text-left font-medium hover:underline"
                        onClick={() => onEdit(i)}
                      >
                        {i.title}
                      </button>
                      {i.is_client_visible ? (
                        <Eye className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <EyeOff className="h-3 w-3 text-muted-foreground/40" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {ownerName}
                  </td>
                  <td className="px-4 py-2.5">
                    {i.item_type === "risk" && score > 0 ? (
                      <Badge variant="secondary" className={raidScoreTone(score)}>
                        {score}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary" className={statusMeta.tone}>
                      {statusMeta.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {i.due_date ? format(new Date(i.due_date), "MMM d") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(i)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-rose-600"
                      onClick={() => {
                        if (confirm(`Delete "${i.title}"?`)) {
                          del.mutate({ id: i.id, project_id: projectId });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function RaidEditDialog({
  value,
  onClose,
}: {
  value: Partial<RaidItem>;
  onClose: () => void;
}) {
  const [v, setV] = useState<Partial<RaidItem>>(value);
  const upsert = useUpsertRaidItem();
  const { data: members = [] } = useTeamMembers();
  const profiles = useProfilesByIds(members.map((m) => m.user_id));

  const isRiskish = v.item_type === "risk" || v.item_type === "issue";
  const isDecision = v.item_type === "decision";

  const submit = async () => {
    if (!v.title?.trim() || !v.project_id || !v.item_type) return;
    await upsert.mutateAsync({
      ...v,
      project_id: v.project_id,
      item_type: v.item_type,
      title: v.title.trim(),
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{v.id ? "Edit RAID item" : "New RAID item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={v.item_type ?? "risk"}
                onValueChange={(x) => setV({ ...v, item_type: x as RaidItemType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(RAID_TYPE_META) as RaidItemType[]).map((k) => (
                    <SelectItem key={k} value={k}>{RAID_TYPE_META[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={v.status ?? "open"}
                onValueChange={(x) => setV({ ...v, status: x as RaidStatus })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(RAID_STATUS_META) as RaidStatus[]).map((k) => (
                    <SelectItem key={k} value={k}>{RAID_STATUS_META[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              value={v.title ?? ""}
              onChange={(e) => setV({ ...v, title: e.target.value })}
              placeholder={
                v.item_type === "risk"
                  ? "e.g. Client SME unavailable during integration phase"
                  : v.item_type === "assumption"
                    ? "e.g. Production data will be migrated by IT"
                    : v.item_type === "issue"
                      ? "e.g. SSO certificate not issued yet"
                      : "e.g. Use REST instead of GraphQL for v1"
              }
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              rows={3}
              value={v.description ?? ""}
              onChange={(e) => setV({ ...v, description: e.target.value })}
            />
          </div>

          {isRiskish && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Impact</Label>
                <Select
                  value={v.impact ?? "_none"}
                  onValueChange={(x) =>
                    setV({ ...v, impact: x === "_none" ? null : (x as RaidImpact) })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {(Object.keys(RAID_IMPACT_META) as RaidImpact[]).map((k) => (
                      <SelectItem key={k} value={k}>{RAID_IMPACT_META[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Likelihood</Label>
                <Select
                  value={v.likelihood ?? "_none"}
                  onValueChange={(x) =>
                    setV({ ...v, likelihood: x === "_none" ? null : (x as RaidLikelihood) })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {(Object.keys(RAID_LIKELIHOOD_META) as RaidLikelihood[]).map((k) => (
                      <SelectItem key={k} value={k}>{RAID_LIKELIHOOD_META[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {(isRiskish || v.item_type === "assumption") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Mitigation / response plan</Label>
              <Textarea
                rows={2}
                value={v.mitigation ?? ""}
                onChange={(e) => setV({ ...v, mitigation: e.target.value })}
                placeholder="How will we prevent, reduce or respond to this?"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Owner</Label>
              <Select
                value={v.owner_id ?? "_none"}
                onValueChange={(x) => setV({ ...v, owner_id: x === "_none" ? null : x })}
              >
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {profiles[m.user_id] ?? m.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isDecision ? "Decided on" : "Due date"}</Label>
              <Input
                type="date"
                value={
                  isDecision
                    ? v.decided_at?.slice(0, 10) ?? ""
                    : v.due_date ?? ""
                }
                onChange={(e) => {
                  if (isDecision) {
                    setV({ ...v, decided_at: e.target.value ? new Date(e.target.value).toISOString() : null });
                  } else {
                    setV({ ...v, due_date: e.target.value || null });
                  }
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-2.5">
            <div>
              <Label className="text-xs">Visible to client in portal</Label>
              <p className="text-[11px] text-muted-foreground">Share this item externally</p>
            </div>
            <Switch
              checked={v.is_client_visible ?? false}
              onCheckedChange={(c) => setV({ ...v, is_client_visible: c })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!v.title?.trim() || upsert.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useProfilesByIds(userIds: string[]): Record<string, string> {
  const key = [...new Set(userIds)].filter(Boolean).sort().join(",");
  const { data } = useQuery({
    queryKey: ["raid_profiles", key],
    enabled: key.length > 0,
    queryFn: async () => {
      const ids = key.split(",");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: { id: string; display_name: string | null }) => {
        map[p.id] = p.display_name ?? p.id.slice(0, 8);
      });
      return map;
    },
  });
  return data ?? {};
}
