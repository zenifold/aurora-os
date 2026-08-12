import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";
import { useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileJson } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/data")({
  component: () => (
    <RoleGuard min="owner">
      <DataPage />
    </RoleGuard>
  ),
});

const TABLES = [
  "projects",
  "tasks",
  "comments",
  "user_roles",
  "workspace_members",
  "deals",
  "contacts",
  "meetings",
  "meeting_action_items",
  "pages",
  "notes",
  "folders",
  "divisions",
  "workflow_statuses",
  "custom_fields",
  "tags",
  "milestones",
  "sprints",
  "time_logs",
  "attachments",
  "automations",
] as const;

function DataPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");

  const exportAll = async () => {
    if (!ws) return;
    setBusy(true);
    setProgress("Starting…");
    const out: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      workspace: ws,
    };
    try {
      for (const table of TABLES) {
        setProgress(`Exporting ${table}…`);
        try {
          const { data, error } = await supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from(table as any)
            .select("*")
            .eq("workspace_id", ws.id)
            .limit(10000);
          if (error) {
            out[table] = { error: error.message };
          } else {
            out[table] = data ?? [];
          }
        } catch (e) {
          out[table] = { error: e instanceof Error ? e.message : "failed" };
        }
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ws.slug ?? "workspace"}-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const exportTableCsv = async (table: string) => {
    if (!ws) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(table as any)
        .select("*")
        .eq("workspace_id", ws.id)
        .limit(10000);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) {
        toast.info(`No rows in ${table}`);
        return;
      }
      const headers = Object.keys(rows[0] as object);
      const lines = [headers.join(",")];
      for (const r of rows) {
        lines.push(
          headers
            .map((h) => {
              const v = (r as unknown as Record<string, unknown>)[h];
              const str = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
              return `"${str.replaceAll('"', '""')}"`;
            })
            .join(","),
        );
      }
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${table}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold">Data & privacy</h2>
      <p className="text-sm text-muted-foreground">Export and manage your workspace data.</p>

      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <FileJson className="h-4 w-4" /> Full workspace export
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Download a single JSON file with everything in this workspace — projects, tasks, comments,
          deals, contacts, meetings, pages, members, and more.
        </p>
        <Button onClick={exportAll} disabled={busy} className="mt-4">
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
          {busy ? progress || "Preparing…" : "Export workspace JSON"}
        </Button>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold">Per-table CSV</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Download a single table as CSV (up to 10,000 rows).
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {TABLES.map((t) => (
            <Button
              key={t}
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => exportTableCsv(t)}
              disabled={busy}
            >
              <Download className="mr-1 h-3 w-3" /> {t}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
