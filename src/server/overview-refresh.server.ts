/**
 * Server-only helpers for project overview refresh.
 * Kept in a `.server.ts` file so the supabaseAdmin import is stripped
 * from the client bundle by import-protection.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_OVERVIEW_SECTIONS,
  nextRefreshAt,
  type OverviewHealth,
  type OverviewSectionContent,
  type OverviewSectionDef,
  type RefreshCadence,
} from "@/lib/overview-types";

export async function ensureWorkspaceTemplate(
  workspace_id: string,
): Promise<OverviewSectionDef[]> {
  const { data } = await supabaseAdmin
    .from("workspace_overview_templates" as never)
    .select("sections")
    .eq("workspace_id", workspace_id)
    .maybeSingle();
  const row = data as { sections: OverviewSectionDef[] } | null;
  if (row && Array.isArray(row.sections) && row.sections.length > 0) return row.sections;

  await supabaseAdmin
    .from("workspace_overview_templates" as never)
    .upsert({ workspace_id, sections: DEFAULT_OVERVIEW_SECTIONS } as never);
  return DEFAULT_OVERVIEW_SECTIONS;
}

export async function ensureProjectOverview(workspace_id: string, project_id: string) {
  const { data } = await supabaseAdmin
    .from("project_overviews" as never)
    .select("*")
    .eq("project_id", project_id)
    .maybeSingle();
  if (data) return data as never;
  const insert = {
    workspace_id,
    project_id,
    refresh_cadence: "daily" as RefreshCadence,
    next_refresh_at: nextRefreshAt("daily")?.toISOString() ?? null,
  };
  const { data: row } = await supabaseAdmin
    .from("project_overviews" as never)
    .insert(insert as never)
    .select("*")
    .single();
  return row as never;
}

interface ProjectSignals {
  project_name: string;
  project_description: string | null;
  open_tasks: number;
  done_tasks: number;
  overdue: number;
  recent_tasks: { title: string; status: string; priority: string | null; due: string | null; updated_at: string }[];
  recent_transitions: { task_title: string; from: string | null; to: string | null; at: string }[];
  recent_comments: { task_title: string | null; text: string; at: string }[];
  open_blockers: number;
  milestones: { name: string; status: string; target_date: string | null }[];
  recent_pages: { title: string; page_type: string; updated_at: string }[];
  previous_summary: string | null;
}

async function gatherSignals(workspace_id: string, project_id: string): Promise<ProjectSignals> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: project },
    { data: allTasks },
    { data: recentTasks },
    { data: history },
    { data: comments },
    { data: blockers },
    { data: milestones },
    { data: pages },
    { data: prevSnap },
  ] = await Promise.all([
    supabaseAdmin.from("projects").select("name, description").eq("id", project_id).maybeSingle(),
    supabaseAdmin.from("tasks").select("id, status, due_date").eq("project_id", project_id),
    supabaseAdmin
      .from("tasks")
      .select("id, title, status, priority, due_date, updated_at")
      .eq("project_id", project_id)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabaseAdmin
      .from("task_status_history")
      .select("task_id, from_status_name, to_status_name, entered_at")
      .eq("workspace_id", workspace_id)
      .gte("entered_at", since)
      .limit(60),
    supabaseAdmin
      .from("comments")
      .select("task_id, content, created_at")
      .eq("workspace_id", workspace_id)
      .gte("created_at", since)
      .limit(40),
    supabaseAdmin
      .from("task_relations" as never)
      .select("source_task_id, target_task_id, relation_type")
      .eq("workspace_id", workspace_id)
      .eq("relation_type", "blocks")
      .limit(50),
    supabaseAdmin
      .from("milestones")
      .select("name, status, target_date")
      .eq("project_id", project_id)
      .order("target_date", { ascending: true })
      .limit(10),
    supabaseAdmin
      .from("pages")
      .select("title, page_type, updated_at")
      .eq("scope", "project")
      .eq("scope_id", project_id)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("project_overview_snapshots" as never)
      .select("summary")
      .eq("project_id", project_id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const taskById = new Map<string, { title: string; status: string }>();
  (recentTasks ?? []).forEach((t) =>
    taskById.set(t.id as string, { title: t.title as string, status: (t.status as string) ?? "" }),
  );

  const extractText = (doc: unknown): string => {
    if (!doc || typeof doc !== "object") return "";
    const out: string[] = [];
    const walk = (n: unknown) => {
      if (!n || typeof n !== "object") return;
      const node = n as { text?: string; content?: unknown[] };
      if (typeof node.text === "string") out.push(node.text);
      if (Array.isArray(node.content)) node.content.forEach(walk);
    };
    walk(doc);
    return out.join(" ");
  };

  const open = (allTasks ?? []).filter((t) => t.status !== "done").length;
  const done = (allTasks ?? []).filter((t) => t.status === "done").length;
  const overdue = (allTasks ?? []).filter((t) => {
    if (t.status === "done" || !t.due_date) return false;
    return (t.due_date as string).slice(0, 10) < today;
  }).length;

  return {
    project_name: (project?.name as string) ?? "Project",
    project_description: (project?.description as string | null) ?? null,
    open_tasks: open,
    done_tasks: done,
    overdue,
    recent_tasks: (recentTasks ?? []).map((t) => ({
      title: t.title as string,
      status: (t.status as string) ?? "",
      priority: (t.priority as string) ?? null,
      due: (t.due_date as string) ?? null,
      updated_at: t.updated_at as string,
    })),
    recent_transitions: (history ?? []).map((h) => ({
      task_title: taskById.get(h.task_id as string)?.title ?? "(task)",
      from: (h.from_status_name as string) ?? null,
      to: (h.to_status_name as string) ?? null,
      at: h.entered_at as string,
    })),
    recent_comments: (comments ?? [])
      .map((c) => ({
        task_title: taskById.get(c.task_id as string)?.title ?? null,
        text: extractText(c.content).slice(0, 280),
        at: c.created_at as string,
      }))
      .filter((c) => c.text.trim().length > 0)
      .slice(0, 30),
    open_blockers: ((blockers ?? []) as Array<{ source_task_id: string }>).filter((b) =>
      taskById.has(b.source_task_id),
    ).length,
    milestones: (milestones ?? []).map((m) => ({
      name: m.name as string,
      status: m.status as string,
      target_date: (m.target_date as string) ?? null,
    })),
    recent_pages: (pages ?? []).map((p) => ({
      title: p.title as string,
      page_type: p.page_type as string,
      updated_at: p.updated_at as string,
    })),
    previous_summary: ((prevSnap as { summary?: string } | null)?.summary as string) ?? null,
  };
}

interface AISectionResult {
  key: string;
  content_md: string;
}
interface AIRefreshResult {
  summary: string;
  health: OverviewHealth;
  sections: AISectionResult[];
}

async function callOpenRouter(
  apiKey: string,
  signals: ProjectSignals,
  template: OverviewSectionDef[],
): Promise<AIRefreshResult> {
  const sectionSpec = template
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => `- key: "${s.key}" — ${s.label}\n  ${s.prompt}`)
    .join("\n");

  const systemPrompt = `You are a project overview generator. Given raw project signals, write a fresh "state of the project" snapshot.

Output ONLY valid JSON in this exact shape:
{
  "summary": "2-3 sentence executive TL;DR",
  "health": "on_track" | "at_risk" | "off_track",
  "sections": [
    { "key": "<one of the section keys>", "content_md": "markdown body" }
  ]
}

Write each section as concise markdown (use ##/### headings sparingly, prefer bullets). Be specific and reference real task titles when relevant. If there is genuinely nothing to report for a section, write "_Nothing notable since the last update._".

Required sections:
${sectionSpec}`;

  const userPrompt = `Project: ${signals.project_name}${signals.project_description ? `\nDescription: ${signals.project_description}` : ""}
${signals.previous_summary ? `\nPrevious snapshot summary: ${signals.previous_summary}\n` : ""}
Counts: open=${signals.open_tasks}, done=${signals.done_tasks}, overdue=${signals.overdue}, open_blockers=${signals.open_blockers}

Recent tasks (most recent first):
${signals.recent_tasks.map((t) => `- [${t.status}${t.priority ? `, ${t.priority}` : ""}] ${t.title}${t.due ? ` (due ${t.due})` : ""}`).join("\n") || "(none)"}

Recent status transitions:
${signals.recent_transitions.map((h) => `- ${h.task_title}: ${h.from ?? "?"} → ${h.to ?? "?"}`).join("\n") || "(none)"}

Recent comments:
${signals.recent_comments.map((c) => `- ${c.task_title ? `[${c.task_title}] ` : ""}${c.text}`).join("\n") || "(none)"}

Milestones:
${signals.milestones.map((m) => `- ${m.name} (${m.status}${m.target_date ? `, target ${m.target_date}` : ""})`).join("\n") || "(none)"}

Recently updated pages:
${signals.recent_pages.map((p) => `- ${p.title} [${p.page_type}]`).join("\n") || "(none)"}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/zenifold/aurora-os",
      "X-Title": "Aurora Project Overview",
    },
    body: JSON.stringify({
      model: "xiaomi/mimo-v2-flash",
      temperature: 0.3,
      max_tokens: 2400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt.slice(0, 14000) },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: AIRefreshResult;
  try {
    parsed = JSON.parse(raw) as AIRefreshResult;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = m
      ? (JSON.parse(m[0]) as AIRefreshResult)
      : ({ summary: "", health: "unknown", sections: [] } as AIRefreshResult);
  }
  if (!Array.isArray(parsed.sections)) parsed.sections = [];
  if (!parsed.health) parsed.health = "unknown";
  if (!parsed.summary) parsed.summary = "";
  return parsed;
}

interface RefreshResult {
  ok: true;
  snapshot_id: string;
  summary: string;
  health: OverviewHealth;
}
export type RefreshOutcome = RefreshResult | { error: string };

export async function runRefresh(
  workspace_id: string,
  project_id: string,
  user_id: string | null,
): Promise<RefreshOutcome> {
  const overview = (await ensureProjectOverview(workspace_id, project_id)) as {
    id: string;
    refresh_cadence: RefreshCadence;
    sections_override: OverviewSectionDef[] | null;
  };
  const template =
    overview.sections_override && overview.sections_override.length > 0
      ? overview.sections_override
      : await ensureWorkspaceTemplate(workspace_id);

  const { data: secret } = await supabaseAdmin
    .from("workspace_ai_secrets")
    .select("openrouter_api_key")
    .eq("workspace_id", workspace_id)
    .maybeSingle();
  const apiKey = secret?.openrouter_api_key as string | undefined;
  if (!apiKey) {
    await supabaseAdmin
      .from("project_overviews" as never)
      .update({ refresh_status: "error", refresh_error: "No AI key configured" } as never)
      .eq("id", overview.id);
    return { error: "No OpenRouter API key configured. Add one in Settings → AI." };
  }

  await supabaseAdmin
    .from("project_overviews" as never)
    .update({ refresh_status: "running", refresh_error: null } as never)
    .eq("id", overview.id);

  try {
    const signals = await gatherSignals(workspace_id, project_id);
    const ai = await callOpenRouter(apiKey, signals, template);

    const sections: OverviewSectionContent[] = template
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((def) => {
        const found = ai.sections.find((s) => s.key === def.key);
        const content_md = (found?.content_md ?? "_No update produced._").trim();
        return {
          ...def,
          content_md,
          content_text: content_md
            .replace(/[#*_`>\-]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 4000),
        };
      });

    const { data: snap, error: snapErr } = await supabaseAdmin
      .from("project_overview_snapshots" as never)
      .insert({
        workspace_id,
        project_id,
        overview_id: overview.id,
        sections,
        summary: ai.summary,
        health: ai.health,
        ai_model: "xiaomi/mimo-v2-flash",
        generated_by: user_id,
      } as never)
      .select("id")
      .single();
    if (snapErr) throw new Error(snapErr.message);

    const now = new Date();
    await supabaseAdmin
      .from("project_overviews" as never)
      .update({
        refresh_status: "idle",
        refresh_error: null,
        last_refreshed_at: now.toISOString(),
        next_refresh_at: nextRefreshAt(overview.refresh_cadence, now)?.toISOString() ?? null,
      } as never)
      .eq("id", overview.id);

    return {
      ok: true,
      snapshot_id: (snap as { id: string }).id,
      summary: ai.summary,
      health: ai.health,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refresh failed";
    await supabaseAdmin
      .from("project_overviews" as never)
      .update({ refresh_status: "error", refresh_error: msg } as never)
      .eq("id", overview.id);
    return { error: msg };
  }
}

export async function runScheduledOverviewRefreshes(limit = 10): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
}> {
  const now = new Date().toISOString();
  const { data: due } = await supabaseAdmin
    .from("project_overviews" as never)
    .select("workspace_id, project_id")
    .neq("refresh_cadence", "off")
    .lte("next_refresh_at", now)
    .limit(limit);

  let succeeded = 0;
  let failed = 0;
  for (const row of (due ?? []) as { workspace_id: string; project_id: string }[]) {
    const r = await runRefresh(row.workspace_id, row.project_id, null);
    if ("error" in r) failed++;
    else succeeded++;
  }
  return { attempted: (due ?? []).length, succeeded, failed };
}
