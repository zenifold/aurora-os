import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Trash2,
  Copy,
  Mail,
  Loader2,
  Search,
  MoreVertical,
  ShieldOff,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import {
  PERMISSIONS,
  ROLE_META,
  type WorkspaceRoleSlug,
} from "@/lib/permissions";
import { ROLE_LABEL, type PrimaryRole } from "@/lib/role-nav";

const PRIMARY_ROLE_OPTIONS: PrimaryRole[] = [
  "partner",
  "sales",
  "account_manager",
  "pm",
  "delivery",
  "client_user",
];

export const Route = createFileRoute("/app/settings/members")({
  component: () => (
    <RoleGuard min="manager">
      <MembersPage />
    </RoleGuard>
  ),
});

type SystemRole = WorkspaceRoleSlug;

interface MemberRow {
  id: string;
  user_id: string;
  joined_at: string;
  is_suspended: boolean;
  last_active_at: string | null;
  profile: { display_name: string | null; avatar_url: string | null; primary_role: PrimaryRole | null } | null;
  role: SystemRole;
  primary_role: PrimaryRole | null;
  email: string | null;
}

interface InviteRow {
  id: string;
  email: string;
  role: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
}

const ROLE_OPTIONS: SystemRole[] = ["admin", "manager", "member", "viewer", "guest"];

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function MembersPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  const perms = usePermissions();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SystemRole>("member");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | SystemRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const canInvite = perms.can(PERMISSIONS.MEMBERS_INVITE);
  const canRemove = perms.can(PERMISSIONS.MEMBERS_REMOVE);
  const canChangeRole = perms.can(PERMISSIONS.MEMBERS_CHANGE_ROLE);
  const canSuspend = perms.can(PERMISSIONS.MEMBERS_SUSPEND);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const [{ data: m }, { data: roles }, { data: profs }] = await Promise.all([
        supabase
          .from("workspace_members")
          .select("id, user_id, joined_at, is_suspended, last_active_at, invited_email")
          .eq("workspace_id", ws!.id),
        supabase.from("user_roles").select("user_id, role").eq("workspace_id", ws!.id),
        supabase.from("profiles").select("id, display_name, avatar_url, primary_role"),
      ]);
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      return (m ?? []).map((row) => {
        const prof = profMap.get(row.user_id) ?? null;
        return {
          id: row.id,
          user_id: row.user_id,
          joined_at: row.joined_at,
          is_suspended: row.is_suspended ?? false,
          last_active_at: row.last_active_at,
          email: row.invited_email,
          role: (roleMap.get(row.user_id) ?? "member") as SystemRole,
          primary_role: (prof?.primary_role ?? null) as PrimaryRole | null,
          profile: prof as MemberRow["profile"],
        };
      }) as MemberRow[];
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["invites", ws?.id],
    enabled: !!ws && canInvite,
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_invitations")
        .select("id, email, role, token, status, expires_at, created_at")
        .eq("workspace_id", ws!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return (data ?? []) as InviteRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (statusFilter === "active" && m.is_suspended) return false;
      if (statusFilter === "suspended" && !m.is_suspended) return false;
      if (!q) return true;
      const name = (m.profile?.display_name ?? "").toLowerCase();
      const email = (m.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [members, search, roleFilter, statusFilter]);

  const allSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.user_id));
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.filter((m) => m.role !== "owner" && m.user_id !== user?.id).map((m) => m.user_id)));
    }
  };
  const toggleOne = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: SystemRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role })
        .eq("workspace_id", ws!.id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", ws?.id] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changePrimaryRole = useMutation({
    mutationFn: async ({ userId, primaryRole }: { userId: string; primaryRole: PrimaryRole }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ primary_role: primaryRole })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", ws?.id] });
      toast.success("Function updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setSuspended = useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
      const { error } = await supabase
        .from("workspace_members")
        .update({ is_suspended: suspend })
        .eq("workspace_id", ws!.id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["members", ws?.id] });
      toast.success(vars.suspend ? "Member suspended" : "Member reactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from("user_roles").delete().eq("workspace_id", ws!.id).eq("user_id", userId);
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", ws!.id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", ws?.id] });
      toast.success("Member removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkRole = useMutation({
    mutationFn: async (role: SystemRole) => {
      const ids = Array.from(selected);
      for (const uid of ids) {
        await supabase
          .from("user_roles")
          .update({ role })
          .eq("workspace_id", ws!.id)
          .eq("user_id", uid);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", ws?.id] });
      setSelected(new Set());
      toast.success("Roles updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkSuspend = useMutation({
    mutationFn: async (suspend: boolean) => {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from("workspace_members")
        .update({ is_suspended: suspend })
        .eq("workspace_id", ws!.id)
        .in("user_id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, suspend) => {
      qc.invalidateQueries({ queryKey: ["members", ws?.id] });
      setSelected(new Set());
      toast.success(suspend ? "Members suspended" : "Members reactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkRemove = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      await supabase.from("user_roles").delete().eq("workspace_id", ws!.id).in("user_id", ids);
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", ws!.id)
        .in("user_id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", ws?.id] });
      setSelected(new Set());
      toast.success("Members removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("workspace_invitations")
        .insert({
          workspace_id: ws!.id,
          email: inviteEmail.toLowerCase().trim(),
          invited_by: user!.id,
          role: inviteRole,
        })
        .select("token")
        .single();
      if (error) throw error;
      return data.token as string;
    },
    onSuccess: (token) => {
      qc.invalidateQueries({ queryKey: ["invites", ws?.id] });
      setInviteEmail("");
      const url = `${window.location.origin}/invite/${token}`;
      navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Invite created — link copied to clipboard");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invites", ws?.id] });
      toast.success("Invitation revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendInvite = useMutation({
    mutationFn: async (inv: InviteRow) => {
      // Reset expiry by deleting + reinserting (keeps email, role)
      await supabase.from("workspace_invitations").delete().eq("id", inv.id);
      const { data, error } = await supabase
        .from("workspace_invitations")
        .insert({ workspace_id: ws!.id, email: inv.email, invited_by: user!.id, role: inv.role })
        .select("token")
        .single();
      if (error) throw error;
      return data.token as string;
    },
    onSuccess: (token) => {
      qc.invalidateQueries({ queryKey: ["invites", ws?.id] });
      const url = `${window.location.origin}/invite/${token}`;
      navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Invitation refreshed — link copied");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    toast.success("Link copied");
  };

  const counts = useMemo(() => {
    return {
      total: members.length,
      active: members.filter((m) => !m.is_suspended).length,
      suspended: members.filter((m) => m.is_suspended).length,
    };
  }, [members]);

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {counts.total} total · {counts.active} active · {counts.suspended} suspended
          </p>
        </div>
      </div>

      {canInvite && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Invite by email</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            We'll generate a share link you can send. Invitations expire in 14 days.
          </p>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (inviteEmail.trim()) createInvite.mutate();
            }}
          >
            <Input
              type="email"
              required
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 min-w-[220px]"
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as SystemRole)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_META[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="submit"
              disabled={createInvite.isPending || !inviteEmail.trim()}
              className="bg-aura-gradient text-primary-foreground hover:opacity-90"
            >
              {createInvite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create invite
            </Button>
          </form>
        </div>
      )}

      {canInvite && invites.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Pending invitations ({invites.length})
          </div>
          <ul className="divide-y divide-border">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="secondary">{inv.role}</Badge>
                <Button variant="ghost" size="icon" onClick={() => copyLink(inv.token)} title="Copy invite link">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => resendInvite.mutate(inv)} title="Refresh & copy">
                  <Mail className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => revokeInvite.mutate(inv.id)} title="Revoke">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "all" | SystemRole)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {(["owner", ...ROLE_OPTIONS] as SystemRole[]).map((r) => (
              <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "active" | "suspended")}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          {canChangeRole && (
            <Select onValueChange={(v) => bulkRole.mutate(v as SystemRole)}>
              <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Change role to…" /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canSuspend && (
            <>
              <Button size="sm" variant="outline" onClick={() => bulkSuspend.mutate(true)}>
                <ShieldOff className="mr-2 h-4 w-4" />Suspend
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkSuspend.mutate(false)}>
                <ShieldCheck className="mr-2 h-4 w-4" />Reactivate
              </Button>
            </>
          )}
          {canRemove && (
            <Button size="sm" variant="destructive" onClick={() => bulkRemove.mutate()}>
              <Trash2 className="mr-2 h-4 w-4" />Remove
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Member table */}
      <div className="mt-3 rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[36px_1fr_140px_160px_140px_40px] items-center gap-3 border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
          <div>Member</div>
          <div>Role</div>
          <div>Function</div>
          <div>Last active</div>
          <div />
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No members match your filters.</div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((m) => {
              const initials = (m.profile?.display_name ?? m.email ?? "?").slice(0, 2).toUpperCase();
              const isSelf = m.user_id === user?.id;
              const isOwnerRow = m.role === "owner";
              const meta = ROLE_META[m.role];
              return (
                <li
                  key={m.id}
                  className={`grid grid-cols-[36px_1fr_140px_160px_140px_40px] items-center gap-3 px-4 py-3 ${m.is_suspended ? "opacity-60" : ""}`}
                >
                  <Checkbox
                    checked={selected.has(m.user_id)}
                    onCheckedChange={() => toggleOne(m.user_id)}
                    disabled={isOwnerRow || isSelf}
                    aria-label="Select member"
                  />
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9">
                      {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} />}
                      <AvatarFallback className="bg-aura-gradient text-xs text-primary-foreground">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {m.profile?.display_name ?? "Unnamed"}
                        {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                        {m.is_suspended && (
                          <Badge variant="outline" className="ml-2 text-xs">Suspended</Badge>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.email ?? `Joined ${new Date(m.joined_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div>
                    {canChangeRole && !isOwnerRow && !isSelf ? (
                      <Select
                        value={m.role}
                        onValueChange={(v) => changeRole.mutate({ userId: m.user_id, role: v as SystemRole })}
                      >
                        <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant={isOwnerRow ? "default" : "secondary"}
                        className={isOwnerRow ? "bg-aura-gradient text-primary-foreground" : ""}
                        style={!isOwnerRow ? { borderColor: meta.accent, color: meta.accent } : undefined}
                      >
                        {meta.label}
                      </Badge>
                    )}
                  </div>
                  <div>
                    {(canChangeRole || isSelf) && !isOwnerRow ? (
                      <Select
                        value={m.primary_role ?? "delivery"}
                        onValueChange={(v) =>
                          changePrimaryRole.mutate({ userId: m.user_id, primaryRole: v as PrimaryRole })
                        }
                      >
                        <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRIMARY_ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {m.primary_role ? ROLE_LABEL[m.primary_role] : "—"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatRelative(m.last_active_at)}</div>
                  <div className="flex justify-end">
                    {!isOwnerRow && !isSelf && (canSuspend || canRemove) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canSuspend && (
                            <DropdownMenuItem
                              onClick={() => setSuspended.mutate({ userId: m.user_id, suspend: !m.is_suspended })}
                            >
                              {m.is_suspended ? (
                                <><ShieldCheck className="mr-2 h-4 w-4" />Reactivate</>
                              ) : (
                                <><ShieldOff className="mr-2 h-4 w-4" />Suspend</>
                              )}
                            </DropdownMenuItem>
                          )}
                          {canChangeRole && (
                            <DropdownMenuItem disabled>
                              <UserCog className="mr-2 h-4 w-4" />Change role above
                            </DropdownMenuItem>
                          )}
                          {canRemove && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => remove.mutate(m.user_id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />Remove from workspace
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
