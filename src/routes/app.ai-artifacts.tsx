import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/ai-artifacts")({
  component: AiArtifactsPage,
});

interface ArtifactRow {
  id: string;
  title: string | null;
  kind: string | null;
  status: string | null;
  created_at: string;
  client_account_id: string | null;
}

function AiArtifactsPage() {
  const ws = useWorkspaceStore((s) => s.current);

  const { data: artifacts = [], isLoading } = useQuery({
    queryKey: ["ai-artifacts-inbox", ws?.id],
    enabled: !!ws?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_artifacts")
        .select("id, title, kind, status, created_at, client_account_id")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ArtifactRow[];
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aura-gradient text-primary-foreground shadow-pop">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">AI & Artifacts</h1>
          <p className="text-sm text-muted-foreground">
            Draft inbox for AI-generated SOWs, proposals, plans, and agent outputs awaiting review.
          </p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && artifacts.length === 0 && (
        <Card className="p-10 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No AI artifacts yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Agent outputs and AI-generated documents will appear here for review.
          </p>
        </Card>
      )}

      {artifacts.length > 0 && (
        <Card className="divide-y divide-border">
          {artifacts.map((a) => {
            const inner = (
              <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/40">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.title ?? "Untitled artifact"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                {a.kind && <Badge variant="outline">{a.kind}</Badge>}
                {a.status && <Badge variant="secondary">{a.status}</Badge>}
              </div>
            );
            return a.client_account_id ? (
              <Link
                key={a.id}
                to="/app/clients/$accountId"
                params={{ accountId: a.client_account_id }}
                className="block"
              >
                {inner}
              </Link>
            ) : (
              <div key={a.id}>{inner}</div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
