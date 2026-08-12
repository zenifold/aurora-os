import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PROJECT_TAB_KEYS, PROJECT_TAB_LABELS, isTabEnabled, type ProjectTabKey } from "@/lib/work-modes";
import { useUpdateProject } from "@/hooks/use-projects";
import type { Project } from "@/lib/types";

export function ProjectTabsSettings({ project }: { project: Project }) {
  const update = useUpdateProject();
  const enabled = project.enabled_tabs ?? null;

  const toggle = async (key: ProjectTabKey, on: boolean) => {
    // null means "all visible". On first toggle-off, materialize the full list and remove the key.
    const base = enabled ?? [...PROJECT_TAB_KEYS];
    const set = new Set(base);
    if (on) set.add(key); else set.delete(key);
    const next = Array.from(set);
    // If everything is on, store null to keep defaults future-proof.
    const final = next.length === PROJECT_TAB_KEYS.length ? null : next;
    await update.mutateAsync({ id: project.id, enabled_tabs: final as never });
  };

  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-background">
      {PROJECT_TAB_KEYS.map((k) => (
        <div key={k} className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <Label className="text-sm">{PROJECT_TAB_LABELS[k]}</Label>
            <p className="text-xs text-muted-foreground">
              Show the {PROJECT_TAB_LABELS[k]} button in this project's header.
            </p>
          </div>
          <Switch
            checked={isTabEnabled(enabled, k)}
            onCheckedChange={(v) => toggle(k, v)}
          />
        </div>
      ))}
    </div>
  );
}
