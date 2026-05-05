export type DivisionType = "delivery" | "operations" | "sales" | "custom";
export type FolderType = "client" | "portfolio" | "project" | "phase" | "generic";

export interface Division {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  division_type: DivisionType;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  workspace_id: string;
  division_id: string;
  parent_id: string | null;
  name: string;
  folder_type: FolderType;
  client_email: string | null;
  client_company: string | null;
  portal_enabled: boolean;
  color: string | null;
  icon: string | null;
  cover_image: string | null;
  description: string | null;
  tags: string[];
  sort_order: number;
  is_archived: boolean;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
