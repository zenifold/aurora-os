import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";

export interface RateCard {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  currency: string;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface RateCardEntry {
  id: string;
  rate_card_id: string;
  workspace_id: string;
  role_name: string | null;
  user_id: string | null;
  bill_rate: number;
  cost_rate: number;
  notes: string | null;
}

export function useRateCards() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["rate_cards", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rate_cards" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as RateCard[];
    },
  });
}

export function useRateCardEntries(rateCardId: string | undefined) {
  return useQuery({
    queryKey: ["rate_card_entries", rateCardId],
    enabled: !!rateCardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rate_card_entries" as never)
        .select("*")
        .eq("rate_card_id", rateCardId!)
        .order("role_name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as RateCardEntry[];
    },
  });
}

export function useUpsertRateCard() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RateCard> & { name: string }) => {
      if (!ws) throw new Error("No workspace");
      const payload = { workspace_id: ws.id, ...input };
      const { data, error } = await supabase
        .from("rate_cards" as never)
        .upsert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RateCard;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rate_cards", ws?.id] });
      toast.success("Rate card saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRateCard() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rate_cards" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rate_cards", ws?.id] });
      toast.success("Rate card deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpsertRateCardEntry() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RateCardEntry> & { rate_card_id: string }) => {
      if (!ws) throw new Error("No workspace");
      const payload = { workspace_id: ws.id, ...input };
      const { data, error } = await supabase
        .from("rate_card_entries" as never)
        .upsert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RateCardEntry;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["rate_card_entries", vars.rate_card_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRateCardEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; rate_card_id: string }) => {
      const { error } = await supabase.from("rate_card_entries" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["rate_card_entries", vars.rate_card_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
