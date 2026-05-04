import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/")({
  component: WorkspaceSettings,
});

function WorkspaceSettings() {
  const ws = useWorkspaceStore((s) => s.current);
  const fetchWs = useWorkspaceStore((s) => s.fetch);
  const [name, setName] = useState(ws?.name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(ws?.name ?? ""), [ws]);

  const save = async () => {
    if (!ws) return;
    setSaving(true);
    const { error } = await supabase.from("workspaces").update({ name }).eq("id", ws.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    fetchWs();
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Workspace</h1>
      <p className="text-sm text-muted-foreground">Manage your workspace settings.</p>

      <div className="mt-8 max-w-md space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <Label htmlFor="name">Workspace name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
        </div>
        <Button onClick={save} disabled={saving} className="bg-aura-gradient text-primary-foreground hover:opacity-90">
          Save changes
        </Button>
      </div>
    </div>
  );
}
