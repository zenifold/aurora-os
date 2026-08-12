/**
 * Project Overview — domain types & defaults.
 *
 * The Overview is an AI-maintained, versioned snapshot of "what's going on in
 * this project right now", broken into customisable sections (lenses).
 *
 * Sections are defined at the workspace level and can be overridden per-project.
 */

export type OverviewHealth = "on_track" | "at_risk" | "off_track" | "unknown";

export type RefreshCadence = "off" | "daily" | "every_6h" | "weekly";

export interface OverviewSectionDef {
  /** Stable identifier (used to diff snapshots across versions). */
  key: string;
  label: string;
  icon: string;
  /** Short instruction the AI follows when writing this section. */
  prompt: string;
  /** Display order. */
  sort_order: number;
}

export interface OverviewSectionContent extends OverviewSectionDef {
  /** Markdown body produced by the AI. */
  content_md: string;
  /** Plain-text version for previews / search. */
  content_text: string;
}

export interface ProjectOverview {
  id: string;
  workspace_id: string;
  project_id: string;
  refresh_cadence: RefreshCadence;
  sections_override: OverviewSectionDef[] | null;
  last_refreshed_at: string | null;
  next_refresh_at: string | null;
  refresh_status: "idle" | "pending" | "running" | "error";
  refresh_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface OverviewSnapshot {
  id: string;
  workspace_id: string;
  project_id: string;
  overview_id: string;
  sections: OverviewSectionContent[];
  summary: string | null;
  health: OverviewHealth | null;
  ai_model: string | null;
  generated_by: string | null;
  generated_at: string;
}

export interface WorkspaceOverviewTemplate {
  workspace_id: string;
  sections: OverviewSectionDef[];
  created_at: string;
  updated_at: string;
}

/** Default sections shipped with every workspace. */
export const DEFAULT_OVERVIEW_SECTIONS: OverviewSectionDef[] = [
  {
    key: "summary",
    label: "Summary & Health",
    icon: "✨",
    sort_order: 0,
    prompt:
      "A 2-3 sentence TL;DR of the project's current state. End with a single line: \"Health: on_track | at_risk | off_track\" and one sentence explaining why. Mention what changed since the last snapshot if there is one.",
  },
  {
    key: "issues",
    label: "Issues & Risks",
    icon: "⚠️",
    sort_order: 1,
    prompt:
      "Bullet list of the most important open blockers, overdue items, escalations and risks. For each, name the affected task/owner and (if obvious) the mitigation or next step. Keep to the highest-leverage 3-7 items.",
  },
  {
    key: "technical",
    label: "Technical",
    icon: "🛠️",
    sort_order: 2,
    prompt:
      "Engineering-flavoured snapshot: in-progress technical work, key architectural or implementation decisions in recent comments/pages, and any open technical questions or unknowns. Bullets, terse.",
  },
  {
    key: "strategy_client",
    label: "Strategy & Client",
    icon: "🎯",
    sort_order: 3,
    prompt:
      "Strategic + stakeholder lens. Cover: project goals/success metrics, recent deliverables shipped to the client (if any), upcoming client-visible milestones, and a one-line client-friendly status. Bullets, no internal jargon.",
  },
];

export const REFRESH_CADENCE_LABELS: Record<RefreshCadence, string> = {
  off: "Manual only",
  daily: "Daily",
  every_6h: "Every 6 hours",
  weekly: "Weekly",
};

/** Returns the next due timestamp given a cadence, starting from `from`. */
export function nextRefreshAt(cadence: RefreshCadence, from: Date = new Date()): Date | null {
  if (cadence === "off") return null;
  const out = new Date(from);
  if (cadence === "daily") out.setUTCHours(out.getUTCHours() + 24);
  else if (cadence === "every_6h") out.setUTCHours(out.getUTCHours() + 6);
  else if (cadence === "weekly") out.setUTCDate(out.getUTCDate() + 7);
  return out;
}
