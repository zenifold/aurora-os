import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ensureHandover,
  getHandover,
  advanceHandoverStage,
  draftDiscoveryBrief,
  updateDiscoveryBrief,
  approveDiscoveryBrief,
  type HandoverStage,
} from "@/lib/handover.functions";
import { toast } from "sonner";

export type BriefCitation = { document_id: string; snippet: string; section: string | null };

export type DiscoveryBrief = {
  id: string;
  workspace_id: string;
  deal_id: string;
  version: number;
  status: "draft" | "approved";
  business_goals: string | null;
  target_users: string | null;
  scope_summary: string | null;
  constraints: string | null;
  tech_preferences: string | null;
  success_metrics: string | null;
  unknowns: string[];
  citations: Record<string, BriefCitation[]>;
  source_document_ids?: string[];
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EngagementHandover = {
  id: string;
  workspace_id: string;
  deal_id: string;
  project_id: string | null;
  stage: HandoverStage;
  pending_approver_role: string | null;
  gate_history: Array<{
    from: HandoverStage;
    to: HandoverStage;
    at: string;
    by: string | null;
    note: string | null;
  }>;
  created_at: string;
  updated_at: string;
};

export function useHandover(dealId: string | undefined) {
  const fn = useServerFn(getHandover);
  return useQuery({
    queryKey: ["handover", dealId],
    enabled: !!dealId,
    queryFn: async () =>
      (await fn({ data: { deal_id: dealId! } })) as {
        handover: EngagementHandover | null;
        brief: DiscoveryBrief | null;
      } | null,
  });
}

export function useEnsureHandover() {
  const fn = useServerFn(ensureHandover);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deal_id: string) => fn({ data: { deal_id } }),
    onSuccess: (_d, deal_id) => qc.invalidateQueries({ queryKey: ["handover", deal_id] }),
  });
}

export function useDraftBrief(dealId: string) {
  const fn = useServerFn(draftDiscoveryBrief);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (extra_context?: string) =>
      fn({ data: { deal_id: dealId, extra_context } }),
    onSuccess: (res) => {
      if (res && "ok" in res && !res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Brief drafted");
      qc.invalidateQueries({ queryKey: ["handover", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBrief(dealId: string) {
  const fn = useServerFn(updateDiscoveryBrief);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Partial<Omit<DiscoveryBrief, "id" | "workspace_id" | "deal_id" | "version" | "status" | "approved_by" | "approved_at" | "created_at" | "updated_at">>;
    }) => fn({ data: input as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["handover", dealId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveBrief(dealId: string) {
  const fn = useServerFn(approveDiscoveryBrief);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (brief_id: string) => fn({ data: { brief_id } }),
    onSuccess: (res) => {
      const r = res as { checklist?: { ok: boolean; count?: number; error?: string } | null };
      if (r?.checklist?.ok && (r.checklist.count ?? 0) > 0) {
        toast.success(`Brief approved — drafted ${r.checklist.count} scope items`);
      } else if (r?.checklist && !r.checklist.ok) {
        toast.success("Brief approved — moving to SOW draft");
        toast.warning(`Auto-checklist skipped: ${r.checklist.error}`);
      } else {
        toast.success("Brief approved — moving to SOW draft");
      }
      qc.invalidateQueries({ queryKey: ["handover", dealId] });
      qc.invalidateQueries({ queryKey: ["scope-checklist", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAdvanceStage(dealId: string) {
  const fn = useServerFn(advanceHandoverStage);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      to_stage: HandoverStage;
      note?: string;
      pending_approver_role?: string | null;
    }) => fn({ data: { deal_id: dealId, ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["handover", dealId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
