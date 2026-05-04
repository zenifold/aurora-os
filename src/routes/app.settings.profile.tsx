import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUIStore } from "@/stores/ui-store";
import { useUserPreferences, useUpdateUserPreferences } from "@/hooks/use-user-preferences";
import { toast } from "sonner";
import { Sun, Moon, Monitor, Rows3, Rows2, AlignJustify } from "lucide-react";

export const Route = createFileRoute("/app/settings/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: prefs } = useUserPreferences();
  const update = useUpdateUserPreferences();

  // Live UI state
  const theme = useUIStore((s) => s.theme);
  const density = useUIStore((s) => s.density);
  const fontSize = useUIStore((s) => s.fontSize);
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  const highContrast = useUIStore((s) => s.highContrast);
  const setTheme = useUIStore((s) => s.setTheme);
  const setDensity = useUIStore((s) => s.setDensity);
  const setFontSize = useUIStore((s) => s.setFontSize);
  const setReducedMotion = useUIStore((s) => s.setReducedMotion);
  const setHighContrast = useUIStore((s) => s.setHighContrast);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setName(data?.display_name ?? ""));
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name } as never)
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success("Saved");
  };

  // Persist preference + apply live
  const set = <K extends "theme" | "density" | "font_size" | "reduced_motion" | "high_contrast" | "default_landing" | "default_view_type" | "confirm_deletes">(
    key: K,
    value: NonNullable<typeof prefs>[K],
  ) => {
    update.mutate({ [key]: value } as Parameters<typeof update.mutate>[0]);
  };

  const fontSizeIndex = { small: 0, default: 1, large: 2, xlarge: 3 }[fontSize];
  const fontSizeOrder: Array<"small" | "default" | "large" | "xlarge"> = ["small", "default", "large", "xlarge"];

  return (
    <div className="space-y-10">
      {/* PROFILE */}
      <section>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">How you appear in Aura.</p>
        <div className="mt-6 max-w-xl space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="dn">Display name</Label>
            <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <Button onClick={saveProfile} disabled={saving} className="bg-aura-gradient text-primary-foreground hover:opacity-90">
            Save
          </Button>
        </div>
      </section>

      {/* APPEARANCE */}
      <section>
        <h2 className="text-lg font-medium">Appearance</h2>
        <p className="text-sm text-muted-foreground">Personal — overrides workspace defaults. Synced across your devices.</p>

        <div className="mt-4 max-w-xl space-y-6 rounded-xl border border-border bg-card p-6">
          {/* Theme */}
          <div>
            <Label className="mb-2 block">Theme</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "light", icon: Sun, label: "Light" },
                { v: "dark", icon: Moon, label: "Dark" },
                { v: "system", icon: Monitor, label: "System" },
              ] as const).map(({ v, icon: Icon, label }) => (
                <button
                  key={v}
                  onClick={() => { setTheme(v); set("theme", v); }}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition ${
                    theme === v ? "border-primary bg-aura-gradient-subtle" : "border-border hover:bg-accent"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Density */}
          <div>
            <Label className="mb-2 block">Density</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "comfortable", icon: Rows3, label: "Comfortable" },
                { v: "compact", icon: Rows2, label: "Compact" },
                { v: "ultra", icon: AlignJustify, label: "Ultra" },
              ] as const).map(({ v, icon: Icon, label }) => (
                <button
                  key={v}
                  onClick={() => { setDensity(v); set("density", v); }}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition ${
                    density === v ? "border-primary bg-aura-gradient-subtle" : "border-border hover:bg-accent"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Affects table row heights and card padding everywhere.</p>
          </div>

          {/* Font size */}
          <div>
            <Label className="mb-2 block">Font size</Label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">A-</span>
              <Slider
                value={[fontSizeIndex]}
                min={0}
                max={3}
                step={1}
                onValueChange={(v) => {
                  const next = fontSizeOrder[v[0]];
                  setFontSize(next);
                  set("font_size", next);
                }}
                className="flex-1"
              />
              <span className="text-lg text-muted-foreground">A+</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground capitalize">Currently: {fontSize}</p>
          </div>

          {/* Accessibility */}
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Reduced motion</Label>
                <p className="text-xs text-muted-foreground">Disable animations and transitions.</p>
              </div>
              <Switch
                checked={reducedMotion}
                onCheckedChange={(b) => { setReducedMotion(b); set("reduced_motion", b); }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>High contrast</Label>
                <p className="text-xs text-muted-foreground">Stronger borders and darker secondary text.</p>
              </div>
              <Switch
                checked={highContrast}
                onCheckedChange={(b) => { setHighContrast(b); set("high_contrast", b); }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* BEHAVIOR */}
      <section>
        <h2 className="text-lg font-medium">Behavior</h2>
        <p className="text-sm text-muted-foreground">Defaults for navigation and editing.</p>

        <div className="mt-4 max-w-xl space-y-5 rounded-xl border border-border bg-card p-6">
          <div>
            <Label>Default landing page</Label>
            <Select
              value={prefs?.default_landing ?? "dashboard"}
              onValueChange={(v) => set("default_landing", v as "dashboard" | "my-tasks" | "last-project")}
            >
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dashboard">Dashboard</SelectItem>
                <SelectItem value="my-tasks">My Tasks</SelectItem>
                <SelectItem value="last-project">Last project visited</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Default view type</Label>
            <Select
              value={prefs?.default_view_type ?? "table"}
              onValueChange={(v) => set("default_view_type", v as "table" | "kanban" | "calendar")}
            >
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="kanban">Kanban</SelectItem>
                <SelectItem value="calendar">Calendar</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">Used when opening a project that has no saved default.</p>
          </div>

          <div>
            <Label>Confirm deletes</Label>
            <Select
              value={prefs?.confirm_deletes ?? "always"}
              onValueChange={(v) => set("confirm_deletes", v as "always" | "bulk" | "never")}
            >
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Always ask</SelectItem>
                <SelectItem value="bulk">Bulk only (multi-select)</SelectItem>
                <SelectItem value="never">Never (delete instantly)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
    </div>
  );
}
