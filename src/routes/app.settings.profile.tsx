import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).single().then(({ data }) => {
      setName(data?.display_name ?? "");
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
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
    </div>
  );
}
