import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";
import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  useWorkspaceOverviewTemplate,
  useUpdateWorkspaceOverviewTemplate,
} from "@/hooks/use-workspace-overview-template";
import { DEFAULT_OVERVIEW_SECTIONS, type OverviewSectionDef } from "@/lib/overview-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/dialogs";

export const Route = createFileRoute("/app/settings/overview")({
  component: () => (
    <RoleGuard min="manager">
      <OverviewTemplateSettings />
    </RoleGuard>
  ),
});

function OverviewTemplateSettings() {
  const ws = useWorkspaceStore((s) => s.current);
  const { data, isLoading } = useWorkspaceOverviewTemplate(ws?.id);
  const update = useUpdateWorkspaceOverviewTemplate(ws?.id ?? "");
  const [sections, setSections] = useState<OverviewSectionDef[]>([]);

  useEffect(() => {
    if (data) setSections(data);
  }, [data]);

  if (!ws || isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const updateAt = (i: number, patch: Partial<OverviewSectionDef>) => {
    setSections((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };

  const addSection = () => {
    setSections((s) => [
      ...s,
      {
        key: `custom_${Date.now()}`,
        label: "New section",
        icon: "📌",
        sort_order: s.length,
        prompt: "Describe what the AI should write here.",
      },
    ]);
  };

  const removeAt = async (i: number) => {
    if (!(await confirmDialog({ title: "Remove section?", tone: "destructive" }))) return;
    setSections((s) => s.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, sort_order: idx })));
  };

  const resetToDefaults = async () => {
    if (!(await confirmDialog({ title: "Reset to defaults?", description: "Replaces your current section template." }))) return;
    setSections(DEFAULT_OVERVIEW_SECTIONS);
  };

  const save = async () => {
    try {
      await update.mutateAsync(sections.map((s, i) => ({ ...s, sort_order: i })));
      toast.success("Overview template saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview templates</h1>
        <p className="text-sm text-muted-foreground">
          Default sections for AI-generated project overviews. Each project can override these.
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((s, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-2">
                <Input
                  value={s.icon}
                  onChange={(e) => updateAt(i, { icon: e.target.value.slice(0, 4) })}
                  className="w-14 text-center"
                  aria-label="Icon"
                />
                <div className="flex-1 space-y-2">
                  <Input
                    value={s.label}
                    onChange={(e) => updateAt(i, { label: e.target.value })}
                    placeholder="Section label"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Key</Label>
                      <Input
                        value={s.key}
                        onChange={(e) =>
                          updateAt(i, {
                            key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                          })
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeAt(i)}
                  aria-label="Remove section"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">AI prompt</Label>
                <Textarea
                  value={s.prompt}
                  onChange={(e) => updateAt(i, { prompt: e.target.value })}
                  rows={3}
                  className="text-xs"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={addSection}>
          <Plus className="mr-1.5 h-4 w-4" /> Add section
        </Button>
        <Button variant="ghost" onClick={resetToDefaults}>
          <RotateCcw className="mr-1.5 h-4 w-4" /> Reset to defaults
        </Button>
        <div className="flex-1" />
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Save template
        </Button>
      </div>
    </div>
  );
}
