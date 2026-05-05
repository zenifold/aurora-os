import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { Division, Folder, FolderType } from "@/lib/folder-types";

export function useDivisions() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["divisions", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divisions")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Division[];
    },
  });
}

export function useDivisionBySlug(slug: string | undefined) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["division", ws?.id, slug],
    enabled: !!ws && !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divisions")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data as Division | null;
    },
  });
}

export function useFolders(divisionId?: string) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["folders", ws?.id, divisionId],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("folders")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false)
        .order("sort_order");
      if (divisionId) q = q.eq("division_id", divisionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Folder[];
    },
  });
}

export function useFolder(folderId: string | undefined) {
  return useQuery({
    queryKey: ["folder", folderId],
    enabled: !!folderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("id", folderId!)
        .single();
      if (error) throw error;
      return data as Folder;
    },
  });
}

export function useCreateFolder() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      division_id: string;
      name: string;
      parent_id?: string | null;
      folder_type?: FolderType;
      client_email?: string;
      client_company?: string;
    }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("folders")
        .insert({
          workspace_id: ws.id,
          division_id: input.division_id,
          parent_id: input.parent_id ?? null,
          name: input.name,
          folder_type: input.folder_type ?? "generic",
          client_email: input.client_email ?? null,
          client_company: input.client_company ?? null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Folder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Folder> & { id: string }) => {
      const { error } = await supabase.from("folders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      qc.invalidateQueries({ queryKey: ["folder"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDivision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Division> & { id: string }) => {
      const { error } = await supabase.from("divisions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["divisions"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
