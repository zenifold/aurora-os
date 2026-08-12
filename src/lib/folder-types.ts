export type FolderType = "client" | "portfolio" | "project" | "phase" | "generic";

export type SectionContentType =
  | "folders"
  | "projects"
  | "pages"
  | "contacts"
  | "deals"
  | "notes"
  | "meetings"
  | "tasks";

export interface Folder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  folder_type: FolderType;
  client_email: string | null;
  client_company: string | null;
  client_account_id: string | null;
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
