import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSowDraft,
  draftSow,
  regenerateSowSection,
  updateSowSection,
  setSowStatus,
  type SowSectionKey,
} from "@/lib/sow.functions";
import { toast } from "sonner";

export type SowDraft = {
  id: string;
  workspace_id: string;
  deal_id: string;
  brief_id: string | null;
  version: number;
  status: "draft" | "internal_review" | "customer_review" | "approved" | "signed" | "superseded";
  title: string;
  client_name: string | null;
  executive_summary: string;
  strategy: string;
  positioning: string;
  value_proposition: string;
  scope: string;
  out_of_scope: string;
  technical_architecture: string;
  integrations_approach: string;
  terms_conditions: string;
  next_steps: string;
  deliverables: Array<{ name: string; description?: string; acceptance_criteria?: string }>;
  team_composition: Array<{ role: string; count?: number; allocation_pct?: number; rationale?: string }>;
  timeline: Array<{ phase: string; weeks?: number; milestones?: string[] }>;
  financials: {
    currency?: string;
    line_items?: Array<{ name: string; qty?: number; rate?: number; amount?: number }>;
    subtotal?: number;
    discount?: number;
    total?: number;
    payment_schedule?: Array<{ milestone: string; pct?: number; amount?: number }>;
    notes?: string;
  };
  assumptions: string[];
  risks: Array<{ risk: string; impact?: string; mitigation?: string }>;
  success_criteria: string[];
  section_meta: Record<string, { ai_generated_at?: string; last_instruction?: string | null }>;
  ai_generated_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useSowDraft(dealId: string | undefined) {
  const fn = useServerFn(getSowDraft);
  return useQuery({
    queryKey: ["sow", dealId],
    enabled: !!dealId,
    queryFn: async () => (await fn({ data: { deal_id: dealId! } })) as SowDraft | null,
  });
}

export function useDraftSow(dealId: string) {
  const fn = useServerFn(draftSow);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => fn({ data: { deal_id: dealId } }),
    onSuccess: (res) => {
      if (res && "ok" in res && !res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("SOW drafted");
      qc.invalidateQueries({ queryKey: ["sow", dealId] });
      qc.invalidateQueries({ queryKey: ["handover", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRegenerateSection(dealId: string) {
  const fn = useServerFn(regenerateSowSection);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sow_id: string; section: SowSectionKey; instruction?: string }) =>
      fn({ data: input }),
    onSuccess: (res) => {
      if (res && "ok" in res && !res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Section regenerated");
      qc.invalidateQueries({ queryKey: ["sow", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSection(dealId: string) {
  const fn = useServerFn(updateSowSection);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sow_id: string; patch: Record<string, unknown> }) =>
      fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sow", dealId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetSowStatus(dealId: string) {
  const fn = useServerFn(setSowStatus);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sow_id: string; status: SowDraft["status"] }) =>
      fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sow", dealId] });
      qc.invalidateQueries({ queryKey: ["handover", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
