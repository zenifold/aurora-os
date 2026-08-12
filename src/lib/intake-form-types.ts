export type IntakeFieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "checkbox";

export interface IntakeField {
  id: string;
  type: IntakeFieldType;
  label: string;
  help?: string;
  required?: boolean;
  options?: string[]; // for select / multiselect
  placeholder?: string;
}

export type IntakeFormStatus = "draft" | "published" | "archived";
export type IntakeFormVisibility = "client" | "internal" | "both";

export interface IntakeForm {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: IntakeFormStatus;
  visibility: IntakeFormVisibility;
  allow_anonymous: boolean;
  fields: IntakeField[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntakeFormResponse {
  id: string;
  workspace_id: string;
  project_id: string;
  form_id: string;
  client_portal_access_id: string | null;
  respondent_name: string | null;
  respondent_email: string | null;
  answers: Record<string, unknown>;
  submitted_at: string;
  created_at: string;
}

export const FIELD_TYPE_LABELS: Record<IntakeFieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  email: "Email",
  number: "Number",
  date: "Date",
  select: "Single choice",
  multiselect: "Multiple choice",
  checkbox: "Checkbox",
};

export function newField(type: IntakeFieldType = "short_text"): IntakeField {
  return {
    id: crypto.randomUUID(),
    type,
    label: "Untitled question",
    required: false,
    options: type === "select" || type === "multiselect" ? ["Option 1"] : undefined,
  };
}
