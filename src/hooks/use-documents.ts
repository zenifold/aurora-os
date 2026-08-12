import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listDocumentTemplates,
  listClientDocuments,
  createDocumentFromTemplate,
  setDocumentStatus,
  saveDocumentAsTemplate,
  generateClientDocument,
  listBrandKits,
  upsertBrandKit,
  deleteBrandKit,
} from "@/lib/document-templates.functions";
import type { BrandKit, ClientDocument, DocKind, DocStatus } from "@/lib/document-types";

export function useDocumentTemplates(workspaceId: string | undefined, kind?: DocKind) {
  const fn = useServerFn(listDocumentTemplates);
  return useQuery({
    queryKey: ["document-templates", workspaceId, kind ?? "all"],
    enabled: !!workspaceId,
    queryFn: async () => (await fn({ data: { workspace_id: workspaceId!, doc_kind: kind } })) as Array<{ id: string; title: string; icon: string | null; doc_kind: DocKind | null; updated_at: string }>,
  });
}

export function useClientDocuments(clientAccountId: string | undefined) {
  const fn = useServerFn(listClientDocuments);
  return useQuery({
    queryKey: ["client-documents", clientAccountId],
    enabled: !!clientAccountId,
    queryFn: async () =>
      (await fn({ data: { client_account_id: clientAccountId! } })) as ClientDocument[],
  });
}

export function useCreateDocumentFromTemplate(clientAccountId?: string) {
  const fn = useServerFn(createDocumentFromTemplate);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workspace_id: string;
      template_id?: string | null;
      doc_kind?: DocKind;
      client_account_id?: string | null;
      title: string;
      brand_kit_id?: string | null;
    }) => fn({ data: input }),
    onSuccess: () => {
      toast.success("Document created");
      qc.invalidateQueries({ queryKey: ["client-documents", clientAccountId] });
      qc.invalidateQueries({ queryKey: ["pages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetDocumentStatus(clientAccountId?: string) {
  const fn = useServerFn(setDocumentStatus);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { page_id: string; doc_status: DocStatus }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-documents", clientAccountId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveDocumentAsTemplate(workspaceId: string | undefined) {
  const fn = useServerFn(saveDocumentAsTemplate);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { page_id: string; title: string; doc_kind: DocKind }) =>
      fn({ data: input }),
    onSuccess: () => {
      toast.success("Saved as template");
      qc.invalidateQueries({ queryKey: ["document-templates", workspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGenerateClientDocument(clientAccountId?: string) {
  const fn = useServerFn(generateClientDocument);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workspace_id: string;
      client_account_id?: string | null;
      doc_kind: DocKind;
      title: string;
      prompt: string;
      template_id?: string | null;
      brand_kit_id?: string | null;
    }) => fn({ data: input }),
    onSuccess: (res) => {
      const r = res as { ok?: boolean; error?: string };
      if (r.ok === false) {
        toast.error(r.error ?? "AI generation failed");
        return;
      }
      toast.success("Document drafted by AI");
      qc.invalidateQueries({ queryKey: ["client-documents", clientAccountId] });
      qc.invalidateQueries({ queryKey: ["pages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBrandKits(workspaceId: string | undefined, clientAccountId?: string | null) {
  const fn = useServerFn(listBrandKits);
  return useQuery({
    queryKey: ["brand-kits", workspaceId, clientAccountId ?? "all"],
    enabled: !!workspaceId,
    queryFn: async () =>
      (await fn({
        data: { workspace_id: workspaceId!, client_account_id: clientAccountId ?? undefined },
      })) as BrandKit[],
  });
}

export function useUpsertBrandKit(workspaceId: string | undefined) {
  const fn = useServerFn(upsertBrandKit);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string | null;
      workspace_id: string;
      client_account_id?: string | null;
      name: string;
      logo_url?: string | null;
      cover_url?: string | null;
      primary_color: string;
      accent_color: string;
      text_color: string;
      font_heading: string;
      font_body: string;
      footer_text?: string | null;
      is_default?: boolean;
    }) => fn({ data: input }),
    onSuccess: () => {
      toast.success("Brand kit saved");
      qc.invalidateQueries({ queryKey: ["brand-kits", workspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBrandKit(workspaceId: string | undefined) {
  const fn = useServerFn(deleteBrandKit);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      toast.success("Brand kit deleted");
      qc.invalidateQueries({ queryKey: ["brand-kits", workspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
