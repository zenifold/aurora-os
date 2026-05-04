import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Trash2, Copy, Mail, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/settings/members")({
  component: MembersPage,
});

interface MemberRow {
  id: string;
  user_id: string;
  joined_at: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  role: "owner" | "member";
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

function MembersPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const [{ data: m }, { data: roles }, { data: profs }] = await Promise.all([
        supabase.from("workspace_members").select("id, user_id, joined_at").eq("workspace_id", ws!.id),
        supabase.from("user_roles").select("user_id, role").eq("workspace_id", ws!.id),
        supabase.from("profiles").select("id, display_name, avatar_url"),
      ]);
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      return (m ?? []).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        joined_at: row.joined_at,
        role: (roleMap.get(row.user_id) ?? "member") as "owner" | "member",
        profile: profMap.get(row.user_id) ?? null,
      })) as MemberRow[];
    },
  });

  const isOwner = members.find((m) => m.user_id === user?.id)?.role === "owner";

  const { data: invites = [] } = useQuery({
    queryKey: ["invites", ws?.id],
    enabled: !!ws && isOwner,
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

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from("user_roles").delete().eq("workspace_id", ws!.id).eq("user_id", userId);
      await supabase.from("workspace_members").delete().eq("workspace_id", ws!.id).eq("user_id", userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", ws?.id] });
      toast.success("Member removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createInvite = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase
        .from("workspace_invitations")
        .insert({ workspace_id: ws!.id, email: email.toLowerCase().trim(), invited_by: user!.id, role: "member" })
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

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    toast.success("Link copied");
  };

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">People with access to this workspace.</p>
        </div>
      </div>

      {isOwner && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Invite by email</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            We'll generate a share link you can send. Invitations expire in 14 days.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (inviteEmail.trim()) createInvite.mutate(inviteEmail);
            }}
          >
            <Input
              type="email"
              required
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
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

      {isOwner && invites.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Pending invitations</div>
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
                <Button variant="ghost" size="icon" onClick={() => revokeInvite.mutate(inv.id)} title="Revoke">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Members</div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => {
              const initials = (m.profile?.display_name ?? "?").slice(0, 2).toUpperCase();
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar className="h-9 w-9">
                    {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} />}
                    <AvatarFallback className="bg-aura-gradient text-xs text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.profile?.display_name ?? "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">Joined {new Date(m.joined_at).toLocaleDateString()}</p>
                  </div>
                  <Badge variant={m.role === "owner" ? "default" : "secondary"} className={m.role === "owner" ? "bg-aura-gradient text-primary-foreground" : ""}>
                    {m.role}
                  </Badge>
                  {isOwner && m.user_id !== user?.id && m.role !== "owner" && (
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(m.user_id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
