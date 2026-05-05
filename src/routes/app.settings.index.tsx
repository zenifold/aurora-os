import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useWorkspaceStore, type WorkspaceKind } from "@/stores/workspace-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/settings/")({
  component: WorkspaceSettings,
});

interface WorkspaceFull {
  id: string;
  name: string;
  slug: string;
  plan: string;
  kind: WorkspaceKind;
  linked_delivery_workspace_id: string | null;
  settings: { description?: string; color?: string } | null;
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

function WorkspaceSettings() {
  const ws = useWorkspaceStore((s) => s.current);
  const allWorkspaces = useWorkspaceStore((s) => s.workspaces);
  const fetchWs = useWorkspaceStore((s) => s.fetch);
  const qc = useQueryClient();

  const { data: full, isLoading } = useQuery({
    queryKey: ["workspace-full", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, slug, plan, kind, linked_delivery_workspace_id, settings")
        .eq("id", ws!.id)
        .single();
      if (error) throw error;
      return data as WorkspaceFull;
    },
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [kind, setKind] = useState<WorkspaceKind>("hybrid");
  const [linkedDelivery, setLinkedDelivery] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!full) return;
    setName(full.name);
    setSlug(full.slug);
    setDescription(full.settings?.description ?? "");
    setColor(full.settings?.color ?? COLORS[0]);
    setKind(full.kind ?? "hybrid");
    setLinkedDelivery(full.linked_delivery_workspace_id ?? "");
  }, [full]);

  const deliveryOptions = allWorkspaces.filter(
    (w) => w.id !== ws?.id && (w.kind === "delivery" || w.kind === "hybrid"),
  );

  const save = async () => {
    if (!ws) return;
    setSaving(true);
    const { error } = await supabase
      .from("workspaces")
      .update({
        name: name.trim(),
        slug: slug.trim() || ws.slug,
        kind,
        linked_delivery_workspace_id: linkedDelivery || null,
        settings: { ...(full?.settings ?? {}), description, color },
      })
      .eq("id", ws.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Workspace updated");
    qc.invalidateQueries({ queryKey: ["workspace-full", ws.id] });
    fetchWs();
  };

  if (isLoading || !full) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Workspace</h1>
        <p className="text-sm text-muted-foreground">General workspace settings.</p>
      </div>

      <section className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-semibold text-white"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)` }}
          >
            {(name || "A").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name || "Workspace"}</p>
            <p className="truncate text-xs text-muted-foreground">/{slug}</p>
          </div>
        </div>

        <div>
          <Label htmlFor="name">Workspace name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
        </div>

        <div>
          <Label htmlFor="slug">URL slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            className="mt-1.5 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens.</p>
        </div>

        <div>
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this workspace for?"
            className="mt-1.5"
            rows={3}
          />
        </div>

        <div>
          <Label>Accent color</Label>
          <div className="mt-2 flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={save}
            disabled={saving || !name.trim()}
            className="bg-aura-gradient text-primary-foreground hover:opacity-90"
          >
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </section>

      <section className="max-w-xl rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Plan</h3>
        <p className="mt-3 text-sm">
          You're on the <span className="font-medium capitalize">{full.plan}</span> plan.
        </p>
      </section>
    </div>
  );
}
