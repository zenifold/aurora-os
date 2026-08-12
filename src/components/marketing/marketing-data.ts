import {
  Briefcase, Code2, Users, User, Globe2, Building2,
  Kanban, GitBranch, Mic, Bot, Share2, FileText, LayoutGrid, Shield, DollarSign,
  Rocket, Settings2, ClipboardList, Receipt, Headset,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const USE_CASES: NavItem[] = [
  { to: "/use-cases/agencies", title: "Digital agencies", description: "Replace Jira + Notion + HubSpot with one company OS.", icon: Briefcase },
  { to: "/use-cases/software-delivery", title: "Software delivery teams", description: "Sprints, RAID, releases, and client-ready status reports.", icon: Code2 },
  { to: "/use-cases/consulting", title: "Consulting firms", description: "Engagements, deliverables, time and margin in one place.", icon: Building2 },
  { to: "/use-cases/freelancers", title: "Freelancers & studios", description: "Proposals, projects and invoices without 6 tabs open.", icon: User },
  { to: "/use-cases/client-portals", title: "Client portals", description: "Branded portals where clients see exactly what you choose.", icon: Globe2 },
  { to: "/use-cases/professional-services", title: "Professional services", description: "Run ProServ inside your SaaS without bolting on tools.", icon: Users },
];

export const FEATURES: NavItem[] = [
  { to: "/features/projects", title: "Projects & delivery", description: "Sprints, milestones, RAID, change orders — built for delivery work.", icon: Kanban },
  { to: "/features/crm", title: "CRM & pipeline", description: "Accounts, contacts, deals and forecasting — opinionated and lean.", icon: GitBranch },
  { to: "/features/finance", title: "Finance", description: "Invoices, expenses, budgets and revenue recognition.", icon: DollarSign },
  { to: "/features/meetings-ai", title: "Meetings AI", description: "Capture, summarize and turn every meeting into action.", icon: Mic },
  { to: "/features/agents", title: "Aurora agents", description: "Background AI workers that watch your data and act.", icon: Bot },
  { to: "/features/client-portals", title: "Client portals", description: "Branded portals + scoped guest access for external collaborators.", icon: Share2 },
  { to: "/features/docs-and-notes", title: "Docs & notes", description: "Pages, notes and knowledge — searchable across the workspace.", icon: FileText },
  { to: "/features/views", title: "Views", description: "Table, kanban, timeline, canvas — same data, every shape.", icon: LayoutGrid },
  { to: "/features/permissions-rbac", title: "Permissions & RBAC", description: "Roles, custom roles, audit log, sharing controls.", icon: Shield },
];

export const ROLES: NavItem[] = [
  { to: "/for/founders", title: "Founders", description: "See sales, delivery and cash in one screen.", icon: Rocket },
  { to: "/for/operations", title: "Operations", description: "Standard operating processes everyone actually follows.", icon: Settings2 },
  { to: "/for/project-managers", title: "Project managers", description: "Run delivery, stay on margin, keep clients honest.", icon: ClipboardList },
  { to: "/for/finance", title: "Finance", description: "From signed deal to invoice without re-keying.", icon: Receipt },
  { to: "/for/client-services", title: "Client services", description: "Be the calm, prepared face of every account.", icon: Headset },
];

export const COMPARISONS: NavItem[] = [
  { to: "/vs/jira", title: "vs Jira", description: "Sprints and roadmaps without the configuration tax.", icon: Code2 },
  { to: "/vs/notion", title: "vs Notion", description: "Docs and data with real schemas and ownership.", icon: FileText },
  { to: "/vs/linear", title: "vs Linear", description: "Linear-grade speed across the whole company, not just engineering.", icon: GitBranch },
  { to: "/vs/hubspot", title: "vs HubSpot", description: "CRM that lives next to delivery, not in a silo.", icon: Globe2 },
  { to: "/vs/monday", title: "vs Monday", description: "Real project work without the dashboard sprawl.", icon: Kanban },
];
