import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useIsWorkspaceOwner } from "@/hooks/use-workspace-role";
import { toast } from "sonner";

export type FolderRole = "viewer" | "editor" | "owner";

export interface FolderMember {
  id: string;
  workspace_id: string;
  folder_id: string;
  user_id: string;
  role: FolderRole;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null } | null;
}

export interface FolderInvitation {
  id: string;
  workspace_id: string;
  folder_id: string;
  email: string;
  role: FolderRole;
  token: string;
  status: string;
  expires_at: string;
}

const RANK: Record<FolderRole, number> = { viewer: 0, editor: 1, owner: 2 };

/**
 * Returns the effective role the current user has on a folder, walking ancestors.
 * Workspace owners get implicit "owner". Returns null if no access at all.
 */
export function useFolderRole(folderId: string | undefined) {
  const { user } = useAuth();
  const isWsOwner = useIsWorkspaceOwner();
  return useQuery({
    queryKey: ["folder-role", folderId, user?.id, isWsOwner],
    enabled: !!folderId && !!user,
    queryFn: async (): Promise<FolderRole | null> => {
      if (isWsOwner) return "owner";
      // walk ancestors
      let cur: string | null = folderId!;
      while (cur) {
        const curId: string = cur;
        const [memRes, folRes] = await Promise.all([
          supabase
            .from("folder_members")
            .select("role")
            .eq("folder_id", curId)
            .eq("user_id", user!.id)
            .maybeSingle(),
          supabase.from("folders").select("parent_id").eq("id", curId).maybeSingle(),
        ]);
        if (memRes.data?.role) return memRes.data.role as FolderRole;
        cur = (folRes.data?.parent_id as string | null) ?? null;
      }
      return null;
    },
  });
}

export function canFolderEdit(role: FolderRole | null | undefined) {
  return !!role && RANK[role] >= RANK.editor;
}
export function canFolderManage(role: FolderRole | null | undefined) {
  return !!role && RANK[role] >= RANK.owner;
}

export function useFolderMembers(folderId: string | undefined) {
  return useQuery({
    queryKey: ["folder-members", folderId],
    enabled: !!folderId,
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from("folder_members")
        .select("*")
        .eq("folder_id", folderId!);
      if (error) throw error;
      const ids = (members ?? []).map((m) => m.user_id);
      let profMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", ids);
        profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      }
      return (members ?? []).map((m) => ({
        ...m,
        profile: profMap.get(m.user_id) ?? null,
      })) as FolderMember[];
    },
  });
}

export function useFolderInvitations(folderId: string | undefined) {
  return useQuery({
    queryKey: ["folder-invitations", folderId],
    enabled: !!folderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folder_invitations")
        .select("*")
        .eq("folder_id", folderId!)
        .eq("status", "pending");
      if (error) throw error;
      return (data ?? []) as FolderInvitation[];
    },
  });
}

export function useAddFolderMember(folderId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: FolderRole }) => {
      if (!ws) throw new Error("No workspace");
      const { error } = await supabase
        .from("folder_members")
        .upsert(
          { folder_id: folderId, workspace_id: ws.id, user_id, role },
          { onConflict: "folder_id,user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folder-members", folderId] });
      toast.success("Member added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateFolderMember(folderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: FolderRole }) => {
      const { error } = await supabase.from("folder_members").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folder-members", folderId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveFolderMember(folderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folder_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folder-members", folderId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useInviteToFolder(folderId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: FolderRole }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("folder_invitations")
        .insert({
          folder_id: folderId,
          workspace_id: ws.id,
          email: email.toLowerCase().trim(),
          role,
          invited_by: user.id,
        })
        .select("token")
        .single();
      if (error) throw error;
      return data.token as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folder-invitations", folderId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRevokeFolderInvite(folderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folder_invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folder-invitations", folderId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
