// Modular dashboard system: a preset is just a list of widget keys + sizes.
// Stored per-user-per-workspace in localStorage so people can pick how they
// want their landing page to feel: a Dashboard, a Wiki, a Delivery overview, etc.

export type WidgetKey =
  | "stats"
  | "quick_actions"
  | "my_tasks"
  | "recent_projects"
  | "activity"
  | "pinned_pages"
  | "recent_notes"
  | "upcoming_meetings"
  | "my_action_items"
  | "recent_recaps"
  | "at_risk_projects"
  | "milestones"
  | "agent_runs";

export type WidgetSize = "sm" | "md" | "lg" | "xl"; // col-span on lg breakpoint

export interface WidgetConfig {
  key: WidgetKey;
  size: WidgetSize;
}

export interface DashboardLayout {
  preset: PresetKey;
  widgets: WidgetConfig[];
}

export type PresetKey = "dashboard" | "wiki" | "delivery" | "custom";

export const PRESETS: Record<Exclude<PresetKey, "custom">, { label: string; description: string; widgets: WidgetConfig[] }> = {
  dashboard: {
    label: "Dashboard",
    description: "Focused on your calendar and what's on your plate.",
    widgets: [
      { key: "upcoming_meetings", size: "lg" },
      { key: "my_tasks", size: "lg" },
    ],
  },
  wiki: {
    label: "Wiki",
    description: "Knowledge first — pinned pages, notes, and projects.",
    widgets: [
      { key: "quick_actions", size: "xl" },
      { key: "pinned_pages", size: "lg" },
      { key: "recent_notes", size: "md" },
      { key: "recent_projects", size: "lg" },
      { key: "activity", size: "md" },
    ],
  },
  delivery: {
    label: "Delivery",
    description: "What's late, what's at risk, who's doing what.",
    widgets: [
      { key: "stats", size: "xl" },
      { key: "at_risk_projects", size: "lg" },
      { key: "upcoming_meetings", size: "md" },
      { key: "my_action_items", size: "md" },
      { key: "recent_recaps", size: "md" },
      { key: "milestones", size: "lg" },
      { key: "agent_runs", size: "md" },
      { key: "activity", size: "md" },
    ],
  },
};

export const ALL_WIDGETS: { key: WidgetKey; label: string; description: string }[] = [
  { key: "stats", label: "Task stats", description: "Due today, in progress, overdue, done." },
  { key: "quick_actions", label: "Quick actions", description: "Capture, new page, new meeting…" },
  { key: "my_tasks", label: "My tasks", description: "Your next 5 tasks." },
  { key: "recent_projects", label: "Recent projects", description: "Last touched projects." },
  { key: "activity", label: "Recent activity", description: "Team activity feed." },
  { key: "pinned_pages", label: "Pinned pages", description: "Workspace wiki pages." },
  { key: "recent_notes", label: "Recent notes", description: "Latest notes." },
  { key: "upcoming_meetings", label: "Upcoming meetings", description: "Next meetings on the calendar." },
  { key: "my_action_items", label: "My action items", description: "Open action items from meetings." },
  { key: "recent_recaps", label: "Recent recaps", description: "Latest AI meeting summaries." },
  { key: "at_risk_projects", label: "At-risk projects", description: "Projects with overdue tasks." },
  { key: "milestones", label: "Upcoming milestones", description: "Next milestones across projects." },
  { key: "agent_runs", label: "Recent AI runs", description: "Latest agent activity." },
];

const KEY = (wsId: string, userId: string) => `dashboard:layout:${wsId}:${userId}`;

export function loadLayout(wsId: string | undefined, userId: string | undefined): DashboardLayout {
  if (!wsId || !userId || typeof window === "undefined") return { preset: "dashboard", widgets: PRESETS.dashboard.widgets };
  try {
    const raw = localStorage.getItem(KEY(wsId, userId));
    if (!raw) return { preset: "dashboard", widgets: PRESETS.dashboard.widgets };
    const parsed = JSON.parse(raw) as DashboardLayout;
    if (!Array.isArray(parsed.widgets)) return { preset: "dashboard", widgets: PRESETS.dashboard.widgets };
    return parsed;
  } catch {
    return { preset: "dashboard", widgets: PRESETS.dashboard.widgets };
  }
}

export function saveLayout(wsId: string | undefined, userId: string | undefined, layout: DashboardLayout) {
  if (!wsId || !userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY(wsId, userId), JSON.stringify(layout));
  } catch {
    // ignore quota
  }
}

export function sizeToColSpan(size: WidgetSize): string {
  // 12-col grid on lg+, 1-col on mobile, 2-col on sm
  switch (size) {
    case "sm": return "lg:col-span-3 sm:col-span-1";
    case "md": return "lg:col-span-4 sm:col-span-2";
    case "lg": return "lg:col-span-8 sm:col-span-2";
    case "xl": return "lg:col-span-12 sm:col-span-2";
  }
}
