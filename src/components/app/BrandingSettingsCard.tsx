import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { type BrandConfig, DEFAULT_BRAND } from "@/lib/brand";

type Editable = Pick<
  BrandConfig,
  "appName" | "shortName" | "tagline" | "description" | "supportEmail" | "marketingUrl" | "githubUrl" | "hideAttribution"
>;

const FIELDS: { key: keyof Editable; label: string; placeholder: string; type?: "text" | "switch" }[] = [
  { key: "appName", label: "App name", placeholder: DEFAULT_BRAND.appName },
  { key: "shortName", label: "Short name (PWA)", placeholder: DEFAULT_BRAND.shortName },
  { key: "tagline", label: "Tagline", placeholder: DEFAULT_BRAND.tagline },
  { key: "description", label: "Description (meta)", placeholder: DEFAULT_BRAND.description },
  { key: "supportEmail", label: "Support email", placeholder: "support@example.com" },
  { key: "marketingUrl", label: "Marketing site URL", placeholder: "https://example.com" },
  { key: "githubUrl", label: "Source code URL (empty hides links)", placeholder: DEFAULT_BRAND.githubUrl },
];

export function BrandingSettingsCard() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  const [values, setValues] = useState<Partial<Editable>>({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-branding-edit", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("branding")
        .eq("id", ws!.id)
        .single();
      if (error) throw error;
      return (data?.branding ?? {}) as Partial<Editable>;
    },
  });

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  const set = <K extends keyof Editable>(k: K, v: Editable[K]) =>
    setValues((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!ws) return;
    setSaving(true);
    // Strip empty strings so they fall back to env defaults
    const clean: Partial<Editable> = {};
    for (const k of Object.keys(values) as (keyof Editable)[]) {
      const v = values[k];
      if (typeof v === "string") {
        if (v.trim()) (clean as Record<string, unknown>)[k] = v.trim();
      } else if (v !== undefined) {
        (clean as Record<string, unknown>)[k] = v;
      }
    }
    const { error } = await supabase
      .from("workspaces")
      .update({ branding: clean })
      .eq("id", ws.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Branding updated");
    qc.invalidateQueries({ queryKey: ["workspace-branding", ws.id] });
    qc.invalidateQueries({ queryKey: ["workspace-branding-edit", ws.id] });
  };

  if (isLoading) {
    return (
      <section className="max-w-xl rounded-xl border border-border bg-card p-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </section>
    );
  }

  return (
    <section className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-6">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          White-label branding
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Override the app name, tagline, support email, and links shown to your team and clients.
          Empty fields use the platform defaults.
        </p>
      </div>

      {FIELDS.map((f) => (
        <div key={f.key}>
          <Label htmlFor={`brand-${f.key}`}>{f.label}</Label>
          <Input
            id={`brand-${f.key}`}
            value={(values[f.key] as string) ?? ""}
            onChange={(e) => set(f.key, e.target.value as never)}
            placeholder={f.placeholder}
            className="mt-1.5"
          />
        </div>
      ))}

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <div>
          <Label htmlFor="brand-hide-attr" className="text-sm">Hide footer attribution</Label>
          <p className="text-xs text-muted-foreground">Removes "Built with…" from the marketing footer.</p>
        </div>
        <Switch
          id="brand-hide-attr"
          checked={!!values.hideAttribution}
          onCheckedChange={(v) => set("hideAttribution", v)}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={save} disabled={saving} className="bg-aura-gradient text-primary-foreground hover:opacity-90">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Save branding
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Note: Marketing site, browser tabs, and emails use the build-time defaults
        (configured via <code className="font-mono">VITE_BRAND_*</code> env vars). Per-workspace
        overrides apply inside the app and on workspace-scoped surfaces.
      </p>
    </section>
  );
}
