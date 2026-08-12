export type PageScope = "workspace" | "project" | "folder" | "contact" | "task";
export type PageType = "doc" | "prd" | "decision" | "journal" | "runbook" | "meeting_notes" | "canvas" | "plan" | "folder";

export interface Page {
  id: string;
  workspace_id: string;
  scope: PageScope;
  scope_id: string | null;
  parent_page_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  content: unknown;
  content_text: string;
  page_type: PageType;
  is_pinned: boolean;
  is_archived: boolean;
  is_template: boolean;
  ai_managed: boolean;
  ai_last_summarized_at: string | null;
  is_portal_published?: boolean;
  portal_published_at?: string | null;
  portal_published_by?: string | null;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const PAGE_TYPES: { value: PageType; label: string; icon: string }[] = [
  { value: "folder", label: "Folder", icon: "📁" },
  { value: "doc", label: "Doc", icon: "📄" },
  { value: "prd", label: "PRD", icon: "📋" },
  { value: "decision", label: "Decision log", icon: "🧭" },
  { value: "journal", label: "Project journal", icon: "📔" },
  { value: "runbook", label: "Runbook", icon: "📕" },
  { value: "meeting_notes", label: "Meeting notes", icon: "🎤" },
  { value: "canvas", label: "Canvas", icon: "🎨" },
  { value: "plan", label: "Plan", icon: "🗓️" },
];

export function extractText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (typeof node.text === "string") out.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return out.join(" ").slice(0, 50000);
}
