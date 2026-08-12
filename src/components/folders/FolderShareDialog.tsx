import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddFolderMember,
  useFolderInvitations,
  useFolderMembers,
  useInviteToFolder,
  useRemoveFolderMember,
  useRevokeFolderInvite,
  useUpdateFolderMember,
  type FolderRole,
} from "@/hooks/use-folder-access";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import { Copy, Loader2, Mail, Trash2, UserPlus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  folderName: string;
  canManage: boolean;
}

const ROLES: { value: FolderRole; label: string; description: string }[] = [
  { value: "viewer", label: "Viewer", description: "Can view content" },
  { value: "editor", label: "Editor", description: "Can edit tasks and projects" },
  { value: "owner", label: "Owner", description: "Full control over folder" },
];

export function FolderShareDialog({ open, onOpenChange, folderId, folderName, canManage }: Props) {
  const ws = useWorkspaceStore((s) => s.current);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<FolderRole>("editor");

  const { data: members = [] } = useFolderMembers(open ? folderId : undefined);
  const { data: invites = [] } = useFolderInvitations(open ? folderId : undefined);
  const add = useAddFolderMember(folderId);
  const update = useUpdateFolderMember(folderId);
  const remove = useRemoveFolderMember(folderId);
  const invite = useInviteToFolder(folderId);
  const revoke = useRevokeFolderInvite(folderId);

  // workspace members not yet on the folder, for direct add
  const { data: wsMembers = [] } = useQuery({
    queryKey: ["share-ws-members", ws?.id],
    enabled: !!ws && open,
    queryFn: async () => {
      const [{ data: m }, { data: profs }] = await Promise.all([
        supabase.from("workspace_members").select("user_id").eq("workspace_id", ws!.id),
        supabase.from("profiles").select("id, display_name, avatar_url"),
      ]);
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      return (m ?? []).map((row) => ({
        user_id: row.user_id,
        profile: profMap.get(row.user_id) ?? null,
      }));
    },
  });

  const memberIds = new Set(members.map((m) => m.user_id));
  const addable = wsMembers.filter((m) => !memberIds.has(m.user_id));

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      const token = await invite.mutateAsync({ email, role });
      navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`).catch(() => {});
      toast.success("Invite link copied");
      setEmail("");
    } catch {
      // toasted in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share "{folderName}"</DialogTitle>
          <DialogDescription>
            Folder access is independent from workspace roles. Use viewer for read-only, editor to
            edit, owner to manage members.
          </DialogDescription>
        </DialogHeader>

        {canManage && addable.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserPlus className="h-4 w-4 text-muted-foreground" /> Add workspace members
            </div>
            <div className="rounded-lg border border-border">
              <ul className="max-h-40 divide-y divide-border overflow-y-auto">
                {addable.map((m) => {
                  const initials = (m.profile?.display_name ?? "?").slice(0, 2).toUpperCase();
                  return (
                    <li key={m.user_id} className="flex items-center gap-2 px-3 py-2">
                      <Avatar className="h-7 w-7">
                        {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} />}
                        <AvatarFallback className="bg-aura-gradient text-[10px] text-primary-foreground">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate text-sm">
                        {m.profile?.display_name ?? "Unnamed"}
                      </span>
                      <Select
                        defaultValue="editor"
                        onValueChange={(r) =>
                          add.mutate({ user_id: m.user_id, role: r as FolderRole })
                        }
                      >
                        <SelectTrigger className="h-7 w-[110px] text-xs">
                          <SelectValue placeholder="Add as…" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {canManage && (
          <form onSubmit={submitInvite} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4 text-muted-foreground" /> Invite by email
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                required
                placeholder="person@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={role} onValueChange={(r) => setRole(r as FolderRole)}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={invite.isPending || !email.trim()}>
                {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
              </Button>
            </div>
          </form>
        )}

        {invites.length > 0 && (
          <div className="rounded-lg border border-border">
            <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pending invites ({invites.length})
            </div>
            <ul className="divide-y divide-border">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center gap-2 px-3 py-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{inv.email}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {inv.role}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/invite/${inv.token}`,
                      );
                      toast.success("Link copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {canManage && (
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
            Folder members ({members.length})
          </div>
          {members.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No explicit folder members yet. Workspace owners always have access.
            </p>
          ) : (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto">
              {members.map((m) => {
                const initials = (m.profile?.display_name ?? "?").slice(0, 2).toUpperCase();
                return (
                  <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                    <Avatar className="h-7 w-7">
                      {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} />}
                      <AvatarFallback className="bg-aura-gradient text-[10px] text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm">
                      {m.profile?.display_name ?? "Unnamed"}
                    </span>
                    {canManage ? (
                      <Select
                        value={m.role}
                        onValueChange={(r) => update.mutate({ id: m.id, role: r as FolderRole })}
                      >
                        <SelectTrigger className="h-7 w-[100px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        {m.role}
                      </Badge>
                    )}
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => remove.mutate(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
