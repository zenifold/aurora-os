import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { WORKSPACE_PRESETS } from "@/lib/workspace-presets";
import { applyPresetToWorkspace } from "@/lib/workspace-preset-seeder";

export function WorkspacePresetsCard() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("agency");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const apply = async () => {
    if (!ws || !user) return;
    const preset = WORKSPACE_PRESETS.find((p) => p.key === selected);
    if (!preset) return;
    setBusy(true);
    setLastResult(null);
    try {
      const r = await applyPresetToWorkspace(ws.id, user.id, preset);
      setLastResult(
        r.divisionsCreated + r.foldersCreated === 0
          ? "Already up to date — no new items added."
          : `Added ${r.divisionsCreated} division${r.divisionsCreated === 1 ? "" : "s"} and ${r.foldersCreated} folder${r.foldersCreated === 1 ? "" : "s"}.`,
      );
      toast.success("Preset applied");
      qc.invalidateQueries({ queryKey: ["divisions"] });
      qc.invalidateQueries({ queryKey: ["folders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply preset");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="max-w-3xl space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-aura-purple" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace presets
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Apply a preset to seed divisions and folders. Existing items are preserved — only
        missing pieces are added.
      </p>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {WORKSPACE_PRESETS.filter((p) => p.key !== "blank").map((p) => {
          const Icon = p.icon;
          const active = selected === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setSelected(p.key)}
              className={`group relative rounded-lg border bg-background p-3 text-left transition hover:shadow-sm ${
                active
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40"
              }`}
            >
              {active && (
                <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />
              )}
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md"
                style={{ backgroundColor: `${p.accentColor}22`, color: p.accentColor }}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="mt-2 text-sm font-medium">{p.name}</div>
              <div className="text-[11px] text-muted-foreground">{p.tagline}</div>
            </button>
          );
        })}
      </div>

      {lastResult && (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {lastResult}
        </p>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={apply} disabled={busy} className="bg-aura-gradient text-primary-foreground hover:opacity-90">
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Apply preset
        </Button>
      </div>
    </section>
  );
}
