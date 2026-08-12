// Block B — Work modes: persona presets that tune sidebar visibility,
// landing route, and default project tabs. Stored on user_preferences.work_mode.
import {
  Folder, Inbox, CheckCircle2, StickyNote, Mic, Box,
  TrendingUp, Briefcase, UsersRound, LineChart, AlertTriangle,
  type LucideIcon,
} from "lucide-react";

export type WorkMode = "pm" | "ic" | "sales" | "finance" | "exec" | "custom";

/** Primary top-nav items the sidebar can show/hide per user. */
export const PRIMARY_NAV_KEYS = [
  "dashboard", "inbox", "my-tasks", "notes", "meetings", "objects",
  "resources", "capacity", "executive", "escalations",
] as const;
export type PrimaryNavKey = (typeof PRIMARY_NAV_KEYS)[number];

export const PRIMARY_NAV_LABELS: Record<PrimaryNavKey, string> = {
  dashboard: "Dashboard",
  inbox: "Inbox",
  "my-tasks": "My Work",
  notes: "Notes",
  meetings: "Meetings",
  objects: "Objects menu",
  resources: "Resources",
  capacity: "Capacity",
  executive: "Executive",
  escalations: "Escalations",
};

export interface WorkModePreset {
  key: Exclude<WorkMode, "custom">;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Items hidden by this preset. */
  hidden: PrimaryNavKey[];
  /** Default landing pref applied when the preset is selected. */
  landing: "dashboard" | "my-tasks" | "last-project";
}

export const WORK_MODES: WorkModePreset[] = [
  {
    key: "pm",
    label: "Project Manager",
    description: "Delivery, status, escalations and meetings front-and-center.",
    icon: Briefcase,
    hidden: ["objects"],
    landing: "dashboard",
  },
  {
    key: "ic",
    label: "Individual contributor",
    description: "My Work first; hides forecasting and exec dashboards.",
    icon: CheckCircle2,
    hidden: ["executive", "escalations", "capacity", "objects"],
    landing: "my-tasks",
  },
  {
    key: "sales",
    label: "Sales / AE",
    description: "Pipeline and accounts; quieter delivery surfaces.",
    icon: TrendingUp,
    hidden: ["escalations", "capacity", "executive", "objects"],
    landing: "dashboard",
  },
  {
    key: "finance",
    label: "Finance",
    description: "Margin, WIP and billing; less day-to-day delivery noise.",
    icon: LineChart,
    hidden: ["notes", "meetings", "objects"],
    landing: "dashboard",
  },
  {
    key: "exec",
    label: "Executive",
    description: "Portfolio + risk overview; suppresses IC clutter.",
    icon: UsersRound,
    hidden: ["my-tasks", "notes", "objects"],
    landing: "dashboard",
  },
];

export function workModeByKey(k: WorkMode | null | undefined): WorkModePreset | null {
  if (!k || k === "custom") return null;
  return WORK_MODES.find((m) => m.key === k) ?? null;
}

// ---------------------------------------------------------------------------
// Per-project mini-app tab toggles (project header buttons).

export const PROJECT_TAB_KEYS = [
  "overview", "pages", "canvas", "chat", "status",
  "baseline", "approvals", "intake",
  "requirements", "dependencies",
] as const;
export type ProjectTabKey = (typeof PROJECT_TAB_KEYS)[number];

export const PROJECT_TAB_LABELS: Record<ProjectTabKey, string> = {
  overview: "Overview",
  pages: "Pages",
  canvas: "Canvas",
  chat: "Chat",
  status: "Status",
  baseline: "Baseline",
  approvals: "Approvals",
  intake: "Intake",
  requirements: "Requirements",
  dependencies: "Dependencies",
};

/** When `enabled_tabs` is null/undefined the project shows everything. */
export function isTabEnabled(
  enabled: string[] | null | undefined,
  key: ProjectTabKey,
): boolean {
  if (!enabled || enabled.length === 0) return true;
  return enabled.includes(key);
}
