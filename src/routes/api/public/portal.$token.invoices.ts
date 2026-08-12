import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPortalAccess } from "@/server/portal-access.server";

export const Route = createFileRoute("/api/public/portal/$token/invoices")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const access = await loadPortalAccess(params.token);
        if (!access) return new Response("Not found", { status: 404 });
        if (!access.can_see_invoices && !access.can_see_financials) {
          return new Response("Forbidden", { status: 403 });
        }

        const { data: invoices, error } = await supabaseAdmin
          .from("invoices")
          .select(
            "id,invoice_number,status,issue_date,due_date,currency,subtotal,tax_amount,total,amount_paid,sent_at,paid_at",
          )
          .eq("project_id", access.project_id)
          .neq("status", "draft")
          .order("issue_date", { ascending: false });

        if (error) return new Response(error.message, { status: 500 });
        return Response.json(invoices ?? []);
      },
    },
  },
});
