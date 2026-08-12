import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_MODEL } from "@/server/ai-models";

async function authedUserId(): Promise<string | null> {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

async function getApiKey(workspaceId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("workspace_ai_secrets")
    .select("openrouter_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data?.openrouter_api_key ?? null;
}

interface ProposalDraft {
  title: string;
  summary: string;
  scope: string;
  deliverables: { name: string; description?: string }[];
  milestones: { name: string; target_offset_days: number; description?: string }[];
  pricing: { line_items: { name: string; amount: number }[]; notes?: string };
  total_value: number;
  currency: string;
}

/* -------------------------------- AI generation ------------------------------- */

export const generateProposal = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      workspaceId: z.string().uuid(),
      dealId: z.string().uuid().optional(),
      prompt: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) throw new Error("Not authenticated");

    const apiKey = await getApiKey(data.workspaceId);
    if (!apiKey) throw new Error("OpenRouter API key not configured for this workspace");

    let dealCtx = "";
    if (data.dealId) {
      const { data: deal } = await supabaseAdmin
        .from("deals" as never)
        .select("title,description,value,currency,expected_close_date")
        .eq("id", data.dealId)
        .maybeSingle();
      if (deal) {
        dealCtx = `\nLinked deal: ${JSON.stringify(deal)}`;
      }
    }

    const systemPrompt = `You are a proposal-writing assistant for an agency / consultancy.
Return STRICT JSON matching this TypeScript shape — no markdown, no commentary:
{
  "title": string,
  "summary": string,           // 2-3 sentence executive summary
  "scope": string,             // markdown describing project scope
  "deliverables": [{"name": string, "description"?: string}],
  "milestones": [{"name": string, "target_offset_days": number, "description"?: string}],
  "pricing": {"line_items": [{"name": string, "amount": number}], "notes"?: string},
  "total_value": number,       // sum of line items
  "currency": "USD" | "EUR" | "GBP" | "CAD" | "AUD"
}
Keep deliverables/milestones realistic (3-7 items each). target_offset_days is days from project start.`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/zenifold/aurora-os",
        "X-Title": "Aurora Proposal Generator",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.4,
        max_tokens: 3000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${data.prompt}${dealCtx}` },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`AI request failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const txt = json.choices?.[0]?.message?.content ?? "{}";
    let draft: ProposalDraft;
    try {
      draft = JSON.parse(txt) as ProposalDraft;
    } catch {
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI did not return valid JSON");
      draft = JSON.parse(m[0]) as ProposalDraft;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("proposals" as never)
      .insert({
        workspace_id: data.workspaceId,
        deal_id: data.dealId ?? null,
        title: draft.title || "Untitled proposal",
        summary: draft.summary ?? null,
        scope: draft.scope ?? null,
        deliverables: draft.deliverables ?? [],
        milestones: draft.milestones ?? [],
        pricing: draft.pricing ?? {},
        total_value: draft.total_value ?? null,
        currency: draft.currency || "USD",
        status: "draft",
        generated_by_ai: true,
        ai_prompt: data.prompt,
        ai_model: DEFAULT_MODEL,
        created_by: userId,
      } as never)
      .select()
      .single();
    if (error) throw error;
    return inserted as { id: string };
  });

/* --------------------------- Convert to project ---------------------------- */

export const convertProposalToProject = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      proposalId: z.string().uuid(),
      startDate: z.string().optional(),
      targetWorkspaceId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) throw new Error("Not authenticated");

    const { data: p, error: pErr } = await supabaseAdmin
      .from("proposals" as never)
      .select("*")
      .eq("id", data.proposalId)
      .single();
    if (pErr || !p) throw new Error("Proposal not found");
    const proposal = p as {
      id: string;
      workspace_id: string;
      deal_id: string | null;
      title: string;
      summary: string | null;
      scope: string | null;
      deliverables: { name: string; description?: string }[];
      milestones: { name: string; target_offset_days: number; description?: string }[];
      pricing: { line_items?: { name: string; amount: number }[]; notes?: string };
      total_value: number | null;
      currency: string;
      converted_project_id: string | null;
    };

    if (proposal.converted_project_id) {
      return { projectId: proposal.converted_project_id, alreadyConverted: true };
    }

    const targetWs = data.targetWorkspaceId ?? proposal.workspace_id;
    const startDate = data.startDate ?? new Date().toISOString().slice(0, 10);

    // Optional: pull client name from deal -> contact
    let clientName: string | null = null;
    if (proposal.deal_id) {
      const { data: deal } = await supabaseAdmin
        .from("deals" as never)
        .select("contact_id")
        .eq("id", proposal.deal_id)
        .maybeSingle();
      const contactId = (deal as { contact_id?: string | null } | null)?.contact_id;
      if (contactId) {
        const { data: contact } = await supabaseAdmin
          .from("contacts" as never)
          .select("company,name")
          .eq("id", contactId)
          .maybeSingle();
        const c = contact as { company?: string | null; name?: string | null } | null;
        clientName = c?.company || c?.name || null;
      }
    }

    // 1. Create project
    const { data: proj, error: projErr } = await supabaseAdmin
      .from("projects")
      .insert({
        workspace_id: targetWs,
        name: proposal.title,
        color: "#10b981",
        icon: "rocket",
        created_by: userId,
        description: proposal.summary ?? `Auto-created from proposal`,
        is_client_project: !!clientName,
        client_name: clientName,
        phase: "discovery",
        health: "on_track",
        contract_type: "fixed",
        start_date: startDate,
      } as never)
      .select()
      .single();
    if (projErr || !proj) throw projErr ?? new Error("Failed to create project");
    const project = proj as { id: string };

    // 2. Default view
    await supabaseAdmin.from("views").insert({
      workspace_id: targetWs,
      project_id: project.id,
      name: "All tasks",
      view_type: "table",
      is_default: true,
      config: {},
      filters: [],
      sorts: [],
      created_by: userId,
    } as never);

    // 3. Financials
    if (proposal.total_value) {
      await supabaseAdmin.from("project_financials" as never).insert({
        project_id: project.id,
        workspace_id: targetWs,
        contract_value: proposal.total_value,
        currency: proposal.currency,
      } as never);
    }

    // 4. Milestones
    const start = new Date(startDate);
    const milestoneRows = (proposal.milestones ?? []).map((m, idx) => {
      const target = new Date(start);
      target.setDate(target.getDate() + (m.target_offset_days ?? 0));
      return {
        workspace_id: targetWs,
        project_id: project.id,
        name: m.name,
        milestone_type: "delivery",
        status: "upcoming",
        target_date: target.toISOString().slice(0, 10),
        order_index: idx,
        description: m.description ?? null,
        created_by: userId,
      };
    });
    if (milestoneRows.length) {
      await supabaseAdmin.from("milestones" as never).insert(milestoneRows as never);
    }

    // 5. Deliverables -> tasks
    const taskRows = (proposal.deliverables ?? []).map((d, idx) => ({
      workspace_id: targetWs,
      project_id: project.id,
      title: d.name,
      description: d.description ?? null,
      status: "todo",
      priority: "medium",
      assignee_ids: [],
      custom_values: {},
      tags: ["deliverable"],
      position: idx,
      created_by: userId,
    }));
    if (taskRows.length) {
      await supabaseAdmin.from("tasks").insert(taskRows as never);
    }

    // 6. Mark proposal converted
    await supabaseAdmin
      .from("proposals" as never)
      .update({
        status: "converted",
        converted_at: new Date().toISOString(),
        converted_project_id: project.id,
      } as never)
      .eq("id", proposal.id);

    // 7. If linked to a deal, mark deal handed off
    if (proposal.deal_id) {
      await supabaseAdmin
        .from("deals" as never)
        .update({
          handed_off_project_id: project.id,
          handed_off_at: new Date().toISOString(),
        } as never)
        .eq("id", proposal.deal_id);
    }

    return { projectId: project.id, alreadyConverted: false };
  });
