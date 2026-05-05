import {
  Briefcase,
  Code2,
  ShoppingBag,
  Users,
  Sparkles,
  Scale,
  type LucideIcon,
} from "lucide-react";

export type PresetDivisionType = "delivery" | "operations" | "sales" | "custom";

export interface PresetFolderSpec {
  name: string;
  folder_type?: "client" | "portfolio" | "project" | "phase" | "generic";
  description?: string;
  color?: string;
  children?: PresetFolderSpec[];
}

export interface PresetDivisionSpec {
  name: string;
  slug: string;
  icon: string;
  color: string;
  division_type: PresetDivisionType;
  folders?: PresetFolderSpec[];
}

export interface WorkspacePreset {
  key: string;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  accentColor: string;
  /** Divisions to seed. Default ones (delivery/ops/sales slugs) are merged on conflict. */
  divisions: PresetDivisionSpec[];
}

export const WORKSPACE_PRESETS: WorkspacePreset[] = [
  {
    key: "blank",
    name: "Blank workspace",
    tagline: "Start from zero",
    description:
      "Just the default Delivery / Ops / Sales divisions — add what you need as you go.",
    icon: Sparkles,
    accentColor: "#94a3b8",
    divisions: [],
  },
  {
    key: "agency",
    name: "Agency",
    tagline: "Clients, retainers, project delivery",
    description:
      "Pre-built client roster, retainers, and a sales pipeline. Great for design / dev / marketing shops.",
    icon: Briefcase,
    accentColor: "#8b5cf6",
    divisions: [
      {
        name: "Delivery",
        slug: "delivery",
        icon: "briefcase",
        color: "#8b5cf6",
        division_type: "delivery",
        folders: [
          {
            name: "Clients",
            folder_type: "portfolio",
            color: "#8b5cf6",
            children: [
              { name: "Acme Co.", folder_type: "client" },
              { name: "Globex", folder_type: "client" },
            ],
          },
          { name: "Retainers", folder_type: "portfolio", color: "#22c55e" },
          { name: "One-off projects", folder_type: "portfolio", color: "#f59e0b" },
        ],
      },
      {
        name: "Ops",
        slug: "ops",
        icon: "settings-2",
        color: "#10b981",
        division_type: "operations",
        folders: [
          { name: "Internal", folder_type: "generic" },
          { name: "Hiring", folder_type: "generic" },
          { name: "Finance", folder_type: "generic" },
        ],
      },
      {
        name: "Sales",
        slug: "sales",
        icon: "trending-up",
        color: "#f59e0b",
        division_type: "sales",
        folders: [
          { name: "Pipeline", folder_type: "portfolio" },
          { name: "Proposals", folder_type: "generic" },
        ],
      },
    ],
  },
  {
    key: "software",
    name: "Software team",
    tagline: "Product, sprints, infra",
    description:
      "Engineering + Product divisions seeded with phases (Discovery → Build → Ship) and a backlog folder.",
    icon: Code2,
    accentColor: "#3b82f6",
    divisions: [
      {
        name: "Product",
        slug: "delivery",
        icon: "layers",
        color: "#3b82f6",
        division_type: "delivery",
        folders: [
          {
            name: "Active",
            folder_type: "portfolio",
            children: [
              { name: "Discovery", folder_type: "phase" },
              { name: "In build", folder_type: "phase" },
              { name: "Shipping", folder_type: "phase" },
            ],
          },
          { name: "Backlog", folder_type: "generic" },
          { name: "Roadmap", folder_type: "generic" },
        ],
      },
      {
        name: "Ops",
        slug: "ops",
        icon: "settings-2",
        color: "#10b981",
        division_type: "operations",
        folders: [
          { name: "Infra & SRE", folder_type: "generic" },
          { name: "Security", folder_type: "generic" },
        ],
      },
      {
        name: "Growth",
        slug: "sales",
        icon: "trending-up",
        color: "#ec4899",
        division_type: "sales",
        folders: [
          { name: "Pipeline", folder_type: "portfolio" },
          { name: "Partnerships", folder_type: "generic" },
        ],
      },
    ],
  },
  {
    key: "consulting",
    name: "Consulting",
    tagline: "Engagements, deliverables, BD",
    description:
      "Engagement-style folders, deliverables tracking, and a business-development pipeline.",
    icon: Scale,
    accentColor: "#0ea5e9",
    divisions: [
      {
        name: "Engagements",
        slug: "delivery",
        icon: "briefcase",
        color: "#0ea5e9",
        division_type: "delivery",
        folders: [
          {
            name: "Active engagements",
            folder_type: "portfolio",
            children: [
              { name: "Acme — Strategy", folder_type: "client" },
              { name: "Globex — Audit", folder_type: "client" },
            ],
          },
          { name: "Deliverables library", folder_type: "generic" },
          { name: "Past engagements", folder_type: "portfolio" },
        ],
      },
      {
        name: "Practice ops",
        slug: "ops",
        icon: "settings-2",
        color: "#10b981",
        division_type: "operations",
        folders: [
          { name: "Knowledge base", folder_type: "generic" },
          { name: "Templates", folder_type: "generic" },
        ],
      },
      {
        name: "Business dev",
        slug: "sales",
        icon: "trending-up",
        color: "#f59e0b",
        division_type: "sales",
        folders: [
          { name: "Pipeline", folder_type: "portfolio" },
          { name: "RFPs", folder_type: "generic" },
        ],
      },
    ],
  },
  {
    key: "shop",
    name: "Shop / e-commerce",
    tagline: "Catalog, ops, marketing",
    description:
      "Merchandising, fulfillment ops, and marketing campaigns ready to go.",
    icon: ShoppingBag,
    accentColor: "#f43f5e",
    divisions: [
      {
        name: "Merchandising",
        slug: "delivery",
        icon: "shopping-bag",
        color: "#f43f5e",
        division_type: "delivery",
        folders: [
          { name: "Collections", folder_type: "portfolio" },
          { name: "Launches", folder_type: "portfolio" },
          { name: "Vendor management", folder_type: "generic" },
        ],
      },
      {
        name: "Operations",
        slug: "ops",
        icon: "settings-2",
        color: "#10b981",
        division_type: "operations",
        folders: [
          { name: "Fulfillment", folder_type: "generic" },
          { name: "Customer support", folder_type: "generic" },
        ],
      },
      {
        name: "Marketing",
        slug: "sales",
        icon: "trending-up",
        color: "#a855f7",
        division_type: "sales",
        folders: [
          { name: "Campaigns", folder_type: "portfolio" },
          { name: "Influencers", folder_type: "generic" },
        ],
      },
    ],
  },
  {
    key: "personal",
    name: "Personal / solo",
    tagline: "Life + work in one place",
    description: "Lightweight setup for individuals: Work, Personal, and Side projects.",
    icon: Users,
    accentColor: "#22c55e",
    divisions: [
      {
        name: "Work",
        slug: "delivery",
        icon: "briefcase",
        color: "#22c55e",
        division_type: "delivery",
        folders: [{ name: "Active", folder_type: "portfolio" }],
      },
      {
        name: "Personal",
        slug: "ops",
        icon: "heart",
        color: "#ec4899",
        division_type: "operations",
        folders: [
          { name: "Home", folder_type: "generic" },
          { name: "Health", folder_type: "generic" },
        ],
      },
      {
        name: "Side projects",
        slug: "sales",
        icon: "sparkles",
        color: "#f59e0b",
        division_type: "custom",
        folders: [{ name: "Ideas", folder_type: "generic" }],
      },
    ],
  },
];

export function getPreset(key: string): WorkspacePreset | undefined {
  return WORKSPACE_PRESETS.find((p) => p.key === key);
}
