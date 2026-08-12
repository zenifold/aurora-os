import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listScopeChecklist,
  generateScopeChecklist,
  upsertScopeItem,
  deleteScopeItem,
  applyChecklistToSow,
} from "@/lib/scope-checklist.functions";
import { toast } from "sonner";

export type ScopeItem = {
  id: string;
  workspace_id: string;
  deal_id: string;
  brief_id: string | null;
  sow_id: string | null;
  area: string;
  requirement: string;
  details: string | null;
  priority: "must_have" | "should_have" | "nice_to_have";
  status: "in_scope" | "out_of_scope" | "needs_clarification" | "deferred" | "done";
  confidence: number | null;
  source_document_id: string | null;
  source_snippet: string | null;
  ai_generated: boolean;
  applied_to_sow_at: string | null;
  position: number;
  created_at: string;
};

export function useScopeChecklist(dealId: string | undefined) {
  const fn = useServerFn(listScopeChecklist);
  return useQuery({
    queryKey: ["scope-checklist", dealId],
    enabled: !!dealId,
    queryFn: async () => (await fn({ data: { deal_id: dealId! } })) as ScopeItem[],
  });
}

export function useGenerateChecklist(dealId: string) {
  const fn = useServerFn(generateScopeChecklist);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (replace: boolean) => fn({ data: { deal_id: dealId, replace } }),
    onSuccess: (res) => {
      const r = res as { ok?: boolean; error?: string; count?: number };
      if (r?.ok === false) {
        toast.error(r.error ?? "Failed");
        return;
      }
      toast.success(`Generated ${r?.count ?? 0} checklist items`);
      qc.invalidateQueries({ queryKey: ["scope-checklist", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

type UpsertInput = {
  id?: string;
  deal_id: string;
  patch: Partial<Pick<ScopeItem, "area" | "requirement" | "details" | "priority" | "status" | "position">>;
};

export function useUpsertScopeItem(dealId: string) {
  const fn = useServerFn(upsertScopeItem);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertInput) => fn({ data: input as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scope-checklist", dealId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteScopeItem(dealId: string) {
  const fn = useServerFn(deleteScopeItem);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scope-checklist", dealId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApplyChecklistToSow(dealId: string) {
  const fn = useServerFn(applyChecklistToSow);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => fn({ data: { deal_id: dealId } }),
    onSuccess: (res) => {
      const r = res as { ok?: boolean; error?: string; applied?: number; added_deliverables?: number };
      if (r?.ok === false) {
        toast.error(r.error ?? "Failed");
        return;
      }
      toast.success(`Applied ${r?.applied ?? 0} items, +${r?.added_deliverables ?? 0} deliverables`);
      qc.invalidateQueries({ queryKey: ["sow-drafts", dealId] });
      qc.invalidateQueries({ queryKey: ["scope-checklist", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
