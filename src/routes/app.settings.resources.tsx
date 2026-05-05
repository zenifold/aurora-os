import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useTeamMembers, useUpsertTeamMember } from "@/hooks/use-team";
import { TEAM_ROLES, SENIORITY_LEVELS, type TeamMember } from "@/lib/team-types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { Switch } from "@/components/ui/switch";
import { Pencil, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/settings/resources")({
  component: ResourcesPage,
});

interface MemberRow {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  joined_at: string;
}

function ResourcesPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: team = [], isLoading: teamLoading } = useTeamMembers();
  const upsert = useUpsertTeamMember();
  const [editing, setEditing] = useState<MemberRow | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["resources_members", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const [{ data: m }, { data: profs }] = await Promise.all([
        supabase
          .from("workspace_members")
          .select("user_id, joined_at")
          .eq("workspace_id", ws!.id),
        supabase.from("profiles").select("id, display_name, avatar_url"),
      ]);
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      return (m ?? []).map((row) => {
        const p = profMap.get(row.user_id);
        return {
          user_id: row.user_id,
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          joined_at: row.joined_at,
        };
      }) as MemberRow[];
    },
  });

  // Allocated hours: sum planned_hours of active sprints per assignee.
  const { data: allocations = new Map<string, number>() } = useQuery<Map<string, number>>({
    queryKey: ["resource_allocations", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const map = new Map<string, number>();
      const { data: sprints } = await supabase
        .from("sprints" as never)
        .select("id, planned_hours, status")
        .eq("workspace_id", ws!.id)
        .eq("status", "active");
      const sprintIds = ((sprints ?? []) as Array<{ id: string; planned_hours: number }>).map(
        (s) => s.id,
      );
      if (!sprintIds.length) return map;
      const { data: links } = await supabase
        .from("sprint_tasks" as never)
        .select("sprint_id, task_id")
        .in("sprint_id", sprintIds);
      const taskIds = ((links ?? []) as Array<{ task_id: string }>).map((l) => l.task_id);
      if (!taskIds.length) return map;
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, assignee_ids")
        .in("id", taskIds);
      // Naive: each active sprint task contributes 4h to each assignee. (We don't yet store per-task estimates.)
      // Replace later with custom_values.estimate_hours when available.
      for (const t of tasks ?? []) {
        const ids = (t.assignee_ids as string[] | null) ?? [];
        for (const uid of ids) map.set(uid, (map.get(uid) ?? 0) + 4);
      }
      return map;
    },
  });

  const teamByUser = useMemo(
    () => new Map(team.map((t) => [t.user_id, t])),
    [team],
  );

  if (isLoading || teamLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Resources</h1>
        <p className="text-sm text-muted-foreground">
          Manage roles, capacity, and rates for everyone delivering work.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Team capacity</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </div>
        <div className="divide-y divide-border">
          {members.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No workspace members yet. Invite teammates from Members.
            </div>
          ) : (
            members.map((m) => {
              const profile = teamByUser.get(m.user_id);
              const capacity = profile?.weekly_capacity_hours ?? 40;
              const allocated = allocations.get(m.user_id) ?? 0;
              const pct = capacity > 0 ? Math.round((allocated / capacity) * 100) : 0;
              const tone =
                pct > 100 ? "bg-rose-500" : pct > 85 ? "bg-amber-500" : "bg-emerald-500";
              const initials = (m.display_name ?? "?").slice(0, 2).toUpperCase();
              return (
                <div key={m.user_id} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
                  <div className="col-span-12 sm:col-span-4 flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9">
                      {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                      <AvatarFallback className="bg-aura-gradient text-xs text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {m.display_name ?? "Unnamed"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground capitalize">
                        {profile?.role ?? "contributor"}
                        {profile?.seniority ? ` · ${profile.seniority}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="col-span-12 sm:col-span-5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {allocated}h / {capacity}h this week
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          pct > 100 && "text-rose-600 dark:text-rose-400",
                          pct > 85 && pct <= 100 && "text-amber-600 dark:text-amber-400",
                          pct <= 85 && "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {pct}%
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, pct)}
                      className={cn("mt-1.5 h-1.5", `[&>div]:${tone}`)}
                    />
                  </div>

                  <div className="col-span-8 sm:col-span-2 text-xs text-muted-foreground">
                    {profile?.hourly_bill_rate
                      ? `$${profile.hourly_bill_rate}/h bill`
                      : "No rate"}
                  </div>

                  <div className="col-span-4 sm:col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(m)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>

                  {profile?.skills && profile.skills.length > 0 && (
                    <div className="col-span-12 flex flex-wrap gap-1.5">
                      {profile.skills.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Allocated hours estimate active-sprint tasks at 4h each per assignee. We'll switch to
        per-task estimates as soon as you start tracking them.
      </p>

      {editing && (
        <EditMemberDialog
          member={editing}
          existing={teamByUser.get(editing.user_id)}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            upsert.mutate({ user_id: editing.user_id, ...patch });
            setEditing(null);
          }}
          saving={upsert.isPending}
        />
      )}
    </div>
  );
}

function EditMemberDialog({
  member,
  existing,
  onClose,
  onSave,
  saving,
}: {
  member: MemberRow;
  existing?: TeamMember;
  onClose: () => void;
  onSave: (patch: Partial<TeamMember>) => void;
  saving: boolean;
}) {
  const [role, setRole] = useState<string>(existing?.role ?? "contributor");
  const [seniority, setSeniority] = useState<string>(existing?.seniority ?? "mid");
  const [capacity, setCapacity] = useState<string>(
    String(existing?.weekly_capacity_hours ?? 40),
  );
  const [cost, setCost] = useState<string>(
    existing?.hourly_cost ? String(existing.hourly_cost) : "",
  );
  const [bill, setBill] = useState<string>(
    existing?.hourly_bill_rate ? String(existing.hourly_bill_rate) : "",
  );
  const [skillsText, setSkillsText] = useState<string>((existing?.skills ?? []).join(", "));
  const [active, setActive] = useState<boolean>(existing?.is_active ?? true);

  const submit = () => {
    onSave({
      role,
      seniority,
      weekly_capacity_hours: Number(capacity) || 0,
      hourly_cost: cost ? Number(cost) : null,
      hourly_bill_rate: bill ? Number(bill) : null,
      skills: skillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      is_active: active,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member.display_name ?? "Member"} · profile</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Seniority</Label>
              <Select value={seniority} onValueChange={setSeniority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SENIORITY_LEVELS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Weekly capacity (hours)</Label>
            <Input
              type="number"
              min={0}
              max={168}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Hourly cost</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hourly bill rate</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={bill}
                onChange={(e) => setBill(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Skills</Label>
            <Input
              placeholder="React, Figma, Strategy"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Comma-separated.</p>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Inactive members are excluded from auto-assign.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
