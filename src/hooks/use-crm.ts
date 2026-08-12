import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { Contact, Deal, DealActivity, DealStage } from "@/lib/crm-types";

// ----- Stages -----

export function useDealStages() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["deal_stages", ws?.id],
    enabled: !!ws,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_stages" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("order_index");
      if (error) throw error;
      const stages = (data ?? []) as unknown as DealStage[];
      // Auto-seed defaults if empty
      if (stages.length === 0 && ws) {
        await supabase.rpc("seed_default_deal_stages" as never, {
          _workspace_id: ws.id,
        } as never);
        const refetched = await supabase
          .from("deal_stages" as never)
          .select("*")
          .eq("workspace_id", ws.id)
          .order("order_index");
        return ((refetched.data ?? []) as unknown as DealStage[]);
      }
      return stages;
    },
  });
  return { ...query, refresh: () => qc.invalidateQueries({ queryKey: ["deal_stages", ws?.id] }) };
}

// ----- Deals -----

export function useDeals() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["deals", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as Deal[];
    },
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: ["deal", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals" as never)
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as Deal;
    },
  });
}

export function useCreateDeal() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Deal> & { title: string; stage_id: string }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("deals" as never)
        .insert({
          workspace_id: ws.id,
          created_by: user.id,
          owner_id: user.id,
          ...input,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Deal;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals", ws?.id] });
      toast.success("Deal created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDeal() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Deal> & { id: string }) => {
      const { error } = await supabase
        .from("deals" as never)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["deals", ws?.id] });
      const prev = qc.getQueryData<Deal[]>(["deals", ws?.id]);
      qc.setQueryData<Deal[]>(["deals", ws?.id], (old) =>
        (old ?? []).map((d) => (d.id === id ? ({ ...d, ...patch } as Deal) : d)),
      );
      const prevSingle = qc.getQueryData<Deal>(["deal", id]);
      if (prevSingle) {
        qc.setQueryData<Deal>(["deal", id], { ...prevSingle, ...patch } as Deal);
      }
      return { prev, prevSingle };
    },
    onError: (e: Error, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["deals", ws?.id], ctx.prev);
      if (ctx?.prevSingle) qc.setQueryData(["deal", vars.id], ctx.prevSingle);
      toast.error(e.message);
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["deals", ws?.id] });
      qc.invalidateQueries({ queryKey: ["deal", vars.id] });
    },
  });
}

export function useDeleteDeal() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["deals", ws?.id] });
      const prev = qc.getQueryData<Deal[]>(["deals", ws?.id]);
      const removed = prev?.find((d) => d.id === id);
      qc.setQueryData<Deal[]>(["deals", ws?.id], (old) => (old ?? []).filter((d) => d.id !== id));
      return { prev, removed };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["deals", ws?.id], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: (_data, _id, ctx) => {
      const removed = ctx?.removed;
      toast.success("Deal deleted", {
        action: removed
          ? {
              label: "Undo",
              onClick: async () => {
                const { id, created_at: _c, updated_at: _u, ...rest } = removed as Deal & {
                  created_at?: string;
                  updated_at?: string;
                };
                const { error } = await supabase
                  .from("deals" as never)
                  .insert({ id, ...rest } as never);
                if (error) {
                  toast.error("Couldn't restore deal");
                  return;
                }
                qc.invalidateQueries({ queryKey: ["deals", ws?.id] });
                toast.success("Deal restored");
              },
            }
          : undefined,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["deals", ws?.id] }),
  });
}

// ----- Contacts -----

export function useContacts() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["contacts", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Contact[];
    },
  });
}

export function useCreateContact() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Contact> & { name: string }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("contacts" as never)
        .insert({ workspace_id: ws.id, created_by: user.id, ...input } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Contact;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", ws?.id] });
      toast.success("Contact created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateContact() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Contact> & { id: string }) => {
      const { error } = await supabase
        .from("contacts" as never)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["contacts", ws?.id] });
      const prev = qc.getQueryData<Contact[]>(["contacts", ws?.id]);
      qc.setQueryData<Contact[]>(["contacts", ws?.id], (old) =>
        (old ?? []).map((c) => (c.id === id ? ({ ...c, ...patch } as Contact) : c)),
      );
      return { prev };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["contacts", ws?.id], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["contacts", ws?.id] }),
  });
}

export function useDeleteContact() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["contacts", ws?.id] });
      const prev = qc.getQueryData<Contact[]>(["contacts", ws?.id]);
      const removed = prev?.find((c) => c.id === id);
      qc.setQueryData<Contact[]>(["contacts", ws?.id], (old) => (old ?? []).filter((c) => c.id !== id));
      return { prev, removed };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["contacts", ws?.id], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: (_data, _id, ctx) => {
      const removed = ctx?.removed;
      toast.success("Contact deleted", {
        action: removed
          ? {
              label: "Undo",
              onClick: async () => {
                const { id, created_at: _c, updated_at: _u, ...rest } = removed as Contact & {
                  created_at?: string;
                  updated_at?: string;
                };
                const { error } = await supabase
                  .from("contacts" as never)
                  .insert({ id, ...rest } as never);
                if (error) {
                  toast.error("Couldn't restore contact");
                  return;
                }
                qc.invalidateQueries({ queryKey: ["contacts", ws?.id] });
                toast.success("Contact restored");
              },
            }
          : undefined,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["contacts", ws?.id] }),
  });
}

// ----- Activities -----

export function useDealActivities(dealId: string | undefined) {
  return useQuery({
    queryKey: ["deal_activities", dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_activities" as never)
        .select("*")
        .eq("deal_id", dealId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DealActivity[];
    },
  });
}

export function useAddDealActivity(dealId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { activity_type: DealActivity["activity_type"]; content: string; metadata?: Record<string, unknown> }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { error } = await supabase.from("deal_activities" as never).insert({
        workspace_id: ws.id,
        deal_id: dealId,
        author_id: user.id,
        activity_type: input.activity_type,
        content: input.content,
        metadata: input.metadata ?? {},
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal_activities", dealId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
