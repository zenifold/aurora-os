import type { OnboardingTemplate } from "./onboarding-templates";

export interface SeedDemoResult {
  /** Project id to navigate to after onboarding completes. */
  primaryProjectId: string | null;
  projectsCreated: number;
  tasksCreated: number;
  extras: string[];
}

/**
 * Intentionally a no-op.
 *
 * Onboarding no longer seeds demo clients, contacts, deals, proposals, SOWs,
 * pages, notes, or sample projects. New workspaces start empty so users build
 * their own structure. The signature is kept so callers in `onboarding.tsx`
 * don't need to change.
 */
export async function seedDemoDataForTemplates(
  _workspaceId: string,
  _userId: string,
  _templates: OnboardingTemplate[],
): Promise<SeedDemoResult> {
  return {
    primaryProjectId: null,
    projectsCreated: 0,
    tasksCreated: 0,
    extras: [],
  };
}
