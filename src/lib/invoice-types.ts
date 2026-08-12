export type InvoiceStatus = "draft" | "sent" | "paid" | "void" | "overdue";
export type ExpenseStatus = "pending" | "approved" | "rejected" | "invoiced";
export type LineSourceKind = "manual" | "time" | "milestone" | "expense";

export interface Invoice {
  id: string;
  workspace_id: string;
  project_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  client_name: string | null;
  client_email: string | null;
  client_address: string | null;
  share_token: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  source_kind: LineSourceKind;
  source_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface Expense {
  id: string;
  workspace_id: string;
  project_id: string;
  task_id: string | null;
  submitted_by: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  incurred_on: string;
  receipt_url: string | null;
  is_billable: boolean;
  status: ExpenseStatus;
  approved_by: string | null;
  approved_at: string | null;
  invoice_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  void: "Void",
  overdue: "Overdue",
};

export const EXPENSE_CATEGORIES = [
  "travel",
  "lodging",
  "meals",
  "software",
  "equipment",
  "contractor",
  "other",
] as const;

export function computeInvoiceTotals(
  lines: Pick<InvoiceLineItem, "amount">[],
  taxRate: number,
) {
  const subtotal = lines.reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const tax_amount = +(subtotal * (Number(taxRate) || 0) / 100).toFixed(2);
  const total = +(subtotal + tax_amount).toFixed(2);
  return { subtotal: +subtotal.toFixed(2), tax_amount, total };
}
