import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveOpenRouterKey } from "@/server/openrouter-key.server";

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

// ---------- Generate ----------
export const generateArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        accountId: z.string().uuid(),
        kind: z.enum(ARTIFACT_KINDS),
        title: z.string().min(1).max(200),
        projectId: z.string().uuid().optional().nullable(),
        dealId: z.string().uuid().optional().nullable(),
        contactId: z.string().uuid().optional().nullable(),
        userInstruction: z.string().max(2000).optional(),
        triggerSource: z.enum(["manual", "event", "scheduled"]).default("manual"),
        parentArtifactId: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const {
      assertAccountAccess,
      assemblePromptPack,
      supabaseAdmin,
      SYSTEM_PROMPTS,
      createHash,
    } = await import("./ai-artifacts.server");

    const workspaceId = await assertAccountAccess(data.accountId, context.userId);

    const pack = await assemblePromptPack({
      accountId: data.accountId,
      kind: data.kind,
      projectId: data.projectId,
      dealId: data.dealId,
      contactId: data.contactId,
      userInstruction: data.userInstruction,
    });

    const apiKey = await resolveOpenRouterKey(workspaceId);
    let content = "(AI gateway not configured — placeholder content)";
    let model = "placeholder";
    let cost = 0;

    if (apiKey) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPTS[data.kind] },
              {
                role: "user",
                content: `Context (JSON):\n${JSON.stringify(pack, null, 2)}\n\nProduce the artifact now.`,
              },
            ],
            temperature: 0.5,
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
            usage?: { total_tokens?: number };
          };
          content = body.choices?.[0]?.message?.content ?? content;
          model = "google/gemini-2.5-flash";
          cost = body.usage?.total_tokens ?? 0;
        } else if (res.status === 429) {
          throw new Error("AI rate limit — try again shortly.");
        } else if (res.status === 402) {
          throw new Error("AI credits exhausted. Add credits in Settings → Usage.");
        } else {
          const t = await res.text();
          throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
        }
      } catch (e) {
        if (e instanceof Error) throw e;
        throw new Error("AI generation failed");
      }
    }

    let version = 1;
    if (data.parentArtifactId) {
      const { data: parent } = await supabaseAdmin
        .from("ai_artifacts")
        .select("version_number")
        .eq("id", data.parentArtifactId)
        .maybeSingle();
      version = (parent?.version_number ?? 1) + 1;
    }

    const hash = createHash("sha256").update(JSON.stringify(pack)).digest("hex").slice(0, 32);

    const { data: artifact, error } = await supabaseAdmin
      .from("ai_artifacts")
      .insert({
        workspace_id: workspaceId,
        client_account_id: data.accountId,
        project_id: data.projectId ?? null,
        deal_id: data.dealId ?? null,
        contact_id: data.contactId ?? null,
        kind: data.kind,
        title: data.title,
        status: "draft",
        content: { body: content } as never,
        content_raw: content,
        prompt: SYSTEM_PROMPTS[data.kind],
        prompt_pack: pack as never,
        prompt_pack_hash: hash,
        model_version: model,
        generation_cost: cost,
        trigger_source: data.triggerSource,
        parent_artifact_id: data.parentArtifactId ?? null,
        version_number: version,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: artifact.id };
  });

// ---------- Edit ----------
export const editArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        artifactId: z.string().uuid(),
        contentEdited: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("./ai-artifacts.server");
    const { data: existing } = await supabaseAdmin
      .from("ai_artifacts")
      .select("content_raw")
      .eq("id", data.artifactId)
      .maybeSingle();
    const raw = existing?.content_raw ?? "";
    const editDistance = Math.abs(raw.length - data.contentEdited.length);
    const { error } = await supabaseAdmin
      .from("ai_artifacts")
      .update({
        content_edited: data.contentEdited,
        content: { body: data.contentEdited } as never,
        human_edit_distance: editDistance,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        status: "reviewed",
      })
      .eq("id", data.artifactId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Apply ----------
export const applyArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ artifactId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("./ai-artifacts.server");
    const { data: artifact } = await supabaseAdmin
      .from("ai_artifacts")
      .select("*")
      .eq("id", data.artifactId)
      .single();
    if (!artifact) throw new Error("Artifact not found");

    let appliedToId: string | null = null;
    let appliedToType: string | null = null;

    const content = artifact.content_edited ?? artifact.content_raw ?? "";

    if (artifact.project_id) {
      const { data: doc } = await supabaseAdmin
        .from("project_documents")
        .insert({
          workspace_id: artifact.workspace_id,
          project_id: artifact.project_id,
          name: artifact.title,
          description: content.slice(0, 500),
          file_path: `ai-artifact://${artifact.id}`,
          document_type: artifact.kind,
          uploaded_by: context.userId,
        } as never)
        .select("id")
        .maybeSingle();
      if (doc) {
        appliedToId = doc.id;
        appliedToType = "project_document";
      }
    }

    const { error } = await supabaseAdmin
      .from("ai_artifacts")
      .update({
        status: "applied",
        applied_at: new Date().toISOString(),
        applied_to_id: appliedToId,
        applied_to_type: appliedToType,
        reviewed_by: context.userId,
      })
      .eq("id", data.artifactId);
    if (error) throw new Error(error.message);
    return { ok: true, appliedToId, appliedToType };
  });

// ---------- Discard ----------
export const discardArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ artifactId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("./ai-artifacts.server");
    const { error } = await supabaseAdmin
      .from("ai_artifacts")
      .update({ status: "discarded" })
      .eq("id", data.artifactId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Drafts Inbox ----------
export const getDraftsInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAccountAccess, supabaseAdmin } = await import("./ai-artifacts.server");
    await assertAccountAccess(data.accountId, context.userId);
    const { data: rows } = await supabaseAdmin
      .from("ai_artifacts")
      .select(
        "id, kind, title, status, created_at, project_id, deal_id, content_raw, content_edited, model_version, trigger_source, version_number",
      )
      .eq("client_account_id", data.accountId)
      .in("status", ["draft", "reviewed"])
      .order("created_at", { ascending: false });
    return rows ?? [];
  });

// ---------- Recently Applied ----------
export const getAppliedArtifacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAccountAccess, supabaseAdmin } = await import("./ai-artifacts.server");
    await assertAccountAccess(data.accountId, context.userId);
    const { data: rows } = await supabaseAdmin
      .from("ai_artifacts")
      .select(
        "id, kind, title, applied_at, project_id, deal_id, applied_to_id, applied_to_type",
      )
      .eq("client_account_id", data.accountId)
      .eq("status", "applied")
      .order("applied_at", { ascending: false })
      .limit(30);
    return rows ?? [];
  });

// ---------- AI Insights ----------
export const getAiInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAccountAccess, supabaseAdmin } = await import("./ai-artifacts.server");
    await assertAccountAccess(data.accountId, context.userId);
    const { data: rows } = await supabaseAdmin
      .from("ai_artifacts")
      .select("id, title, content_raw, created_at")
      .eq("client_account_id", data.accountId)
      .eq("kind", "insight")
      .order("created_at", { ascending: false })
      .limit(10);
    return rows ?? [];
  });

// ---------- Quality Metrics ----------
export const getAiQualityMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("./ai-artifacts.server");
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) throw new Error("Not a workspace member");

    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("ai_artifacts")
      .select(
        "kind, status, applied_at, created_at, human_edit_distance, content_raw, parent_artifact_id",
      )
      .eq("workspace_id", data.workspaceId)
      .gt("created_at", since);

    const all = rows ?? [];
    const byKind: Record<
      string,
      { total: number; applied: number; discarded: number; avgEditPct: number; medianHours: number; regenRate: number }
    > = {};
    const grouped = new Map<string, typeof all>();
    for (const r of all) {
      if (!grouped.has(r.kind)) grouped.set(r.kind, []);
      grouped.get(r.kind)!.push(r);
    }
    for (const [kind, items] of grouped) {
      const applied = items.filter((i) => i.status === "applied");
      const discarded = items.filter((i) => i.status === "discarded");
      const editPcts = items
        .filter((i) => i.human_edit_distance != null && i.content_raw)
        .map((i) => (i.human_edit_distance ?? 0) / Math.max(1, (i.content_raw ?? "").length));
      const hoursToApply = applied
        .filter((i) => i.applied_at)
        .map(
          (i) =>
            (new Date(i.applied_at as string).getTime() - new Date(i.created_at).getTime()) /
            3_600_000,
        )
        .sort((a, b) => a - b);
      const regenerated = items.filter((i) => i.parent_artifact_id).length;
      byKind[kind] = {
        total: items.length,
        applied: applied.length,
        discarded: discarded.length,
        avgEditPct: editPcts.length ? editPcts.reduce((a, b) => a + b, 0) / editPcts.length : 0,
        medianHours: hoursToApply.length ? hoursToApply[Math.floor(hoursToApply.length / 2)] : 0,
        regenRate: items.length ? regenerated / items.length : 0,
      };
    }
    return { byKind, total: all.length };
  });

// ---------- Trigger on Phase Change ----------
export const triggerArtifactOnPhaseChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ projectId: z.string().uuid(), phaseKey: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("./ai-artifacts.server");
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("client_account_id, template_id, current_phase_id, workspace_id")
      .eq("id", data.projectId)
      .single();
    if (!project?.client_account_id || !project.template_id) return { triggered: false };

    // Resolved once for the whole batch — the key is per workspace, not per binding.
    const apiKey = await resolveOpenRouterKey(project.workspace_id);

    const { data: phase } = await supabaseAdmin
      .from("template_phases")
      .select("id, name, ai_bindings")
      .eq("id", data.phaseKey)
      .maybeSingle();
    const aiBindings = phase?.ai_bindings as unknown as Array<{ kind: string; auto_generate: boolean; title_template?: string }> | undefined;
    if (!aiBindings?.length) return { triggered: false };

    for (const binding of aiBindings) {
      if (!binding.auto_generate) continue;
      const { SYSTEM_PROMPTS, createHash, assemblePromptPack } = await import("./ai-artifacts.server");
      const kind = binding.kind as ArtifactKind;
      if (!SYSTEM_PROMPTS[kind]) continue;

      const pack = await assemblePromptPack({ accountId: project.client_account_id, kind, projectId: data.projectId });
      let content = "";
      let model = "placeholder";
      let cost = 0;

      if (apiKey) {
        try {
          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: SYSTEM_PROMPTS[kind] },
                { role: "user", content: `Context (JSON):\n${JSON.stringify(pack, null, 2)}\n\nProduce the artifact now.` },
              ],
              temperature: 0.5,
            }),
          });
          if (res.ok) {
            const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } };
            content = body.choices?.[0]?.message?.content ?? "";
            model = "google/gemini-2.5-flash";
            cost = body.usage?.total_tokens ?? 0;
          }
        } catch {
          // swallow auto-generation errors
        }
      }

      const hash = createHash("sha256").update(JSON.stringify(pack)).digest("hex").slice(0, 32);
      const phaseName = phase!.name ?? "";
      const title = binding.title_template?.replace("{{phase}}", phaseName)
        ?? `${kind.replace(/_/g, " ")} — ${phaseName}`;

      await supabaseAdmin.from("ai_artifacts").insert({
        workspace_id: (await supabaseAdmin.from("client_accounts").select("workspace_id").eq("id", project.client_account_id).single()).data!.workspace_id,
        client_account_id: project.client_account_id,
        project_id: data.projectId,
        kind,
        title,
        status: "draft",
        content: { body: content } as never,
        content_raw: content,
        prompt: SYSTEM_PROMPTS[kind],
        prompt_pack: pack as never,
        prompt_pack_hash: hash,
        model_version: model,
        generation_cost: cost,
        trigger_source: "event",
        created_by: context.userId,
      } as never);
    }
    return { triggered: true };
  });

// need this at module scope for the middleware array
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
