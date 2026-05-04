import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/data")({
  component: DataPage,
});

function DataPage() {
  const ws = useWorkspaceStore((s) => s.current);

  const { refetch, isFetching } = useQuery({
    queryKey: ["export", ws?.id],
    enabled: false,
    queryFn: async () => {
      const [{ data: projects }, { data: tasks }, { data: comments }] = await Promise.all([
        supabase.from("projects").select("*").eq("workspace_id", ws!.id),
        supabase.from("tasks").select("*").eq("workspace_id", ws!.id),
        supabase.from("comments").select("*").eq("workspace_id", ws!.id),
      ]);
      const blob = new Blob(
        [JSON.stringify({ workspace: ws, projects, tasks, comments }, null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ws?.slug ?? "workspace"}-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    },
  });

  const exportAll = async () => {
    if (!ws) return;
    try {
      await refetch();
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold">Data & privacy</h2>
      <p className="text-sm text-muted-foreground">Export and manage your workspace data.</p>

      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold">Export workspace</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Download a JSON snapshot of all projects, tasks, and comments in this workspace.
        </p>
        <Button onClick={exportAll} disabled={isFetching} className="mt-4">
          <Download className="mr-1.5 h-4 w-4" /> {isFetching ? "Preparing…" : "Export JSON"}
        </Button>
      </div>
    </div>
  );
}
