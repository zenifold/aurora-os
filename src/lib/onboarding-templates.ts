import {
  Bug,
  CalendarDays,
  CheckCircle2,
  FileText,
  Handshake,
  Layers,
  Megaphone,
  Briefcase,
  Repeat,
  PenSquare,
  TrendingUp,
  Users,
  Rocket,
  Mic,
  Home as HomeIcon,
  Target,
  Map,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";

export type OnboardingTemplateKey =
  // generic
  | "blank"
  // client services (freelancer / agency / consulting)
  | "client_onboarding"
  | "retainer"
  | "freelance_gig"
  | "sales_pipeline"
  | "proposal_sow"
  | "client_campaign"
  // product / software
  | "sprint"
  | "bugs"
  | "roadmap"
  // content / creative
  | "content"
  | "brand_launch"
  | "podcast"
  // personal
  | "personal"
  | "goals"
  | "home"
  // ops
  | "hiring"
  | "event";

export type OnboardingTemplateCategory =
  | "general"
  | "client-services"
  | "product"
  | "content"
  | "personal"
  | "ops";

export interface OnboardingTaskSeed {
  title: string;
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
}

export interface OnboardingTemplate {
  key: OnboardingTemplateKey;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  category: OnboardingTemplateCategory;
  projectName: string;
  tasks: OnboardingTaskSeed[];
  /** Cross-cutting demo seeds this template wants. The seeder runs each
   * tag at most once per onboarding, even if multiple templates ask for it. */
  seeds?: ReadonlyArray<"crm" | "proposal" | "sow" | "page" | "note">;
  /** Audience hints — used to surface relevant defaults per onboarding choice. */
  audience: ReadonlyArray<"solo" | "freelancer" | "agency" | "internal">;
}

export const CATEGORY_META: Record<
  OnboardingTemplateCategory,
  { label: string; description: string }
> = {
  general: { label: "Start fresh", description: "" },
  "client-services": {
    label: "Client services",
    description: "Freelancers, agencies, consultants delivering to clients",
  },
  product: { label: "Product & software", description: "Building your own product" },
  content: { label: "Content & creative", description: "Editorial, brand, campaigns" },
  personal: { label: "Personal", description: "Life, goals, side projects" },
  ops: { label: "Operations", description: "Internal team workflows" },
};

export const ONBOARDING_TEMPLATES: OnboardingTemplate[] = [
  {
    key: "blank",
    name: "Blank project",
    description: "Start with a clean slate.",
    icon: FileText,
    color: "#94a3b8",
    category: "general",
    projectName: "My Project",
    tasks: [],
    audience: ["solo", "freelancer", "agency", "internal"],
  },

  // ── Client services ───────────────────────────────────────────────
  {
    key: "client_onboarding",
    name: "Client onboarding kit",
    description: "Kickoff, intake, access, and welcome packet — all the first-week steps.",
    icon: Handshake,
    color: "#0ea5e9",
    category: "client-services",
    projectName: "New client — onboarding",
    seeds: ["crm", "page", "note"],
    audience: ["freelancer", "agency"],
    tasks: [
      { title: "Send welcome email + kickoff invite", status: "todo", priority: "high" },
      { title: "Collect brand assets & access credentials", status: "todo", priority: "high" },
      { title: "Run kickoff call & confirm scope", status: "in_progress", priority: "high" },
      { title: "Set up shared drive / portal", status: "in_progress", priority: "medium" },
      { title: "Schedule weekly check-in cadence", status: "todo", priority: "medium" },
      { title: "Internal: brief the delivery team", status: "todo", priority: "medium" },
    ],
  },
  {
    key: "retainer",
    name: "Retainer engagement",
    description: "Recurring monthly engagement with capacity tracking and reporting.",
    icon: Repeat,
    color: "#10b981",
    category: "client-services",
    projectName: "Retainer — Month 1",
    seeds: ["crm", "sow"],
    audience: ["freelancer", "agency"],
    tasks: [
      { title: "Confirm priorities for this month", status: "in_progress", priority: "high" },
      { title: "Allocate hours across workstreams", status: "todo", priority: "medium" },
      { title: "Mid-month check-in", status: "todo", priority: "medium" },
      { title: "Deliver monthly report", status: "todo", priority: "high" },
      { title: "Invoice + renew", status: "todo", priority: "medium" },
    ],
  },
  {
    key: "freelance_gig",
    name: "Freelance gig",
    description: "One-off project: brief → draft → revisions → handover → invoice.",
    icon: Briefcase,
    color: "#a855f7",
    category: "client-services",
    projectName: "New freelance gig",
    seeds: ["crm"],
    audience: ["solo", "freelancer"],
    tasks: [
      { title: "Confirm brief + deliverables", status: "todo", priority: "high" },
      { title: "First draft", status: "in_progress", priority: "high" },
      { title: "Review round 1", status: "todo", priority: "medium" },
      { title: "Final delivery", status: "todo", priority: "high" },
      { title: "Send invoice", status: "todo", priority: "medium" },
    ],
  },
  {
    key: "sales_pipeline",
    name: "Sales pipeline",
    description: "Track leads through discovery, proposal, and close.",
    icon: TrendingUp,
    color: "#ec4899",
    category: "client-services",
    projectName: "Pipeline tracker",
    seeds: ["crm"],
    audience: ["freelancer", "agency", "internal"],
    tasks: [
      { title: "Qualify inbound: Acme Co.", status: "in_progress", priority: "high" },
      { title: "Discovery call: Globex", status: "todo", priority: "high" },
      { title: "Send proposal to Initech", status: "review", priority: "high" },
      { title: "Follow up: Hooli (cold)", status: "todo", priority: "low" },
    ],
  },
  {
    key: "proposal_sow",
    name: "Proposal & SOW workflow",
    description: "Draft → internal review → client send → signature → kickoff.",
    icon: PenSquare,
    color: "#f59e0b",
    category: "client-services",
    projectName: "Proposal pipeline",
    seeds: ["crm", "proposal", "sow"],
    audience: ["freelancer", "agency"],
    tasks: [
      { title: "Draft proposal — Acme Co.", status: "in_progress", priority: "high" },
      { title: "Internal review", status: "todo", priority: "medium" },
      { title: "Send to client", status: "todo", priority: "high" },
      { title: "Counter-sign SOW", status: "todo", priority: "high" },
      { title: "Trigger kickoff workflow", status: "todo", priority: "medium" },
    ],
  },
  {
    key: "client_campaign",
    name: "Client marketing campaign",
    description: "Multi-channel campaign delivery for a client.",
    icon: Megaphone,
    color: "#f43f5e",
    category: "client-services",
    projectName: "Client campaign",
    seeds: ["crm", "page"],
    audience: ["freelancer", "agency"],
    tasks: [
      { title: "Define campaign goals + KPIs", status: "todo", priority: "high" },
      { title: "Creative concepts", status: "in_progress", priority: "high" },
      { title: "Landing page copy", status: "in_progress", priority: "medium" },
      { title: "Schedule social posts", status: "todo", priority: "medium" },
      { title: "Send results recap", status: "todo", priority: "high" },
    ],
  },

  // ── Product / software ────────────────────────────────────────────
  {
    key: "sprint",
    name: "Product sprint",
    description: "Backlog → In progress → Review → Done.",
    icon: Layers,
    color: "#8b5cf6",
    category: "product",
    projectName: "Product Sprint",
    audience: ["internal", "agency"],
    tasks: [
      { title: "Define sprint goal", status: "todo", priority: "high" },
      { title: "Refine top backlog items", status: "todo", priority: "medium" },
      { title: "Design new feature mockups", status: "in_progress", priority: "high" },
      { title: "Build API endpoints", status: "in_progress", priority: "high" },
      { title: "Write release notes", status: "review", priority: "medium" },
      { title: "Sprint retro", status: "todo", priority: "low" },
    ],
  },
  {
    key: "bugs",
    name: "Bug tracker",
    description: "Reported → Confirmed → In progress → Fixed.",
    icon: Bug,
    color: "#ef4444",
    category: "product",
    projectName: "Bug Tracker",
    audience: ["internal", "agency"],
    tasks: [
      { title: "Login button unresponsive on Safari", status: "todo", priority: "urgent" },
      { title: "Avatar fails to upload >5MB", status: "in_progress", priority: "high" },
      { title: "Timezone off by one in reports", status: "review", priority: "medium" },
      { title: "Typo on settings page", status: "todo", priority: "low" },
    ],
  },
  {
    key: "roadmap",
    name: "Roadmap & releases",
    description: "Now / Next / Later swimlanes for product planning.",
    icon: Map,
    color: "#3b82f6",
    category: "product",
    projectName: "Roadmap",
    seeds: ["page"],
    audience: ["internal"],
    tasks: [
      { title: "Now: Onboarding revamp", status: "in_progress", priority: "high" },
      { title: "Now: Search v2", status: "in_progress", priority: "high" },
      { title: "Next: Mobile push notifications", status: "todo", priority: "medium" },
      { title: "Later: Public API", status: "todo", priority: "low" },
    ],
  },

  // ── Content / creative ────────────────────────────────────────────
  {
    key: "content",
    name: "Content calendar",
    description: "Idea → Writing → Review → Published.",
    icon: CalendarDays,
    color: "#ec4899",
    category: "content",
    projectName: "Content Calendar",
    seeds: ["page"],
    audience: ["solo", "freelancer", "agency", "internal"],
    tasks: [
      { title: "Blog: launch announcement", status: "in_progress", priority: "high" },
      { title: "Newsletter: monthly recap", status: "todo", priority: "medium" },
      { title: "Social: feature highlights", status: "review", priority: "medium" },
      { title: "Case study: customer win", status: "todo", priority: "high" },
    ],
  },
  {
    key: "brand_launch",
    name: "Brand launch",
    description: "Naming, identity, site, and launch comms.",
    icon: Rocket,
    color: "#8b5cf6",
    category: "content",
    projectName: "Brand launch",
    seeds: ["page"],
    audience: ["freelancer", "agency", "internal"],
    tasks: [
      { title: "Finalize positioning & messaging", status: "in_progress", priority: "high" },
      { title: "Approve logo & visual identity", status: "review", priority: "high" },
      { title: "Build launch site", status: "in_progress", priority: "high" },
      { title: "Press & influencer outreach", status: "todo", priority: "medium" },
      { title: "Launch day checklist", status: "todo", priority: "urgent" },
    ],
  },
  {
    key: "podcast",
    name: "Podcast production",
    description: "Guest booking, recording, editing, and publishing.",
    icon: Mic,
    color: "#a855f7",
    category: "content",
    projectName: "Podcast",
    audience: ["solo", "freelancer", "internal"],
    tasks: [
      { title: "Book next 3 guests", status: "todo", priority: "high" },
      { title: "Send pre-interview brief", status: "in_progress", priority: "medium" },
      { title: "Record episode 12", status: "todo", priority: "high" },
      { title: "Edit & publish episode 11", status: "in_progress", priority: "high" },
    ],
  },

  // ── Personal ──────────────────────────────────────────────────────
  {
    key: "personal",
    name: "Personal tasks",
    description: "Simple to-do, doing, done.",
    icon: CheckCircle2,
    color: "#10b981",
    category: "personal",
    projectName: "Personal Tasks",
    seeds: ["note"],
    audience: ["solo"],
    tasks: [
      { title: "Plan the week ahead", status: "in_progress", priority: "high" },
      { title: "Reply to important emails", status: "todo", priority: "medium" },
      { title: "Workout 3x this week", status: "todo", priority: "medium" },
      { title: "Read for 30 minutes", status: "todo", priority: "low" },
    ],
  },
  {
    key: "goals",
    name: "Quarterly goals",
    description: "Set goals, track key results, journal weekly.",
    icon: Target,
    color: "#0ea5e9",
    category: "personal",
    projectName: "Goals — this quarter",
    seeds: ["note"],
    audience: ["solo", "freelancer", "internal"],
    tasks: [
      { title: "Define top 3 goals", status: "in_progress", priority: "high" },
      { title: "Break each goal into key results", status: "todo", priority: "high" },
      { title: "Weekly progress check-in", status: "todo", priority: "medium" },
      { title: "End-of-quarter review", status: "todo", priority: "medium" },
    ],
  },
  {
    key: "home",
    name: "Home & life",
    description: "Errands, home projects, health, travel.",
    icon: HomeIcon,
    color: "#f59e0b",
    category: "personal",
    projectName: "Home & life",
    audience: ["solo"],
    tasks: [
      { title: "Schedule annual checkup", status: "todo", priority: "medium" },
      { title: "Plan weekend trip", status: "in_progress", priority: "low" },
      { title: "Fix leaky kitchen faucet", status: "todo", priority: "medium" },
      { title: "Renew car registration", status: "todo", priority: "high" },
    ],
  },

  // ── Ops ───────────────────────────────────────────────────────────
  {
    key: "hiring",
    name: "Hiring pipeline",
    description: "Applied → Phone screen → Onsite → Offer.",
    icon: Users,
    color: "#22c55e",
    category: "ops",
    projectName: "Hiring",
    audience: ["agency", "internal"],
    tasks: [
      { title: "Draft job description", status: "in_progress", priority: "high" },
      { title: "Screen 5 candidates", status: "todo", priority: "high" },
      { title: "Onsite: Jamie R.", status: "todo", priority: "medium" },
      { title: "Send offer: Priya P.", status: "review", priority: "high" },
    ],
  },
  {
    key: "event",
    name: "Event planning",
    description: "Venue, speakers, marketing, day-of run sheet.",
    icon: PartyPopper,
    color: "#f43f5e",
    category: "ops",
    projectName: "Event",
    audience: ["freelancer", "agency", "internal"],
    tasks: [
      { title: "Lock venue + date", status: "in_progress", priority: "urgent" },
      { title: "Confirm speakers", status: "in_progress", priority: "high" },
      { title: "Open registration", status: "todo", priority: "high" },
      { title: "Build run-of-show", status: "todo", priority: "medium" },
      { title: "Day-of staffing", status: "todo", priority: "high" },
    ],
  },
];

export function getTemplate(key: string): OnboardingTemplate | undefined {
  return ONBOARDING_TEMPLATES.find((t) => t.key === key);
}

/** Default templates suggested for each onboarding audience choice. */
export const DEFAULT_TEMPLATES_BY_AUDIENCE: Record<
  "solo" | "freelancer" | "agency" | "internal",
  OnboardingTemplateKey[]
> = {
  solo: ["personal", "goals"],
  freelancer: ["client_onboarding", "sales_pipeline"],
  agency: ["client_onboarding", "sales_pipeline", "retainer"],
  internal: ["sprint", "roadmap"],
};
