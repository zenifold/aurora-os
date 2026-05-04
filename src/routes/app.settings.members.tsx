import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

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

function MembersPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();

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

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">People with access to this workspace.</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card">
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

      <div className="mt-6 rounded-xl border border-dashed border-border bg-aura-gradient-subtle p-6 text-sm">
        <p className="font-medium">Inviting teammates</p>
        <p className="mt-1 text-muted-foreground">
          Email invitations are coming soon. For now, ask teammates to sign up at this workspace's URL — owners can promote them here.
        </p>
      </div>
    </div>
  );
}
