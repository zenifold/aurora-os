/**
 * Persona-aware post-onboarding welcome tour.
 *
 * After the onboarding flow creates a blank workspace, we drop
 * a "tour plan" into localStorage. The `<WelcomeTour />` component (mounted
 * inside the app shell) reads this plan, shows a welcome modal, then a
 * floating checklist that walks the user through the core product surfaces.
 *
 * The plan is workspace-scoped — switching workspaces won't replay it.
 */

const STORAGE_KEY = "aurora.welcome_tour";

export type WelcomeAudience = "solo" | "freelancer" | "agency" | "internal";

export interface WelcomeTourPlan {
  v: 1;
  workspaceId: string;
  audience: WelcomeAudience;
  primaryProjectId: string | null;
  has: {
    clients: boolean;
    deals: boolean;
    proposal: boolean;
    sow: boolean;
    page: boolean;
    note: boolean;
  };
  /** Step ids the user has completed (or skipped). */
  completed: string[];
  /** True once dismissed — UI hides until manually relaunched. */
  dismissed: boolean;
  createdAt: number;
}

export function loadTourPlan(): WelcomeTourPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WelcomeTourPlan;
    if (parsed?.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveTourPlan(plan: WelcomeTourPlan) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    /* ignore quota */
  }
}

export function clearTourPlan() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function createTourPlan(input: {
  workspaceId: string;
  audience: WelcomeAudience;
  primaryProjectId: string | null;
  seedTags: ReadonlyArray<string>;
}): WelcomeTourPlan {
  const tags = new Set(input.seedTags);
  return {
    v: 1,
    workspaceId: input.workspaceId,
    audience: input.audience,
    primaryProjectId: input.primaryProjectId,
    has: {
      clients: true,
      deals: tags.has("crm"),
      proposal: tags.has("proposal"),
      sow: tags.has("sow"),
      page: tags.has("page"),
      note: tags.has("note"),
    },
    completed: [],
    dismissed: false,
    createdAt: Date.now(),
  };
}

export const AUDIENCE_COPY: Record<
  WelcomeAudience,
  { headline: string; subhead: string }
> = {
  solo: {
    headline: "Your workspace is ready",
    subhead:
      "Start from a clean slate and use the tour to learn the core flow when you're ready.",
  },
  freelancer: {
    headline: "Welcome to your client HQ",
    subhead:
      "Your workspace is blank and ready for your real clients. Want a 60-second tour first?",
  },
  agency: {
    headline: "Your agency cockpit is live",
    subhead:
      "Your workspace is blank and ready for your team. Let's walk through the essentials.",
  },
  internal: {
    headline: "Your team workspace is ready",
    subhead:
      "Start clean, then add the real work your team needs. Quick tour of how everything connects?",
  },
};
