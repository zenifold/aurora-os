import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/danger")({
  component: DangerPage,
});

function DangerPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const fetchWs = useWorkspaceStore((s) => s.fetch);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Check if current user is owner
  const isOwner = ws?.owner_id === user?.id;

  const onDelete = async () => {
    if (!ws || confirmText !== ws.name) return;
    setDeleting(true);
    const { error } = await supabase.from("workspaces").delete().eq("id", ws.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Workspace deleted");
    await fetchWs();
    navigate({ to: "/app" });
  };

  if (!isOwner) {
    return (
      <div>
        <h2 className="text-lg font-semibold">Danger zone</h2>
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          Only the workspace owner can access this section.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold">Danger zone</h2>
      <p className="text-sm text-muted-foreground">Irreversible actions. Proceed with care.</p>

      <div className="mt-6 rounded-xl border-2 border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <h3 className="font-semibold text-destructive">Delete this workspace</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              All projects, tasks, comments, and member data will be permanently deleted. This cannot be undone.
            </p>
            <div className="mt-4 max-w-sm">
              <Label htmlFor="confirm" className="text-xs">
                Type <span className="font-mono font-semibold text-foreground">{ws?.name}</span> to confirm
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1.5"
                placeholder={ws?.name}
              />
            </div>
            <Button
              variant="destructive"
              className="mt-4"
              disabled={confirmText !== ws?.name || deleting}
              onClick={onDelete}
            >
              {deleting ? "Deleting…" : "Delete workspace permanently"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
