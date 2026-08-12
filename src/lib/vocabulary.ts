// Workspace-level terminology customization.
// Stored on workspaces.settings.vocabulary jsonb.

export type VocabNoun = { singular: string; plural: string };
export type Vocabulary = {
  customer: VocabNoun;
  contact: VocabNoun;
  opportunity: VocabNoun;
  engagement: VocabNoun;
  phase: VocabNoun;
};

export const DEFAULT_VOCABULARY: Vocabulary = {
  customer: { singular: "Client", plural: "Clients" },
  contact: { singular: "Contact", plural: "Contacts" },
  opportunity: { singular: "Opportunity", plural: "Opportunities" },
  engagement: { singular: "Project", plural: "Projects" },
  phase: { singular: "Phase", plural: "Phases" },
};

export const CUSTOMER_PRESETS: VocabNoun[] = [
  { singular: "Client", plural: "Clients" },
  { singular: "Customer", plural: "Customers" },
  { singular: "Account", plural: "Accounts" },
  { singular: "Patient", plural: "Patients" },
  { singular: "Member", plural: "Members" },
  { singular: "Tenant", plural: "Tenants" },
];

export const CONTACT_PRESETS: VocabNoun[] = [
  { singular: "Contact", plural: "Contacts" },
  { singular: "Person", plural: "People" },
  { singular: "Stakeholder", plural: "Stakeholders" },
  { singular: "Lead", plural: "Leads" },
  { singular: "Decision Maker", plural: "Decision Makers" },
];

export const OPPORTUNITY_PRESETS: VocabNoun[] = [
  { singular: "Opportunity", plural: "Opportunities" },
  { singular: "Deal", plural: "Deals" },
  { singular: "Pursuit", plural: "Pursuits" },
  { singular: "Pipeline Item", plural: "Pipeline" },
  { singular: "Case", plural: "Cases" },
  { singular: "Bid", plural: "Bids" },
];

export const ENGAGEMENT_PRESETS: VocabNoun[] = [
  { singular: "Project", plural: "Projects" },
  { singular: "Engagement", plural: "Engagements" },
  { singular: "Contract", plural: "Contracts" },
  { singular: "Matter", plural: "Matters" },
  { singular: "Case", plural: "Cases" },
  { singular: "Retainer", plural: "Retainers" },
  { singular: "Job", plural: "Jobs" },
  { singular: "Build", plural: "Builds" },
];

export const PHASE_PRESETS: VocabNoun[] = [
  { singular: "Phase", plural: "Phases" },
  { singular: "Stage", plural: "Stages" },
  { singular: "Step", plural: "Steps" },
  { singular: "Sprint", plural: "Sprints" },
  { singular: "Module", plural: "Modules" },
];

export function mergeVocabulary(raw: unknown): Vocabulary {
  const r = (raw ?? {}) as Partial<Vocabulary>;
  const pick = (key: keyof Vocabulary): VocabNoun => {
    const v = r[key];
    if (v && typeof v.singular === "string" && typeof v.plural === "string" && v.singular.trim() && v.plural.trim()) {
      return { singular: v.singular.trim(), plural: v.plural.trim() };
    }
    return DEFAULT_VOCABULARY[key];
  };
  return {
    customer: pick("customer"),
    contact: pick("contact"),
    opportunity: pick("opportunity"),
    engagement: pick("engagement"),
    phase: pick("phase"),
  };
}

// Role presets for contacts on a specific deal/opportunity.
export const DEAL_CONTACT_ROLES = [
  { value: "champion", label: "Champion" },
  { value: "decision_maker", label: "Decision Maker" },
  { value: "influencer", label: "Influencer" },
  { value: "end_user", label: "End User" },
  { value: "blocker", label: "Blocker" },
  { value: "legal", label: "Legal" },
  { value: "finance", label: "Finance / Procurement" },
  { value: "technical", label: "Technical" },
  { value: "other", label: "Other" },
] as const;

export const DEPARTMENT_PRESETS = [
  "Executive",
  "Engineering",
  "Product",
  "Sales",
  "Marketing",
  "Operations",
  "Finance",
  "Legal",
  "HR",
  "IT",
  "Procurement",
  "Customer Success",
] as const;
