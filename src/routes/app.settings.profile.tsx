import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUIStore } from "@/stores/ui-store";
import { toast } from "sonner";
import { Sun, Moon, Monitor } from "lucide-react";

export const Route = createFileRoute("/app/settings/profile")({
  component: ProfilePage,
});

type ThemePref = "light" | "dark" | "system";

function ProfilePage() {
  const { user } = useAuth();
  const setUITheme = useUIStore((s) => s.setTheme);
  const currentTheme = useUIStore((s) => s.theme);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<ThemePref>(currentTheme);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, theme_preference")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setName(data?.display_name ?? "");
        const pref = (data as { theme_preference?: ThemePref } | null)?.theme_preference;
        if (pref && pref !== currentTheme) {
          setTheme(pref);
          setUITheme(pref);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name, theme_preference: theme } as never)
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setUITheme(theme);
    toast.success("Saved");
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="text-sm text-muted-foreground">How you appear in Aura.</p>

      <div className="mt-6 max-w-md space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="dn">Display name</Label>
          <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
        </div>
        <Button onClick={save} disabled={saving} className="bg-aura-gradient text-primary-foreground hover:opacity-90">
          Save
        </Button>
      </div>

      <h2 className="mt-10 text-lg font-medium">Appearance</h2>
      <p className="text-sm text-muted-foreground">Choose how Aura looks. Synced across your devices.</p>

      <div className="mt-4 max-w-md rounded-xl border border-border bg-card p-6">
        <Label>Theme</Label>
        <Select
          value={theme}
          onValueChange={(v) => {
            const next = v as ThemePref;
            setTheme(next);
            setUITheme(next); // live preview
          }}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">
              <span className="flex items-center gap-2"><Sun className="h-4 w-4" /> Light</span>
            </SelectItem>
            <SelectItem value="dark">
              <span className="flex items-center gap-2"><Moon className="h-4 w-4" /> Dark</span>
            </SelectItem>
            <SelectItem value="system">
              <span className="flex items-center gap-2"><Monitor className="h-4 w-4" /> Match system</span>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-2 text-xs text-muted-foreground">
          Click <strong>Save</strong> above to remember this across devices.
        </p>
      </div>
    </div>
  );
}
