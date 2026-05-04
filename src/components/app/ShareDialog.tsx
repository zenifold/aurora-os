import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Copy, Mail, Trash2, Loader2, Globe, Check } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
}

export function ShareDialog({ open, onOpenChange, projectName }: Props) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["share-members", ws?.id],
    enabled: !!ws && open,
    queryFn: async () => {
      const [{ data: m }, { data: roles }, { data: profs }] = await Promise.all([
        supabase.from("workspace_members").select("user_id, joined_at").eq("workspace_id", ws!.id),
        supabase.from("user_roles").select("user_id, role").eq("workspace_id", ws!.id),
        supabase.from("profiles").select("id, display_name, avatar_url"),
      ]);
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      return (m ?? []).map((row) => ({
        user_id: row.user_id,
        role: (roleMap.get(row.user_id) ?? "member") as "owner" | "member",
        profile: profMap.get(row.user_id) ?? null,
      }));
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["share-invites", ws?.id],
    enabled: !!ws && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_invitations")
        .select("id, email, role, token, status, expires_at")
        .eq("workspace_id", ws!.id)
        .eq("status", "pending");
      return data ?? [];
    },
  });

  const isOwner = members.find((m) => m.user_id === user?.id)?.role === "owner";

  const invite = useMutation({
    mutationFn: async (em: string) => {
      const { data, error } = await supabase
        .from("workspace_invitations")
        .insert({
          workspace_id: ws!.id,
          email: em.toLowerCase().trim(),
          invited_by: user!.id,
          role: "member",
        })
        .select("token")
        .single();
      if (error) throw error;
      return data.token as string;
    },
    onSuccess: (token) => {
      qc.invalidateQueries({ queryKey: ["share-invites", ws?.id] });
      setEmail("");
      const url = `${window.location.origin}/invite/${token}`;
      navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Invite link copied");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["share-invites", ws?.id] }),
  });

  const copyInvite = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share "{projectName}"</DialogTitle>
          <DialogDescription>
            Workspace members have access to all non-private projects.
          </DialogDescription>
        </DialogHeader>

        {isOwner && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4 text-muted-foreground" /> Invite by email
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) invite.mutate(email);
              }}
            >
              <Input
                type="email"
                required
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                type="submit"
                disabled={invite.isPending || !email.trim()}
                className="bg-aura-gradient text-primary-foreground hover:opacity-90"
              >
                {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              We generate a shareable link you can send. Invitations expire in 14 days.
            </p>
          </div>
        )}

        {invites.length > 0 && (
          <div className="rounded-lg border border-border">
            <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pending ({invites.length})
            </div>
            <ul className="divide-y divide-border">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center gap-2 px-3 py-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{inv.email}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {inv.role}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyInvite(inv.token)}>
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => revoke.mutate(inv.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-lg border border-border">
          <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            People with access ({members.length})
          </div>
          <ul className="max-h-64 divide-y divide-border overflow-y-auto">
            {members.map((m) => {
              const initials = (m.profile?.display_name ?? "?").slice(0, 2).toUpperCase();
              return (
                <li key={m.user_id} className="flex items-center gap-3 px-3 py-2">
                  <Avatar className="h-7 w-7">
                    {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} />}
                    <AvatarFallback className="bg-aura-gradient text-[10px] text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm">
                    {m.profile?.display_name ?? "Unnamed"}
                    {m.user_id === user?.id && <span className="ml-1 text-muted-foreground">(you)</span>}
                  </span>
                  <Badge
                    variant={m.role === "owner" ? "default" : "secondary"}
                    className={`text-[10px] ${m.role === "owner" ? "bg-aura-gradient text-primary-foreground" : ""}`}
                  >
                    {m.role}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
