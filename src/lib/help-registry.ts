import {
  Home,
  CheckSquare,
  Inbox,
  ShieldCheck,
  Bot,
  Zap,
  FileText,
  Palette,
  Calendar,
  Briefcase,
  FolderKanban,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export type HelpAction = {
  label: string;
  /** Either a path to navigate to OR an intent key handled by HelpPanel. */
  to?: string;
  intent?: "quickCreate" | "command";
};

export type HelpShortcut = { keys: string; desc: string };

export type HelpEntry = {
  /** Stable id used for "first-visit nudge" tracking. */
  id: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  capabilities: string[];
  customize: { label: string; to: string }[];
  storage: string;
  shortcuts: HelpShortcut[];
  walkthrough?: string[];
  tryIt?: HelpAction[];
};

const WORKSPACE_STORAGE =
  "Saved in Supabase, scoped to this workspace. Only workspace members can read it; admins can manage it.";

const PERSONAL_STORAGE =
  "Saved in Supabase against your account. Only you can read or change it.";

export const HELP_FALLBACK: HelpEntry = {
  id: "workspace-basics",
  icon: Home,
  title: "Workspace basics",
  summary: "Aurora is your workspace for projects, tasks, docs, and AI agents.",
  capabilities: [
    "Organize work into Divisions → Folders → Projects",
    "Track tasks across statuses and views",
    "Write Pages, sketch on Canvas, plan with Plans",
    "Automate work with AI agents and triggers",
  ],
  customize: [
    { label: "Appearance & density", to: "/app/settings/customization" },
    { label: "AI agents", to: "/app/agents" },
    { label: "Workspace settings", to: "/app/settings" },
  ],
  storage: WORKSPACE_STORAGE,
  shortcuts: [
    { keys: "⌘ K", desc: "Open command palette" },
    { keys: "⌘ N", desc: "Quick create" },
    { keys: "?", desc: "Open this help" },
  ],
};

const ENTRIES: Record<string, HelpEntry> = {
  "/app": {
    id: "home",
    icon: Home,
    title: "Home",
    summary: "Your daily landing zone — assigned work, recent activity, and quick jumps.",
    capabilities: [
      "See tasks assigned to you across all projects",
      "Resume recent pages, canvases, and projects",
      "Jump into Inbox and Approvals",
      "Spin up new work with Quick Create",
    ],
    customize: [
      { label: "Sidebar order & density", to: "/app/settings/customization" },
      { label: "Default landing view", to: "/app/settings/profile" },
    ],
    storage: WORKSPACE_STORAGE,
    shortcuts: [
      { keys: "⌘ K", desc: "Search anything" },
      { keys: "⌘ N", desc: "Quick create" },
    ],
    tryIt: [
      { label: "Quick create…", intent: "quickCreate" },
      { label: "Open search", intent: "command" },
    ],
  },
  "/app/my-tasks": {
    id: "my-tasks",
    icon: CheckSquare,
    title: "My Tasks",
    summary: "Every task assigned to you, grouped by status and due date.",
    capabilities: [
      "Toggle list, board, or calendar view",
      "Inline-edit title, status, priority, and dates",
      "Use J / K to walk through tasks; F for full screen",
      "Bulk-update with ⌘-click selection",
    ],
    customize: [
      { label: "Default task view", to: "/app/settings/customization" },
      { label: "Notification rules", to: "/app/settings/notifications" },
    ],
    storage: WORKSPACE_STORAGE,
    shortcuts: [
      { keys: "J / K", desc: "Next / previous task" },
      { keys: "F", desc: "Toggle full-screen task panel" },
      { keys: "⌘ ↵", desc: "Save & open task" },
    ],
    walkthrough: [
      "Pick a view: list for triage, board for flow, calendar for planning.",
      "Click any task to open it in the side panel; double-click for full screen.",
      "Use the inline status pill to drag work forward.",
    ],
  },
  "/app/inbox": {
    id: "inbox",
    icon: Inbox,
    title: "Inbox",
    summary: "One stream for mentions, agent results, approvals, and system events.",
    capabilities: [
      "Filter by kind (mention, agent, approval, system)",
      "Mark as read or archive in bulk",
      "Click to jump to the source surface",
    ],
    customize: [
      { label: "Notification rules", to: "/app/settings/notifications" },
    ],
    storage: WORKSPACE_STORAGE,
    shortcuts: [
      { keys: "E", desc: "Archive selected" },
      { keys: "Shift R", desc: "Mark all read" },
    ],
  },
  "/app/approvals": {
    id: "approvals",
    icon: ShieldCheck,
    title: "Approval Inbox",
    summary: "Review agent actions that need a human before they run.",
    capabilities: [
      "Approve or reject pending agent actions",
      "Inspect the exact tool call payload before deciding",
      "See which agent and run requested approval",
    ],
    customize: [
      { label: "Agent autonomy & guardrails", to: "/app/agents" },
    ],
    storage: WORKSPACE_STORAGE,
    shortcuts: [
      { keys: "A", desc: "Approve focused item" },
      { keys: "R", desc: "Reject focused item" },
    ],
  },
  "/app/agents": {
    id: "agents",
    icon: Bot,
    title: "AI Agents",
    summary: "Persistent assistants with their own identity, tools, and memory.",
    capabilities: [
      "Create agents with a name, avatar, and system prompt",
      "Set autonomy level and guardrails per agent",
      "Wire agents to events and schedules via Triggers",
      "Inspect each run's trace, tools used, and approvals",
    ],
    customize: [
      { label: "Agent tools & memory", to: "/app/agents" },
      { label: "Triggers", to: "/app/triggers" },
    ],
    storage:
      "Agent definitions and run history live in Supabase, scoped to this workspace. Memory is private to each agent.",
    shortcuts: [{ keys: "⌘ ↵", desc: "Brief and run" }],
    walkthrough: [
      "Create an agent — pick its role, tools, and autonomy.",
      "Test it from the brief box.",
      "Wire it to a Trigger so it runs on schedule or on workspace events.",
    ],
  },
  "/app/triggers": {
    id: "triggers",
    icon: Zap,
    title: "Agent Triggers",
    summary: "Run agents on a cadence or when something happens in the workspace.",
    capabilities: [
      "Schedule agents hourly, daily, or on custom cadence",
      "Fire agents on events (task overdue, status change, …)",
      "Draft triggers with AI from a natural-language prompt",
      "Reference event payload values in goals with {{key}}",
    ],
    customize: [
      { label: "Agents", to: "/app/agents" },
    ],
    storage: WORKSPACE_STORAGE,
    shortcuts: [{ keys: "Enter", desc: "Save trigger from editor" }],
    walkthrough: [
      'Click "New trigger" and describe what you want.',
      "Review the AI draft — adjust agent, schedule, or goal.",
      "Hit Save. Use the play icon to test-fire any trigger.",
    ],
  },
  "/app/pages": {
    id: "pages",
    icon: FileText,
    title: "Pages",
    summary: "Rich docs, briefs, and references — block-based with @-mentions.",
    capabilities: [
      "Create docs scoped to a workspace or project",
      "Embed tasks, projects, and other pages with @",
      "Generate with AI from a one-line prompt",
    ],
    customize: [{ label: "AI defaults", to: "/app/agents" }],
    storage: WORKSPACE_STORAGE,
    shortcuts: [{ keys: "/", desc: "Open block menu in editor" }],
  },
  "/app/notes": {
    id: "notes",
    icon: FileText,
    title: "Notes",
    summary: "Lightweight personal notes that stay out of project clutter.",
    capabilities: ["Capture quick thoughts", "Convert a note into a Page or Task"],
    customize: [],
    storage: PERSONAL_STORAGE,
    shortcuts: [{ keys: "⌘ N", desc: "New note" }],
  },
  "/app/canvas": {
    id: "canvas",
    icon: Palette,
    title: "Canvas",
    summary: "Infinite whiteboard for sketches, diagrams, and visual thinking.",
    capabilities: ["Excalidraw-style drawing", "Templates for flows & wireframes"],
    customize: [],
    storage: WORKSPACE_STORAGE,
    shortcuts: [{ keys: "V", desc: "Select tool" }],
  },
  "/app/plans": {
    id: "plans",
    icon: Calendar,
    title: "Plans",
    summary: "Timeline-style planning across milestones and dependencies.",
    capabilities: ["Schedule milestones", "Track dependencies"],
    customize: [],
    storage: WORKSPACE_STORAGE,
    shortcuts: [],
  },
  "/app/p": {
    id: "project",
    icon: Briefcase,
    title: "Project workspace",
    summary: "Everything for one project: tasks, pages, files, and people.",
    capabilities: [
      "Switch between Board, List, Timeline, and Calendar",
      "Add pages and canvases scoped to this project",
      "Invite collaborators with roles",
      "Set status, priority, and target dates",
    ],
    customize: [
      { label: "Project settings", to: "/app/settings" },
      { label: "Workflow templates", to: "/app/settings/customization" },
    ],
    storage: WORKSPACE_STORAGE,
    shortcuts: [
      { keys: "⌘ N", desc: "Create task in this project" },
      { keys: "G then B", desc: "Jump to Board" },
    ],
  },
  "/app/f": {
    id: "folder",
    icon: FolderKanban,
    title: "Folder",
    summary: "Group related projects together inside a division.",
    capabilities: ["Add, reorder, and color projects", "Set a folder owner"],
    customize: [],
    storage: WORKSPACE_STORAGE,
    shortcuts: [],
  },
  "/app/d": {
    id: "division",
    icon: FolderKanban,
    title: "Division",
    summary: "Top-level grouping for teams or business units in your workspace.",
    capabilities: [
      "House folders and projects under one umbrella",
      "Use as filter scope across views",
    ],
    customize: [{ label: "Divisions & members", to: "/app/settings" }],
    storage: WORKSPACE_STORAGE,
    shortcuts: [],
  },
  "/app/settings": {
    id: "settings",
    icon: Settings,
    title: "Settings",
    summary: "Customize the workspace, your profile, and integrations.",
    capabilities: [
      "Edit profile and notification preferences",
      "Manage members and roles",
      "Connect external tools",
    ],
    customize: [
      { label: "Appearance & density", to: "/app/settings/customization" },
      { label: "Profile", to: "/app/settings/profile" },
    ],
    storage: WORKSPACE_STORAGE,
    shortcuts: [],
  },
  "/app/settings/customization": {
    id: "customization",
    icon: Sparkles,
    title: "Customization",
    summary: "All the knobs that change how Aurora looks and behaves for you.",
    capabilities: [
      "Switch theme, density, font size, and accent",
      "Toggle reduced motion and high contrast",
      "Configure default views and shortcuts",
    ],
    customize: [],
    storage: PERSONAL_STORAGE,
    shortcuts: [],
  },
  "/app/settings/members": {
    id: "members",
    icon: Users,
    title: "Members",
    summary: "Who can do what in this workspace.",
    capabilities: ["Invite teammates", "Assign roles", "Remove access"],
    customize: [],
    storage: WORKSPACE_STORAGE,
    shortcuts: [],
  },
};

const ORDERED_PATHS = Object.keys(ENTRIES).sort((a, b) => b.length - a.length);

export function resolveHelp(pathname: string): HelpEntry {
  for (const key of ORDERED_PATHS) {
    if (pathname === key || pathname.startsWith(key + "/")) {
      return ENTRIES[key];
    }
  }
  return HELP_FALLBACK;
}

export { ENTRIES as HELP_ENTRIES };
