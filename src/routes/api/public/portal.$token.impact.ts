import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPortalAccess } from "@/server/portal-access.server";

interface ImpactedTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  start_date: string | null;
}

interface ImpactNode {
  deliverable_id: string;
  task_id: string;
  task_title: string;
  deliverable_type: string;
  client_deadline: string | null;
  review_status: string;
  is_overdue: boolean;
  impact_description: string | null;
  downstream: ImpactedTask[];
}

export const Route = createFileRoute("/api/public/portal/$token/impact")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });

        const { data: deliverables } = await supabaseAdmin
          .from("client_deliverables")
          .select("*")
          .eq("project_id", access.project_id);

        const taskIds = new Set<string>();
        for (const d of deliverables ?? []) {
          taskIds.add(d.task_id);
          for (const id of d.downstream_task_ids ?? []) taskIds.add(id);
        }

        const { data: tasks } = await supabaseAdmin
          .from("tasks")
          .select("id,title,status,due_date,start_date")
          .in(
            "id",
            taskIds.size > 0
              ? Array.from(taskIds)
              : ["00000000-0000-0000-0000-000000000000"],
          );
        const taskMap = new Map((tasks ?? []).map((t) => [t.id, t]));

        const today = new Date().toISOString().slice(0, 10);
        const nodes: ImpactNode[] = (deliverables ?? []).map((d) => {
          const isOverdue =
            !!d.client_deadline &&
            d.client_deadline < today &&
            d.review_status !== "approved";
          const downstream: ImpactedTask[] = (d.downstream_task_ids ?? [])
            .map((id) => taskMap.get(id))
            .filter((t): t is NonNullable<typeof t> => !!t)
            .map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              due_date: t.due_date,
              start_date: t.start_date,
            }));

          return {
            deliverable_id: d.id,
            task_id: d.task_id,
            task_title: taskMap.get(d.task_id)?.title ?? "Untitled",
            deliverable_type: d.deliverable_type,
            client_deadline: d.client_deadline,
            review_status: d.review_status,
            is_overdue: isOverdue,
            impact_description: d.impact_description,
            downstream,
          };
        });

        return Response.json(nodes);
      },
    },
  },
});
