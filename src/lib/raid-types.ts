export type RaidItemType = "risk" | "assumption" | "issue" | "decision";
export type RaidImpact = "low" | "medium" | "high" | "critical";
export type RaidLikelihood = "unlikely" | "possible" | "likely" | "almost_certain";
export type RaidStatus = "open" | "monitoring" | "mitigated" | "closed" | "accepted" | "rejected";

export interface RaidItem {
  id: string;
  workspace_id: string;
  project_id: string;
  item_type: RaidItemType;
  title: string;
  description: string | null;
  owner_id: string | null;
  impact: RaidImpact | null;
  likelihood: RaidLikelihood | null;
  status: RaidStatus;
  mitigation: string | null;
  due_date: string | null;
  decided_at: string | null;
  decided_by: string | null;
  tags: string[];
  is_client_visible: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const RAID_TYPE_META: Record<
  RaidItemType,
  { label: string; plural: string; tone: string; icon: string }
> = {
  risk: {
    label: "Risk",
    plural: "Risks",
    tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    icon: "AlertTriangle",
  },
  assumption: {
    label: "Assumption",
    plural: "Assumptions",
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    icon: "HelpCircle",
  },
  issue: {
    label: "Issue",
    plural: "Issues",
    tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    icon: "AlertCircle",
  },
  decision: {
    label: "Decision",
    plural: "Decisions",
    tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    icon: "Gavel",
  },
};

export const RAID_IMPACT_META: Record<RaidImpact, { label: string; tone: string; score: number }> = {
  low: { label: "Low", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", score: 1 },
  medium: { label: "Medium", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400", score: 2 },
  high: { label: "High", tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400", score: 3 },
  critical: { label: "Critical", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400", score: 4 },
};

export const RAID_LIKELIHOOD_META: Record<
  RaidLikelihood,
  { label: string; score: number }
> = {
  unlikely: { label: "Unlikely", score: 1 },
  possible: { label: "Possible", score: 2 },
  likely: { label: "Likely", score: 3 },
  almost_certain: { label: "Almost certain", score: 4 },
};

export const RAID_STATUS_META: Record<RaidStatus, { label: string; tone: string }> = {
  open: { label: "Open", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  monitoring: { label: "Monitoring", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  mitigated: { label: "Mitigated", tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  closed: { label: "Closed", tone: "bg-muted text-muted-foreground" },
  accepted: { label: "Accepted", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "Rejected", tone: "bg-muted text-muted-foreground" },
};

/** Risk score = impact × likelihood, 0..16. */
export function raidRiskScore(item: Pick<RaidItem, "impact" | "likelihood">): number {
  if (!item.impact || !item.likelihood) return 0;
  return RAID_IMPACT_META[item.impact].score * RAID_LIKELIHOOD_META[item.likelihood].score;
}

export function raidScoreTone(score: number): string {
  if (score >= 12) return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
  if (score >= 8) return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
  if (score >= 4) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (score > 0) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  return "bg-muted text-muted-foreground";
}
