import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function loadAccess(token: string) {
  const { data } = await supabaseAdmin
    .from("client_portal_access")
    .select("*")
    .eq("access_token", token)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

export const Route = createFileRoute("/api/public/portal/$token/deliverables")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const access = await loadAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });

        const { data: deliverables, error } = await supabaseAdmin
          .from("client_deliverables")
          .select("*")
          .eq("project_id", access.project_id)
          .order("client_deadline", { ascending: true, nullsFirst: false });
        if (error) return new Response(error.message, { status: 500 });

        const taskIds = (deliverables ?? []).map((d) => d.task_id);
        const { data: tasks } = await supabaseAdmin
          .from("tasks")
          .select("id,title,status")
          .in("id", taskIds.length ? taskIds : ["00000000-0000-0000-0000-000000000000"]);
        const taskMap = new Map((tasks ?? []).map((t) => [t.id, t]));

        const enriched = (deliverables ?? []).map((d) => ({
          ...d,
          task_title: taskMap.get(d.task_id)?.title ?? "Untitled task",
          task_status: taskMap.get(d.task_id)?.status ?? "todo",
        }));

        return Response.json(enriched);
      },
    },
  },
});
