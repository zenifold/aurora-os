import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import type {
  Invoice,
  InvoiceLineItem,
  Expense,
  InvoiceStatus,
} from "@/lib/invoice-types";
import { computeInvoiceTotals } from "@/lib/invoice-types";

// ----- Invoices -----

export function useInvoices(params: { project_id?: string; status?: InvoiceStatus } = {}) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["invoices", ws?.id, params.project_id ?? "all", params.status ?? "all"],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("invoices" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("issue_date", { ascending: false });
      if (params.project_id) q = q.eq("project_id", params.project_id);
      if (params.status) q = q.eq("status", params.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Invoice[];
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoice", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices" as never)
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as Invoice;
    },
  });
}

export function useInvoiceLineItems(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice_line_items", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_line_items" as never)
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceLineItem[];
    },
  });
}

export function useCreateInvoice() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      currency?: string;
      client_name?: string | null;
      client_email?: string | null;
      due_date?: string | null;
      notes?: string | null;
    }) => {
      if (!ws) throw new Error("No workspace");
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");

      // Generate next number
      const { data: existing } = await supabase
        .from("invoices" as never)
        .select("invoice_number")
        .eq("workspace_id", ws.id);
      const nums = ((existing ?? []) as unknown as { invoice_number: string }[])
        .map((r) => parseInt(r.invoice_number.replace(/\D/g, ""), 10))
        .filter((n) => !isNaN(n));
      const next = (nums.length ? Math.max(...nums) : 0) + 1;
      const invoice_number = `INV-${String(next).padStart(4, "0")}`;

      const { data, error } = await supabase
        .from("invoices" as never)
        .insert({
          workspace_id: ws.id,
          project_id: input.project_id,
          invoice_number,
          status: "draft",
          currency: input.currency ?? "USD",
          client_name: input.client_name ?? null,
          client_email: input.client_email ?? null,
          due_date: input.due_date ?? null,
          notes: input.notes ?? null,
          created_by: uid,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Invoice;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Invoice> & { id: string }) => {
      const { error } = await supabase
        .from("invoices" as never)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["invoice", vars.id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpsertLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<InvoiceLineItem> & { invoice_id: string }) => {
      const payload = {
        ...input,
        amount: +((Number(input.quantity ?? 1) * Number(input.unit_price ?? 0)).toFixed(2)),
      };
      const { data, error } = await supabase
        .from("invoice_line_items" as never)
        .upsert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as InvoiceLineItem;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["invoice_line_items", vars.invoice_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; invoice_id: string }) => {
      const { error } = await supabase
        .from("invoice_line_items" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["invoice_line_items", vars.invoice_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Recalculate invoice totals from current line items + tax rate, persist. */
export function useRecalcInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoice_id, tax_rate }: { invoice_id: string; tax_rate?: number }) => {
      const { data: lines } = await supabase
        .from("invoice_line_items" as never)
        .select("amount")
        .eq("invoice_id", invoice_id);
      const { data: inv } = await supabase
        .from("invoices" as never)
        .select("tax_rate")
        .eq("id", invoice_id)
        .single();
      const rate = tax_rate ?? ((inv as unknown as { tax_rate: number })?.tax_rate ?? 0);
      const totals = computeInvoiceTotals(
        (lines ?? []) as unknown as { amount: number }[],
        rate,
      );
      const { error } = await supabase
        .from("invoices" as never)
        .update({ ...totals, tax_rate: rate } as never)
        .eq("id", invoice_id);
      if (error) throw error;
      return totals;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["invoice", vars.invoice_id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ----- Expenses -----

export function useExpenses(params: { project_id?: string; status?: string } = {}) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["expenses", ws?.id, params.project_id ?? "all", params.status ?? "all"],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("expenses" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("incurred_on", { ascending: false });
      if (params.project_id) q = q.eq("project_id", params.project_id);
      if (params.status) q = q.eq("status", params.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Expense[];
    },
  });
}

export function useUpsertExpense() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Expense> & { project_id: string; description: string; amount: number }) => {
      if (!ws) throw new Error("No workspace");
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");
      const payload = {
        workspace_id: ws.id,
        submitted_by: uid,
        ...input,
      };
      const { data, error } = await supabase
        .from("expenses" as never)
        .upsert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Expense;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      const { error } = await supabase
        .from("expenses" as never)
        .update({
          status: approve ? "approved" : "rejected",
          approved_by: uid ?? null,
          approved_at: new Date().toISOString(),
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
