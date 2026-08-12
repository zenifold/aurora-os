import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import { generateProposal, convertProposalToProject } from "@/lib/proposals.functions";

export interface Proposal {
  id: string;
  workspace_id: string;
  deal_id: string | null;
  title: string;
  summary: string | null;
  scope: string | null;
  deliverables: { name: string; description?: string }[];
  milestones: { name: string; target_offset_days: number; description?: string }[];
  pricing: { line_items?: { name: string; amount: number }[]; notes?: string };
  currency: string;
  total_value: number | null;
  status: "draft" | "sent" | "accepted" | "rejected" | "converted";
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  converted_at: string | null;
  converted_project_id: string | null;
  generated_by_ai: boolean;
  ai_prompt: string | null;
  ai_model: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useProposals() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["proposals", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Proposal[];
    },
  });
}

export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: ["proposal", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals" as never)
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as Proposal;
    },
  });
}

export function useGenerateProposal() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  const fn = useServerFn(generateProposal);
  return useMutation({
    mutationFn: async (input: { prompt: string; dealId?: string }) => {
      if (!ws) throw new Error("No workspace");
      return fn({ data: { workspaceId: ws.id, prompt: input.prompt, dealId: input.dealId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals", ws?.id] });
      toast.success("Proposal drafted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateProposal() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Proposal> & { id: string }) => {
      const { id, ...rest } = input;
      const { data, error } = await supabase
        .from("proposals" as never)
        .update(rest as never)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Proposal;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals", ws?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteProposal() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proposals" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals", ws?.id] });
      toast.success("Proposal deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useConvertProposal() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  const fn = useServerFn(convertProposalToProject);
  return useMutation({
    mutationFn: async (input: { proposalId: string; startDate?: string }) => {
      return fn({ data: input });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["proposals", ws?.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      if (res.alreadyConverted) {
        toast.info("Proposal was already converted");
      } else {
        toast.success("Project created from proposal");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
