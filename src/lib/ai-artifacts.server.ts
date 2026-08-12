import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ARTIFACT_KINDS = [
  "sow",
  "project_plan",
  "meeting_summary",
  "risk_assessment",
  "email_draft",
  "proposal",
  "status_report",
  "phase_kickoff",
  "insight",
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export async function assertAccountAccess(accountId: string, userId: string): Promise<string> {
  const { data: account } = await supabaseAdmin
    .from("client_accounts")
    .select("workspace_id")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) throw new Error("Account not found");
  const { data: member } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", account.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) throw new Error("Not a workspace member");
  return account.workspace_id;
}

export async function assemblePromptPack(input: {
  accountId: string;
  kind: ArtifactKind;
  projectId?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  userInstruction?: string;
}) {
  const [{ data: account }, projects, deals, artifacts, pulse] = await Promise.all([
    supabaseAdmin
      .from("client_accounts")
      .select("id, name, tier, status, industry, size")
      .eq("id", input.accountId)
      .single(),
    supabaseAdmin
      .from("projects")
      .select("id, name, phase, lifecycle, template_id, current_phase_id")
      .eq("client_account_id", input.accountId)
      .eq("is_archived", false),
    supabaseAdmin
      .from("deals")
      .select("id, title, value, currency, status, expected_close_date")
      .eq("client_account_id", input.accountId)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("ai_artifacts")
      .select("kind, title, status, created_at")
      .eq("client_account_id", input.accountId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("client_portal_pulse")
      .select("last_activity_at, engagement_score, open_client_tasks")
      .eq("client_account_id", input.accountId)
      .maybeSingle(),
  ]);

  const contacts = await supabaseAdmin
    .from("client_account_contacts")
    .select("role, is_primary, contact_id, contacts:contact_id(name, title, email)")
    .eq("client_account_id", input.accountId)
    .limit(10);

  let project: Record<string, unknown> | null = null;
  let templateContext: Record<string, unknown> | null = null;
  if (input.projectId) {
    const { data: p } = await supabaseAdmin
      .from("projects")
      .select("id, name, phase, lifecycle, template_id, current_phase_id, target_end_date")
      .eq("id", input.projectId)
      .maybeSingle();
    project = (p as unknown as Record<string, unknown>) ?? null;
    if (p?.template_id) {
      const { data: tmpl } = await supabaseAdmin
        .from("project_templates")
        .select("id, name")
        .eq("id", p.template_id)
        .maybeSingle();
      const { data: phases } = await supabaseAdmin
        .from("template_phases")
        .select("key, name, order_index")
        .eq("template_id", p.template_id)
        .order("order_index");
      templateContext = { template: tmpl, phases };
    }
  }

  let deal: Record<string, unknown> | null = null;
  if (input.dealId) {
    const { data: d } = await supabaseAdmin
      .from("deals")
      .select("id, title, value, currency, status, description, expected_close_date")
      .eq("id", input.dealId)
      .maybeSingle();
    deal = (d as unknown as Record<string, unknown>) ?? null;
  }

  return {
    generation_type: input.kind,
    target_object: input.projectId
      ? { type: "project", id: input.projectId }
      : input.dealId
        ? { type: "deal", id: input.dealId }
        : { type: "client", id: input.accountId },
    client_context: {
      ...(account ?? {}),
      active_projects: (projects.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        phase: p.phase,
        lifecycle: p.lifecycle,
      })),
      open_deals: (deals.data ?? []).filter((d) => d.status === "open"),
      contacts: (contacts.data ?? []).map(
        (c) =>
          c.contacts && {
            name: (c.contacts as { name?: string }).name,
            role: c.role,
            primary: c.is_primary,
          },
      ),
    },
    target_project: project,
    target_deal: deal,
    template_context: templateContext,
    historical_artifacts: artifacts.data ?? [],
    portal_signals: pulse ?? null,
    user_instruction: input.userInstruction ?? null,
  };
}

export const SYSTEM_PROMPTS: Record<ArtifactKind, string> = {
  sow: "Generate a Statement of Work in markdown. Include: Scope, Deliverables, Timeline, Team, Investment, Assumptions, Out of Scope. Reference past project context.",
  project_plan: "Generate a phased project plan in markdown with phases, milestones, deliverables, and ownership.",
  meeting_summary:
    "Synthesize a meeting summary in markdown: Key Decisions, Action Items (with owners), Open Questions, Next Steps.",
  risk_assessment:
    "Produce a risk assessment in markdown: top 5-8 risks with likelihood, impact, and mitigation.",
  email_draft:
    "Draft a professional client email. Plain text. Include subject line as first line prefixed 'Subject: '.",
  proposal: "Generate a client proposal in markdown: Problem, Approach, Phases, Investment, Why Us.",
  status_report: "Generate a weekly status report in markdown: Progress, Risks, Blockers, Next Week, Asks.",
  phase_kickoff:
    "Generate a phase kickoff brief in markdown: Phase Goals, Deliverables, Team, Timeline, Risks, Client Expectations.",
  insight:
    "Surface a single concise insight about this client. One paragraph plain text. Be specific and actionable.",
};

export { supabaseAdmin, createHash };
