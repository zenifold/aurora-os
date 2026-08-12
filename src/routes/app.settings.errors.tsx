import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RoleGuard } from "@/components/app/RoleGuard";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/app/settings/errors")({
  component: () => (
    <RoleGuard min="owner">
      <ErrorsPage />
    </RoleGuard>
  ),
});

interface ErrorRow {
  id: string;
  workspace_id: string | null;
  user_id: string | null;
  message: string;
  stack: string | null;
  url: string | null;
  route: string | null;
  user_agent: string | null;
  severity: string;
  context: Record<string, unknown> | null;
  created_at: string;
}

function ErrorsPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: rows = [], isFetching, refetch } = useQuery({
    queryKey: ["error-reports", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("error_reports")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ErrorRow[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertCircle className="h-5 w-5" /> Error reports
          </h2>
          <p className="text-sm text-muted-foreground">
            Recent client-side runtime errors captured from this workspace.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <div className="rounded-lg border">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No errors captured. Things are running smoothly.
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.id} className="p-3 text-sm">
                <button
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={r.severity === "error" ? "destructive" : "secondary"}>
                        {r.severity}
                      </Badge>
                      <span className="truncate font-medium">{r.message}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "PPp")}
                      {r.route ? ` · ${r.route}` : ""}
                    </div>
                  </div>
                </button>
                {expanded === r.id && (
                  <div className="mt-2 space-y-2 text-xs">
                    {r.url && <div><span className="text-muted-foreground">URL:</span> {r.url}</div>}
                    {r.user_agent && (
                      <div className="truncate">
                        <span className="text-muted-foreground">UA:</span> {r.user_agent}
                      </div>
                    )}
                    {r.stack && (
                      <pre className="max-h-64 overflow-auto rounded bg-muted p-2 font-mono text-[11px]">
                        {r.stack}
                      </pre>
                    )}
                    {r.context && Object.keys(r.context).length > 0 && (
                      <pre className="max-h-40 overflow-auto rounded bg-muted p-2 font-mono text-[11px]">
                        {JSON.stringify(r.context, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
