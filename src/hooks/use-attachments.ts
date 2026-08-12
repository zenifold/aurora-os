import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export type AttachmentEntityType =
  | "task"
  | "comment"
  | "meeting"
  | "note"
  | "page"
  | "project";

export interface Attachment {
  id: string;
  workspace_id: string;
  entity_type: AttachmentEntityType;
  entity_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

const MAX_BYTES = 25 * 1024 * 1024;

export function useAttachments(entityType: AttachmentEntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: ["attachments", entityType, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments" as never)
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Attachment[];
    },
  });
}

export function useUploadAttachment() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      entity_type: AttachmentEntityType;
      entity_id: string;
      file: File;
    }) => {
      if (!ws || !user) throw new Error("Not signed in");
      if (input.file.size > MAX_BYTES) {
        throw new Error("File exceeds 25MB limit");
      }
      const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
      const path = `${ws.id}/${input.entity_type}/${input.entity_id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("attachments")
        .upload(path, input.file, {
          contentType: input.file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("attachments" as never).insert({
        workspace_id: ws.id,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        storage_path: path,
        file_name: input.file.name,
        file_size: input.file.size,
        mime_type: input.file.type || null,
        uploaded_by: user.id,
      } as never);
      if (insErr) {
        await supabase.storage.from("attachments").remove([path]);
        throw insErr;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["attachments", vars.entity_type, vars.entity_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (att: Attachment) => {
      await supabase.storage.from("attachments").remove([att.storage_path]);
      const { error } = await supabase
        .from("attachments" as never)
        .delete()
        .eq("id", att.id);
      if (error) throw error;
      return att;
    },
    onSuccess: (att) => {
      qc.invalidateQueries({ queryKey: ["attachments", att.entity_type, att.entity_id] });
      toast.success("Attachment deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export async function getAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(path, 60 * 5);
  if (error || !data) throw error ?? new Error("Failed to sign URL");
  return data.signedUrl;
}
