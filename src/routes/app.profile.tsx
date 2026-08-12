import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useUIStore } from "@/stores/ui-store";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Camera, Check, Loader2, Pencil, X, KeyRound, ImagePlus, MapPin, ExternalLink } from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  useRichProfile,
  type RichProfile,
  ProfileStatsGrid,
  BadgeShelf,
  PinnedBadges,
  AccomplishmentsList,
  ProfileEditor,
} from "@/components/profile/ProfileBlocks";

interface ProfileSearch {
  tab?: "overview" | "stats" | "badges" | "edit" | "activity" | "preferences" | "security";
}

export const Route = createFileRoute("/app/profile")({
  validateSearch: (search): ProfileSearch => ({
    tab: (search.tab as ProfileSearch["tab"]) ?? "overview",
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const { tab } = useSearch({ from: "/app/profile" });
  const navigate = Route.useNavigate();
  const qc = useQueryClient();

  const { data: profile } = useRichProfile(user?.id);

  if (!user || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["rich-profile", user.id] });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <ProfileHeader profile={profile} email={user.email ?? ""} onUpdate={refresh} />

      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as ProfileSearch["tab"] } })}
        className="mt-6"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="badges">Badges</TabsTrigger>
          <TabsTrigger value="edit">Edit profile</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <OverviewTab profile={profile} userId={user.id} onUpdated={refresh} />
        </TabsContent>

        <TabsContent value="stats" className="mt-6 space-y-4">
          <h2 className="text-base font-semibold">Your work in numbers</h2>
          <ProfileStatsGrid userId={user.id} />
        </TabsContent>

        <TabsContent value="badges" className="mt-6">
          <BadgeShelf userId={user.id} editable />
        </TabsContent>

        <TabsContent value="edit" className="mt-6">
          <ProfileEditor profile={profile} onUpdated={refresh} />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ActivityTab userId={user.id} />
        </TabsContent>

        <TabsContent value="preferences" className="mt-6">
          <PreferencesTab />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <SecurityTab email={user.email ?? ""} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Header w/ cover, avatar, identity ──────────── */

function ProfileHeader({
  profile,
  email,
  onUpdate,
}: {
  profile: RichProfile;
  email: string;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.display_name ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => setName(profile.display_name ?? ""), [profile.display_name]);

  const saveName = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    setEditing(false);
    onUpdate();
  };

  const uploadImage = async (
    file: File,
    column: "avatar_url" | "cover_url",
    setBusy: (v: boolean) => void,
  ) => {
    if (file.size > 6 * 1024 * 1024) return toast.error("Image must be under 6MB");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const prefix = column === "avatar_url" ? "avatar" : "cover";
      const path = `${profile.id}/${prefix}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const update = column === "avatar_url"
        ? { avatar_url: data.publicUrl }
        : { cover_url: data.publicUrl };
      const { error: updErr } = await supabase
        .from("profiles")
        .update(update)
        .eq("id", profile.id);

      if (updErr) throw updErr;
      toast.success(column === "avatar_url" ? "Avatar updated" : "Cover updated");
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const initials = (profile.display_name ?? email).slice(0, 2).toUpperCase();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Cover */}
      <div className="group relative h-36 sm:h-44">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="aura-mesh h-full w-full opacity-70" />
        )}
        <button
          onClick={() => coverRef.current?.click()}
          disabled={uploadingCover}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100"
        >
          {uploadingCover ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ImagePlus className="h-3 w-3" />
          )}
          {profile.cover_url ? "Change cover" : "Add cover"}
        </button>
        <input
          ref={coverRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void uploadImage(f, "cover_url", setUploadingCover);
          }}
        />
      </div>

      <div className="flex flex-wrap items-end gap-6 px-6 pb-6 -mt-12">
        <div className="group/avatar relative">
          <Avatar className="h-24 w-24 border-4 border-card shadow-pop">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.display_name ?? ""} />}
            <AvatarFallback className="bg-aura-gradient text-2xl text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition hover:opacity-100 group-hover/avatar:opacity-100 disabled:opacity-50"
            aria-label="Change avatar"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void uploadImage(f, "avatar_url", setUploading);
            }}
          />
        </div>

        <div className="flex-1 pt-12">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveName();
                  if (e.key === "Escape") { setEditing(false); setName(profile.display_name ?? ""); }
                }}
                className="h-9 max-w-xs text-xl font-semibold"
              />
              <Button size="icon" variant="ghost" onClick={() => void saveName()}><Check className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => { setEditing(false); setName(profile.display_name ?? ""); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setEditing(true)} className="group flex items-center gap-2 text-2xl font-semibold">
                {profile.display_name ?? "Set your name"}
                <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
              </button>
              {profile.pronouns && (
                <span className="text-xs text-muted-foreground">({profile.pronouns})</span>
              )}
            </div>
          )}

          {profile.headline && (
            <p className="mt-0.5 text-sm font-medium text-foreground/80">{profile.headline}</p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{email}</span>
            {profile.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {profile.location}
              </span>
            )}
            <span>Joined {format(parseISO(profile.created_at), "MMMM yyyy")}</span>
          </div>

          <div className="mt-2">
            <PinnedBadges userId={profile.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Overview ──────────────────────────────────── */

function OverviewTab({
  profile,
  userId,
  onUpdated,
}: {
  profile: RichProfile;
  userId: string;
  onUpdated: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">About</h3>
          {profile.bio ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Add a bio so teammates know what you work on. Head to <b>Edit profile</b>.
            </p>
          )}

          {profile.skills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {profile.skills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {profile.links.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.links.map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-xs text-foreground hover:bg-accent"
                >
                  <ExternalLink className="h-3 w-3" />
                  {l.label || new URL(l.url).hostname.replace("www.", "")}
                </a>
              ))}
            </div>
          )}
        </section>

        <AccomplishmentsList profile={profile} editable onUpdated={onUpdated} />
      </div>

      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Stats</h3>
          <div className="mt-3">
            <ProfileStatsGrid userId={userId} />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─── Activity ──────────────────────────────────── */

function ActivityTab({ userId }: { userId: string }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["profile", "activity", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("actor_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (rows.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
        No recent activity.
      </div>
    );

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {rows.map((r) => (
        <li key={r.id} className="px-4 py-3 text-sm">
          <span className="font-medium">{r.action}</span>{" "}
          <span className="text-muted-foreground">on {r.entity_type}</span>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(parseISO(r.created_at), { addSuffix: true })}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ─── Preferences ───────────────────────────────── */

function PreferencesTab() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const density = useUIStore((s) => s.density);
  const setDensity = useUIStore((s) => s.setDensity);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Appearance</h3>
        <div className="mt-4 space-y-5">
          <div>
            <Label>Theme</Label>
            <RadioGroup value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")} className="mt-2 flex gap-4">
              {(["light", "dark", "system"] as const).map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value={t} /> {t.charAt(0).toUpperCase() + t.slice(1)}
                </label>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label>Density</Label>
            <RadioGroup value={density} onValueChange={(v) => setDensity(v as "comfortable" | "compact")} className="mt-2 flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="comfortable" /> Comfortable
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="compact" /> Compact
              </label>
            </RadioGroup>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notifications</h3>
        <p className="mt-1 text-xs text-muted-foreground">Saved locally — email delivery coming soon.</p>
        <div className="mt-4 space-y-3">
          <NotifRow label="In-app activity" storageKey="aura-notif-inapp" defaultOn />
          <NotifRow label="Mentions" storageKey="aura-notif-mentions" defaultOn />
          <NotifRow label="Daily digest" storageKey="aura-notif-digest" defaultOn={false} />
          <NotifRow label="Due-date reminders" storageKey="aura-notif-due" defaultOn />
        </div>
      </section>
    </div>
  );
}

function NotifRow({ label, storageKey, defaultOn }: { label: string; storageKey: string; defaultOn: boolean }) {
  const [on, setOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOn;
    const v = localStorage.getItem(storageKey);
    return v === null ? defaultOn : v === "true";
  });
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch
        checked={on}
        onCheckedChange={(v) => {
          setOn(v);
          localStorage.setItem(storageKey, String(v));
          toast.success("Preferences saved");
        }}
      />
    </div>
  );
}

/* ─── Security ──────────────────────────────────── */

function SecurityTab({ email }: { email: string }) {
  const [sending, setSending] = useState(false);

  const sendReset = async () => {
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">Password</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll email you a secure link to set a new password.
            </p>
          </div>
          <Button onClick={sendReset} disabled={sending} variant="outline">
            <KeyRound className="mr-1.5 h-4 w-4" /> {sending ? "Sending…" : "Send reset email"}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold">Active session</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          You're signed in as <span className="font-medium text-foreground">{email}</span>.
        </p>
      </section>
    </div>
  );
}
