import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSalesDocuments,
  createSalesDocUploadUrl,
  registerSalesDocument,
  deleteSalesDocument,
  scanSalesDocument,
  getSalesDocDownloadUrl,
  listDocumentScans,
} from "@/lib/sales-documents.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DocumentScan = {
  id: string;
  document_id: string;
  version: number;
  ai_summary: string;
  ai_extracted: Record<string, unknown>;
  confidence: Record<string, number>;
  overall_confidence: number | null;
  diff: Record<string, { before: unknown; after: unknown; change: "added" | "removed" | "changed" }>;
  model: string;
  scanned_by: string | null;
  created_at: string;
};

export type SalesDocument = {
  id: string;
  workspace_id: string;
  deal_id: string;
  name: string;
  description: string | null;
  document_type:
    | "rfp"
    | "spec"
    | "transcript"
    | "deck"
    | "email"
    | "contract"
    | "wireframe"
    | "reference"
    | "screenshot"
    | "requirements"
    | "other";
  source: "upload" | "email" | "link" | "meeting" | "manual_note";
  storage_path: string | null;
  external_url: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  raw_text: string | null;
  ai_summary: string | null;
  ai_extracted: Record<string, unknown>;
  ai_scanned_at: string | null;
  created_at: string;
};

export function useSalesDocuments(dealId: string | undefined) {
  const fn = useServerFn(listSalesDocuments);
  return useQuery({
    queryKey: ["sales-documents", dealId],
    enabled: !!dealId,
    queryFn: async () => (await fn({ data: { deal_id: dealId! } })) as SalesDocument[],
  });
}

export function useUploadSalesDocument(dealId: string) {
  const signFn = useServerFn(createSalesDocUploadUrl);
  const registerFn = useServerFn(registerSalesDocument);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      file: File;
      document_type: SalesDocument["document_type"];
      description?: string;
      raw_text?: string;
    }) => {
      const { path, token } = await signFn({
        data: { deal_id: dealId, file_name: input.file.name },
      });
      const { error } = await supabase.storage
        .from("sales-documents")
        .uploadToSignedUrl(path, token, input.file);
      if (error) throw new Error(error.message);
      return registerFn({
        data: {
          deal_id: dealId,
          name: input.file.name,
          document_type: input.document_type,
          source: "upload",
          storage_path: path,
          file_size_bytes: input.file.size,
          mime_type: input.file.type || null,
          description: input.description ?? null,
          raw_text: input.raw_text ?? null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      qc.invalidateQueries({ queryKey: ["sales-documents", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddSalesNote(dealId: string) {
  const registerFn = useServerFn(registerSalesDocument);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      raw_text: string;
      document_type: SalesDocument["document_type"];
    }) =>
      registerFn({
        data: {
          deal_id: dealId,
          name: input.name,
          document_type: input.document_type,
          source: "manual_note",
          raw_text: input.raw_text,
        },
      }),
    onSuccess: () => {
      toast.success("Note added");
      qc.invalidateQueries({ queryKey: ["sales-documents", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSalesDocument(dealId: string) {
  const fn = useServerFn(deleteSalesDocument);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales-documents", dealId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useScanSalesDocument(dealId: string) {
  const fn = useServerFn(scanSalesDocument);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fn({ data: { id } }),
    onSuccess: (res: unknown) => {
      const r = res as { ok?: boolean; error?: string } | null;
      if (r && r.ok === false) {
        toast.error(r.error ?? "Scan failed");
        return;
      }
      toast.success("Document scanned");
      qc.invalidateQueries({ queryKey: ["sales-documents", dealId] });
      qc.invalidateQueries({ queryKey: ["doc-scans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDownloadSalesDoc() {
  const fn = useServerFn(getSalesDocDownloadUrl);
  return useMutation({
    mutationFn: async (id: string) => {
      const { url } = await fn({ data: { id } });
      if (url) window.open(url, "_blank");
      return url;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDocumentScans(documentId: string | undefined) {
  const fn = useServerFn(listDocumentScans);
  return useQuery({
    queryKey: ["doc-scans", documentId],
    enabled: !!documentId,
    queryFn: async () => (await fn({ data: { document_id: documentId! } })) as DocumentScan[],
  });
}
