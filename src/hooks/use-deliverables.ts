import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listDeliverables,
  getDeliverable,
  createDeliverable,
  updateDeliverableSection,
  setDeliverableStatus,
  forkVersion,
  restoreVersion,
  deleteDeliverable,
  listComments,
  addComment,
  resolveComment,
  listAgentRuns,
  createShareLink,
  revokeShareLink,
  generateDeliverable,
  regenerateDeliverableSection,
} from "@/lib/deliverables.functions";

export type DeliverableRow = {
  id: string;
  kind: string;
  kind_label: string;
  kind_icon: string;
  title: string;
  status: string;
  current_version_id: string | null;
  template_id: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  current_version: number | null;
  ai_generated_at: string | null;
};

export function useDeliverables(dealId: string | undefined) {
  const fn = useServerFn(listDeliverables);
  return useQuery({
    queryKey: ["deliverables", dealId],
    enabled: !!dealId,
    queryFn: async () => (await fn({ data: { deal_id: dealId! } })) as DeliverableRow[],
  });
}

export function useDeliverable(deliverableId: string | undefined, versionId?: string) {
  const fn = useServerFn(getDeliverable);
  return useQuery({
    queryKey: ["deliverable", deliverableId, versionId ?? "current"],
    enabled: !!deliverableId,
    queryFn: async () =>
      await fn({ data: { deliverable_id: deliverableId!, version_id: versionId } }),
  });
}

export function useCreateDeliverable(dealId: string) {
  const fn = useServerFn(createDeliverable);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { kind: string; title?: string; template_id?: string | null }) =>
      fn({ data: { deal_id: dealId, ...input } }),
    onSuccess: () => {
      toast.success("Deliverable created");
      qc.invalidateQueries({ queryKey: ["deliverables", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDeliverableSection() {
  const fn = useServerFn(updateDeliverableSection);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { version_id: string; section_key: string; content: unknown }) =>
      fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deliverable"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetDeliverableStatus(dealId: string) {
  const fn = useServerFn(setDeliverableStatus);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { deliverable_id: string; status: string }) =>
      fn({ data: input as never }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliverables", dealId] });
      qc.invalidateQueries({ queryKey: ["deliverable"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useForkVersion() {
  const fn = useServerFn(forkVersion);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { version_id: string; label?: string }) => fn({ data: input }),
    onSuccess: () => {
      toast.success("New draft version created");
      qc.invalidateQueries({ queryKey: ["deliverable"] });
      qc.invalidateQueries({ queryKey: ["deliverables"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRestoreVersion() {
  const fn = useServerFn(restoreVersion);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (version_id: string) => fn({ data: { version_id } }),
    onSuccess: () => {
      toast.success("Version restored as new draft");
      qc.invalidateQueries({ queryKey: ["deliverable"] });
      qc.invalidateQueries({ queryKey: ["deliverables"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDeliverable(dealId: string) {
  const fn = useServerFn(deleteDeliverable);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deliverable_id: string) => fn({ data: { deliverable_id } }),
    onSuccess: () => {
      toast.success("Deliverable removed");
      qc.invalidateQueries({ queryKey: ["deliverables", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeliverableComments(deliverableId: string | undefined, sectionKey?: string) {
  const fn = useServerFn(listComments);
  return useQuery({
    queryKey: ["deliverable-comments", deliverableId, sectionKey ?? "all"],
    enabled: !!deliverableId,
    queryFn: async () =>
      (await fn({ data: { deliverable_id: deliverableId!, section_key: sectionKey } })) as Array<{
        id: string;
        body: string;
        section_key: string | null;
        author_id: string;
        author_kind: string;
        resolved: boolean;
        parent_id: string | null;
        created_at: string;
      }>,
  });
}

export function useAddDeliverableComment(deliverableId: string) {
  const fn = useServerFn(addComment);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      version_id?: string;
      section_key?: string;
      body: string;
      parent_id?: string;
    }) => fn({ data: { deliverable_id: deliverableId, ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deliverable-comments", deliverableId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResolveComment(deliverableId: string) {
  const fn = useServerFn(resolveComment);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { comment_id: string; resolved: boolean }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deliverable-comments", deliverableId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAgentRuns(deliverableId: string | undefined) {
  const fn = useServerFn(listAgentRuns);
  return useQuery({
    queryKey: ["deliverable-runs", deliverableId],
    enabled: !!deliverableId,
    queryFn: async () =>
      (await fn({ data: { deliverable_id: deliverableId! } })) as Array<{
        id: string;
        section_key: string | null;
        model: string | null;
        status: string;
        error: string | null;
        input_tokens: number | null;
        output_tokens: number | null;
        started_at: string | null;
        finished_at: string | null;
        created_at: string;
      }>,
  });
}

export function useCreateShareLink(deliverableId: string) {
  const fn = useServerFn(createShareLink);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      version_id?: string;
      access?: "read" | "comment";
      recipient_email?: string;
      expires_in_days?: number;
    }) => fn({ data: { deliverable_id: deliverableId, ...input } }),
    onSuccess: () => {
      toast.success("Share link created");
      qc.invalidateQueries({ queryKey: ["deliverable-share-links", deliverableId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRevokeShareLink() {
  const fn = useServerFn(revokeShareLink);
  return useMutation({
    mutationFn: async (link_id: string) => fn({ data: { link_id } }),
    onSuccess: () => toast.success("Link revoked"),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGenerateDeliverable(deliverableId: string) {
  const fn = useServerFn(generateDeliverable);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { instruction?: string; model?: string } = {}) =>
      fn({ data: { deliverable_id: deliverableId, ...input } }),
    onSuccess: (res) => {
      const ok = (res as { ok?: boolean }).ok;
      if (ok === false) {
        toast.error((res as { error?: string }).error ?? "AI generation failed");
        return;
      }
      toast.success("New AI draft created");
      qc.invalidateQueries({ queryKey: ["deliverable", deliverableId] });
      qc.invalidateQueries({ queryKey: ["deliverables"] });
      qc.invalidateQueries({ queryKey: ["deliverable-runs", deliverableId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRegenerateDeliverableSection(deliverableId: string) {
  const fn = useServerFn(regenerateDeliverableSection);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { version_id: string; section_key: string; instruction?: string }) =>
      fn({ data: input }),
    onSuccess: (res) => {
      const ok = (res as { ok?: boolean }).ok;
      if (ok === false) {
        toast.error((res as { error?: string }).error ?? "Regeneration failed");
        return;
      }
      toast.success("Section regenerated");
      qc.invalidateQueries({ queryKey: ["deliverable", deliverableId] });
      qc.invalidateQueries({ queryKey: ["deliverable-runs", deliverableId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
