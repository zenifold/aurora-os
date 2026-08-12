import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DealContactRow = {
  id: string;
  deal_id: string;
  contact_id: string;
  role: string;
  is_primary: boolean;
  contact: { id: string; name: string; email: string | null; title: string | null; company: string | null } | null;
};

export function useDealContacts(dealId: string | null) {
  return useQuery({
    queryKey: ["deal-contacts", dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_contacts")
        .select("id, deal_id, contact_id, role, is_primary, contact:contacts(id, name, email, title, company)")
        .eq("deal_id", dealId!)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DealContactRow[];
    },
  });
}

export function useAddDealContact(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { contact_id: string; role: string; is_primary?: boolean }) => {
      const { error } = await supabase.from("deal_contacts").insert({
        deal_id: dealId,
        contact_id: input.contact_id,
        role: input.role,
        is_primary: input.is_primary ?? false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-contacts", dealId] });
      toast.success("Stakeholder added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDealContact(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; role?: string; is_primary?: boolean }) => {
      const patch: { role?: string; is_primary?: boolean } = {};
      if (input.role !== undefined) patch.role = input.role;
      if (input.is_primary !== undefined) patch.is_primary = input.is_primary;
      const { error } = await supabase.from("deal_contacts").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-contacts", dealId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveDealContact(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deal_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-contacts", dealId] });
      toast.success("Stakeholder removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
