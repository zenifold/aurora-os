export interface ProjectFinancials {
  project_id: string;
  workspace_id: string;
  contract_value: number | null;
  currency: string;
  default_bill_rate: number | null;
  default_cost_rate: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function formatMoney(amount: number | null | undefined, currency = "USD") {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}
