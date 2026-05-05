import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type {
  Resource,
  ResourceAllocation,
  ResourceUnavailability,
  ProjectDocument,
} from "@/lib/resource-types";

// ===== Resources =====

export function useResources() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["resources", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Resource[];
    },
  });
}

export function useUpsertResource() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Resource> & { name: string; id?: string }) => {
      if (!ws || !user) throw new Error("No workspace");
      if (input.id) {
        const { id, ...patch } = input;
        const { error } = await supabase
          .from("resources" as never)
          .update(patch as never)
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("resources" as never)
        .insert({ workspace_id: ws.id, created_by: user.id, ...input } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources", ws?.id] });
      toast.success("Resource saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteResource() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resources" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources", ws?.id] });
      toast.success("Resource removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ===== Allocations =====

export function useAllocations(opts: { projectId?: string; from?: string; to?: string } = {}) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["allocations", ws?.id, opts],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("resource_allocations" as never)
        .select("*")
        .eq("workspace_id", ws!.id);
      if (opts.projectId) q = q.eq("project_id", opts.projectId);
      if (opts.from) q = q.or(`end_date.is.null,end_date.gte.${opts.from}`);
      if (opts.to) q = q.lte("start_date", opts.to);
      const { data, error } = await q.order("start_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ResourceAllocation[];
    },
  });
}

export function useUpsertAllocation() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<ResourceAllocation> & {
        project_id: string;
        start_date: string;
        id?: string;
      },
    ) => {
      if (!ws || !user) throw new Error("No workspace");
      if (input.id) {
        const { id, ...patch } = input;
        const { error } = await supabase
          .from("resource_allocations" as never)
          .update(patch as never)
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("resource_allocations" as never)
        .insert({ workspace_id: ws.id, created_by: user.id, ...input } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allocations", ws?.id] });
      toast.success("Allocation saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAllocation() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("resource_allocations" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["allocations", ws?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ===== Unavailability =====

export function useUnavailability(opts: { from?: string; to?: string } = {}) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["unavailability", ws?.id, opts],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("resource_unavailability" as never)
        .select("*")
        .eq("workspace_id", ws!.id);
      if (opts.from) q = q.gte("end_date", opts.from);
      if (opts.to) q = q.lte("start_date", opts.to);
      const { data, error } = await q.order("start_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ResourceUnavailability[];
    },
  });
}

export function useCreateUnavailability() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<ResourceUnavailability> & { start_date: string; end_date: string },
    ) => {
      if (!ws) throw new Error("No workspace");
      const { error } = await supabase
        .from("resource_unavailability" as never)
        .insert({ workspace_id: ws.id, ...input } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unavailability", ws?.id] });
      toast.success("Time off recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteUnavailability() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("resource_unavailability" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unavailability", ws?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ===== Documents =====

export function useProjectDocuments(projectId?: string) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["project_documents", ws?.id, projectId],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("project_documents" as never)
        .select("*")
        .eq("workspace_id", ws!.id);
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectDocument[];
    },
  });
}

export function useUploadDocument() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      file: File;
      project_id?: string | null;
      name?: string;
      document_type?: ProjectDocument["document_type"];
      contract_value?: number | null;
      effective_date?: string | null;
      expiration_date?: string | null;
    }) => {
      if (!ws || !user) throw new Error("No workspace");
      const docId = crypto.randomUUID();
      const folder = input.project_id ?? "_workspace";
      const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${ws.id}/${folder}/${docId}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("project-documents")
        .upload(path, input.file, { contentType: input.file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("project_documents" as never).insert({
        id: docId,
        workspace_id: ws.id,
        project_id: input.project_id ?? null,
        name: input.name?.trim() || input.file.name,
        document_type: input.document_type ?? "other",
        file_path: path,
        file_size_bytes: input.file.size,
        mime_type: input.file.type,
        contract_value: input.contract_value ?? null,
        effective_date: input.effective_date ?? null,
        expiration_date: input.expiration_date ?? null,
        uploaded_by: user.id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_documents", ws?.id] });
      toast.success("Document uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDocument() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: ProjectDocument) => {
      await supabase.storage.from("project-documents").remove([doc.file_path]);
      const { error } = await supabase
        .from("project_documents" as never)
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_documents", ws?.id] });
      toast.success("Document deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export async function getDocumentSignedUrl(filePath: string) {
  const { data, error } = await supabase.storage
    .from("project-documents")
    .createSignedUrl(filePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
