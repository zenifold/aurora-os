import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiGenerateCanvasElements } from "@/server/canvas-ai.functions";
import { mdToTipTap as mdToTipTapShared, type EntityResolver } from "@/server/md-to-tiptap.server";

type Kind = "folder" | "page" | "canvas" | "plan" | "project" | "auto";
type Mode = "one_shot" | "agentic";

interface CreatedArtifact {
  kind: Kind;
  id: string;
  title: string;
  path?: string;
}

export async function authedUserId(): Promise<string | null> {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

export async function getApiKey(workspaceId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("workspace_ai_secrets")
    .select("openrouter_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data?.openrouter_api_key ?? null;
}

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callJSON<T>(apiKey: string, model: string, messages: OpenRouterMessage[]): Promise<T> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/zenifold/aurora-os",
      "X-Title": "Aurora Universal Create",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const txt = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(txt) as T;
  } catch {
    const m = txt.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("AI did not return valid JSON");
  }
}

function md2tiptap(md: string, resolver?: EntityResolver) {
  return mdToTipTapShared(md, resolver);
}

function extractTaskIds(text: string): string[] {
  const out = new Set<string>();
  const re = /\[task:([0-9a-fA-F-]{8,})\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return [...out];
}

function extractProjectIds(text: string): string[] {
  const out = new Set<string>();
  const re = /\[project:([0-9a-fA-F-]{8,})\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return [...out];
}

async function buildEntityResolver(workspaceId: string): Promise<EntityResolver> {
  const taskCache = new Map<string, { title: string; project_id: string | null }>();
  const projectCache = new Map<string, { name: string }>();
  const pageCache = new Map<string, { title: string }>();
  const meetingCache = new Map<string, { title: string }>();

  // We resolve lazily; but EntityResolver is sync. So pre-load nothing here and
  // rely on the resolver returning the default href + a generic label. Replacement
  // resolver below is async-safe via a closure: we'll prefetch by scanning the
  // markdown — handled per-call inside generators when needed. For now, return a
  // resolver that prefers cached values populated by `prefetchEntities`.
  const resolver: EntityResolver = (kind, id) => {
    if (kind === "task") {
      const t = taskCache.get(id);
      if (!t) return null;
      return {
        label: t.title,
        href: t.project_id ? `/app/p/${t.project_id}?task=${id}` : `/app/my-tasks?task=${id}`,
      };
    }
    if (kind === "project") {
      const p = projectCache.get(id);
      return p ? { label: p.name } : null;
    }
    if (kind === "page") {
      const p = pageCache.get(id);
      return p ? { label: p.title } : null;
    }
    if (kind === "meeting") {
      const m = meetingCache.get(id);
      return m ? { label: m.title } : null;
    }
    return null;
  };

  // attach prefetcher to the function for callers that have markdown
  (resolver as unknown as { prefetch: (md: string) => Promise<void> }).prefetch = async (md: string) => {
    const taskIds = extractTaskIds(md).filter((id) => !taskCache.has(id));
    const projectIds = extractProjectIds(md).filter((id) => !projectCache.has(id));
    if (taskIds.length) {
      const { data } = await supabaseAdmin
        .from("tasks")
        .select("id, title, project_id")
        .in("id", taskIds)
        .eq("workspace_id", workspaceId);
      for (const t of data ?? []) taskCache.set(t.id, { title: t.title, project_id: t.project_id });
    }
    if (projectIds.length) {
      const { data } = await supabaseAdmin
        .from("projects")
        .select("id, name")
        .in("id", projectIds)
        .eq("workspace_id", workspaceId);
      for (const p of data ?? []) projectCache.set(p.id, { name: p.name });
    }
  };

  return resolver;
}

async function prefetchResolver(resolver: EntityResolver, md: string) {
  const fn = (resolver as unknown as { prefetch?: (md: string) => Promise<void> }).prefetch;
  if (fn) await fn(md);
}

function extractText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { text?: string; content?: unknown[] };
    if (typeof node.text === "string") out.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return out.join(" ").slice(0, 50000);
}

async function insertFolder(p: { workspace_id: string; user_id: string; division_id: string; parent_id: string | null; name: string; description?: string | null }) {
  const { data, error } = await supabaseAdmin.from("folders").insert({
    workspace_id: p.workspace_id, division_id: p.division_id, parent_id: p.parent_id,
    name: p.name, description: p.description ?? null, folder_type: "generic", created_by: p.user_id,
  } as never).select("id, name").single();
  if (error) throw new Error(error.message);
  return data as { id: string; name: string };
}

async function insertPage(p: { workspace_id: string; user_id: string; scope: "workspace" | "folder" | "project"; scope_id: string | null; page_type: string; title: string; icon?: string; content: unknown }) {
  const { data, error } = await supabaseAdmin.from("pages").insert({
    workspace_id: p.workspace_id, scope: p.scope, scope_id: p.scope_id,
    page_type: p.page_type, title: p.title, icon: p.icon ?? null,
    content: p.content as never, content_text: extractText(p.content),
    created_by: p.user_id, updated_by: p.user_id, ai_managed: true,
  } as never).select("id, title").single();
  if (error) throw new Error(error.message);
  return data as { id: string; title: string };
}

async function insertProject(p: { workspace_id: string; user_id: string; division_id: string; folder_id: string | null; name: string; description?: string | null }) {
  const { data, error } = await supabaseAdmin.from("projects").insert({
    workspace_id: p.workspace_id, division_id: p.division_id, folder_id: p.folder_id,
    name: p.name, description: p.description ?? null, status: "active", created_by: p.user_id,
  } as never).select("id, name").single();
  if (error) throw new Error(error.message);
  return data as { id: string; name: string };
}

interface OneShotPage { title: string; page_type: string; markdown: string; icon?: string }
interface OneShotPlan {
  title: string;
  lanes: { id: string; name: string }[];
  items: { id: string; title: string; lane: string; start: string; end: string; status?: string }[];
}
interface AgenticPlan {
  folder_tree?: { name: string; description?: string }[];
  pages?: OneShotPage[];
  canvas?: { title: string; prompt: string }[];
  plans?: OneShotPlan[];
  project?: { name: string; description?: string };
  summary?: string;
}

const MODEL_FAST = "xiaomi/mimo-v2-flash";
const MODEL_PRO = "xiaomi/mimo-v2-flash";

async function generatePage(apiKey: string, prompt: string): Promise<OneShotPage> {
  const sys = "You write structured workspace pages. Reply with JSON: { title, page_type (doc|prd|decision|runbook|meeting_notes), icon (single emoji), markdown }. Use # headings and - bullets. Be concrete. When the user prompt references items by their bracket tag (e.g. [task:UUID] or [project:UUID]), preserve those tags VERBATIM in your markdown — they will be auto-rendered as clickable links.";
  return callJSON<OneShotPage>(apiKey, MODEL_FAST, [{ role: "system", content: sys }, { role: "user", content: prompt }]);
}

async function generatePlanContent(apiKey: string, prompt: string): Promise<OneShotPlan> {
  const today = new Date().toISOString().slice(0, 10);
  const sys = `You design project timelines. Today is ${today}. Reply with JSON: { title, lanes:[{id,name}], items:[{id,title,lane,start (YYYY-MM-DD),end (YYYY-MM-DD),status (todo|in_progress|done|blocked)}] }. 3-6 lanes, 8-20 items, span weeks not years. Lane ids should be referenced by item.lane.`;
  return callJSON<OneShotPlan>(apiKey, MODEL_FAST, [{ role: "system", content: sys }, { role: "user", content: prompt }]);
}

async function generateAgenticPlan(apiKey: string, prompt: string): Promise<AgenticPlan> {
  const sys = `You are an autonomous workspace architect. Given a goal, produce a JSON spec describing artifacts to create inside the destination folder. Be ambitious but practical. Reply with JSON:
{
  "folder_tree": [{"name":"Sub-folder","description":"..."}],
  "pages": [{"title","page_type":"doc|prd|decision|runbook|meeting_notes","icon","markdown"}],
  "canvas": [{"title","prompt"}],
  "plans":  [{"title","lanes":[{"id","name"}],"items":[{"id","title","lane","start","end","status"}]}],
  "project": {"name","description"}
  ,"summary":"What you produced"
}
Aim for 3-8 artifacts total. Skip arrays you don't need. When the user prompt references items by their bracket tag (e.g. [task:UUID] or [project:UUID]), preserve those tags VERBATIM in any markdown you write — they will become clickable links.`;
  return callJSON<AgenticPlan>(apiKey, MODEL_PRO, [{ role: "system", content: sys }, { role: "user", content: prompt }]);
}

export interface RunArtifactInput {
  workspace_id: string;
  user_id: string;
  division_id: string;
  folder_id: string | null;
  kind: Kind;
  mode: Mode;
  prompt: string;
  apiKey: string;
}

export async function runArtifactGeneration(
  input: RunArtifactInput,
): Promise<{ ok: true; created: CreatedArtifact[]; summary: string } | { error: string }> {
  const { workspace_id, user_id, division_id, apiKey, prompt } = input;
  const folderId = input.folder_id;
  const created: CreatedArtifact[] = [];

  // Build entity resolver so [task:UUID] / [project:UUID] tokens become real hyperlinks
  // pointing to the right route, with the proper label.
  const resolver = await buildEntityResolver(workspace_id);
  const taskIdsInPrompt = extractTaskIds(prompt);
  void extractProjectIds(prompt);

  const linkPageToTasks = async (pageId: string, title: string) => {
    if (!taskIdsInPrompt.length) return;
    const rows = taskIdsInPrompt.map((tid) => ({
      workspace_id,
      task_id: tid,
      link_kind: "page" as const,
      target_id: pageId,
      label: title,
      created_by: user_id,
    }));
    await supabaseAdmin.from("task_links").insert(rows as never);
  };

  try {
    if (input.mode === "one_shot") {
      if (input.kind === "folder") {
        const f = await insertFolder({ workspace_id, user_id, division_id, parent_id: folderId, name: prompt.slice(0, 80) });
        created.push({ kind: "folder", id: f.id, title: f.name, path: `/app/f/${f.id}` });
      } else if (input.kind === "project") {
        const p = await insertProject({ workspace_id, user_id, division_id, folder_id: folderId, name: prompt.slice(0, 80) });
        created.push({ kind: "project", id: p.id, title: p.name, path: `/app/p/${p.id}` });
      } else if (input.kind === "page") {
        const out = await generatePage(apiKey, prompt);
        const md = out.markdown ?? "";
        await prefetchResolver(resolver, md + " " + prompt);
        const page = await insertPage({
          workspace_id, user_id,
          scope: folderId ? "folder" : "workspace", scope_id: folderId,
          page_type: ["doc", "prd", "decision", "runbook", "meeting_notes"].includes(out.page_type) ? out.page_type : "doc",
          title: out.title || "Untitled", icon: out.icon ?? "✨",
          content: md2tiptap(md, resolver),
        });
        created.push({ kind: "page", id: page.id, title: page.title, path: `/app/pages?p=${page.id}` });
        await linkPageToTasks(page.id, page.title);
      } else if (input.kind === "canvas") {
        const elements = await aiGenerateCanvasElements(apiKey, prompt);
        const page = await insertPage({
          workspace_id, user_id,
          scope: folderId ? "folder" : "workspace", scope_id: folderId,
          page_type: "canvas", title: prompt.slice(0, 80), icon: "🎨",
          content: { type: "excalidraw", elements, appState: {}, files: {} },
        });
        created.push({ kind: "canvas", id: page.id, title: page.title, path: `/app/pages?p=${page.id}` });
      } else if (input.kind === "plan") {
        const out = await generatePlanContent(apiKey, prompt);
        const planContent = {
          type: "plan",
          lanes: out.lanes ?? [],
          items: (out.items ?? []).map((it) => ({
            ...it,
            status: it.status && ["todo", "in_progress", "done", "blocked"].includes(it.status) ? it.status : "todo",
          })),
        };
        const page = await insertPage({
          workspace_id, user_id,
          scope: folderId ? "folder" : "workspace", scope_id: folderId,
          page_type: "plan", title: out.title || prompt.slice(0, 80), icon: "🗓️",
          content: planContent,
        });
        created.push({ kind: "plan", id: page.id, title: page.title, path: `/app/pages?p=${page.id}` });
      } else {
        return { error: "kind 'auto' requires agentic mode" };
      }
    } else {
      const spec = await generateAgenticPlan(apiKey, prompt);
      for (const sub of spec.folder_tree ?? []) {
        if (!sub?.name) continue;
        const f = await insertFolder({ workspace_id, user_id, division_id, parent_id: folderId, name: sub.name, description: sub.description });
        created.push({ kind: "folder", id: f.id, title: f.name, path: `/app/f/${f.id}` });
      }
      let projectId: string | null = null;
      if (spec.project?.name) {
        const proj = await insertProject({ workspace_id, user_id, division_id, folder_id: folderId, name: spec.project.name, description: spec.project.description });
        projectId = proj.id;
        created.push({ kind: "project", id: proj.id, title: proj.name, path: `/app/p/${proj.id}` });
      }
      const targetScope: "workspace" | "folder" | "project" = projectId ? "project" : folderId ? "folder" : "workspace";
      const targetScopeId = projectId ?? folderId;
      for (const pg of spec.pages ?? []) {
        if (!pg?.title) continue;
        const md = pg.markdown ?? "";
        await prefetchResolver(resolver, md);
        const page = await insertPage({
          workspace_id, user_id, scope: targetScope, scope_id: targetScopeId,
          page_type: ["doc", "prd", "decision", "runbook", "meeting_notes"].includes(pg.page_type) ? pg.page_type : "doc",
          title: pg.title, icon: pg.icon ?? "✨", content: md2tiptap(md, resolver),
        });
        created.push({ kind: "page", id: page.id, title: page.title, path: `/app/pages?p=${page.id}` });
        await linkPageToTasks(page.id, page.title);
      }
      for (const cv of spec.canvas ?? []) {
        if (!cv?.title) continue;
        try {
          const elements = await aiGenerateCanvasElements(apiKey, cv.prompt || cv.title);
          const page = await insertPage({
            workspace_id, user_id, scope: targetScope, scope_id: targetScopeId,
            page_type: "canvas", title: cv.title, icon: "🎨",
            content: { type: "excalidraw", elements, appState: {}, files: {} },
          });
          created.push({ kind: "canvas", id: page.id, title: page.title, path: `/app/pages?p=${page.id}` });
        } catch (e) { console.error("canvas gen failed", e); }
      }
      for (const pl of spec.plans ?? []) {
        if (!pl?.title) continue;
        const planContent = {
          type: "plan",
          lanes: pl.lanes ?? [],
          items: (pl.items ?? []).map((it) => ({
            ...it,
            status: it.status && ["todo", "in_progress", "done", "blocked"].includes(it.status) ? it.status : "todo",
          })),
        };
        const page = await insertPage({
          workspace_id, user_id, scope: targetScope, scope_id: targetScopeId,
          page_type: "plan", title: pl.title, icon: "🗓️", content: planContent,
        });
        created.push({ kind: "plan", id: page.id, title: page.title, path: `/app/pages?p=${page.id}` });
      }
    }
    return { ok: true, created, summary: `Created ${created.length} item(s).` };
  } catch (e) {
    console.error("runArtifactGeneration failed", e);
    return { error: (e as Error).message };
  }
}
