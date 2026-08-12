import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// CORS so the chrome extension service worker can call us from any origin.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Max-Age": "86400",
};

type Suggestion = {
  type: "task" | "project" | "meeting";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
};

export const Route = createFileRoute("/api/public/extension/suggest")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim();
        const limit = Math.min(8, Number(url.searchParams.get("limit") ?? "6"));

        if (!q) {
          return Response.json(
            { suggestions: [] },
            { headers: CORS_HEADERS },
          );
        }

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) {
          return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
        }

        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData.user) {
          return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
        }
        const userId = userData.user.id;

        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("workspace_id")
          .eq("user_id", userId);
        const workspaceIds = (roles ?? []).map((r) => r.workspace_id);
        if (workspaceIds.length === 0) {
          return Response.json({ suggestions: [] }, { headers: CORS_HEADERS });
        }

        const term = `%${q}%`;
        const perBucket = Math.max(2, Math.ceil(limit / 2));

        const [tasksRes, projectsRes, meetingsRes] = await Promise.all([
          supabaseAdmin
            .from("tasks")
            .select("id, title, project_id, status, workspace_id")
            .in("workspace_id", workspaceIds)
            .ilike("title", term)
            .limit(perBucket),
          supabaseAdmin
            .from("projects")
            .select("id, name, workspace_id")
            .in("workspace_id", workspaceIds)
            .ilike("name", term)
            .limit(perBucket),
          supabaseAdmin
            .from("meetings")
            .select("id, title, workspace_id, scheduled_start")
            .in("workspace_id", workspaceIds)
            .ilike("title", term)
            .limit(perBucket),
        ]);

        const projectIds = Array.from(
          new Set(
            [
              ...(projectsRes.data ?? []).map((p) => p.id),
              ...(tasksRes.data ?? []).map((t) => t.project_id).filter(Boolean) as string[],
            ],
          ),
        );
        const projectMap = new Map<string, string>();
        if (projectIds.length) {
          const { data: ps } = await supabaseAdmin
            .from("projects")
            .select("id, name")
            .in("id", projectIds);
          (ps ?? []).forEach((p) => projectMap.set(p.id, p.name));
        }

        const suggestions: Suggestion[] = [];
        for (const p of projectsRes.data ?? []) {
          suggestions.push({
            type: "project",
            id: p.id,
            title: p.name,
            url: `/app/p/${p.id}`,
          });
        }
        for (const t of tasksRes.data ?? []) {
          suggestions.push({
            type: "task",
            id: t.id,
            title: t.title,
            subtitle: t.project_id ? projectMap.get(t.project_id) : undefined,
            url: t.project_id
              ? `/app/p/${t.project_id}?task=${t.id}`
              : `/app/my-tasks?task=${t.id}`,
          });
        }
        for (const m of meetingsRes.data ?? []) {
          suggestions.push({
            type: "meeting",
            id: m.id,
            title: m.title,
            subtitle: m.scheduled_start
              ? new Date(m.scheduled_start).toLocaleDateString()
              : undefined,
            url: `/app/meetings/${m.id}`,
          });
        }

        return Response.json(
          { suggestions: suggestions.slice(0, limit) },
          { headers: CORS_HEADERS },
        );
      },
    },
  },
});
