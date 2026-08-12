import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, X, Sparkles, Trophy, Flame, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getUserStats, evaluateMyBadges, claimFunBadge } from "@/server/profile.functions";
import type { UserStats } from "@/server/profile.functions";

export interface RichProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  headline: string | null;
  pronouns: string | null;
  location: string | null;
  timezone: string | null;
  links: Array<{ label: string; url: string }>;
  skills: string[];
  accomplishments: Array<{ title: string; description?: string; date?: string; emoji?: string }>;
  accent_color: string | null;
  created_at: string;
}

export interface BadgeDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  category: string;
  criteria: Record<string, number | boolean>;
}

export interface EarnedBadge {
  badge_key: string;
  awarded_at: string;
  pinned: boolean;
}

const TIER_RING: Record<BadgeDef["tier"], string> = {
  bronze: "ring-amber-700/40",
  silver: "ring-slate-300/60",
  gold: "ring-amber-400/70",
  legendary: "ring-fuchsia-400/70 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.5)]",
};

export function useRichProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["rich-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data as unknown as RichProfile;
    },
  });
}

export function useBadgeCatalog() {
  return useQuery({
    queryKey: ["badge-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badges")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as unknown as BadgeDef[];
    },
  });
}

export function useEarnedBadges(userId: string | undefined) {
  return useQuery({
    queryKey: ["earned-badges", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_badges")
        .select("badge_key, awarded_at, pinned")
        .eq("user_id", userId!)
        .order("awarded_at", { ascending: false });
      if (error) throw error;
      return data as EarnedBadge[];
    },
  });
}

/* ============================================================ */

export function ProfileStatsGrid({ userId }: { userId: string }) {
  const fetch = useServerFn(getUserStats);
  const { data, isLoading } = useQuery({
    queryKey: ["user-stats", userId],
    queryFn: () => fetch({ data: { user_id: userId } }),
  });

  const stats = (data?.ok ? data.stats : null) as UserStats | null;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-muted/30" />
        ))}
      </div>
    );
  }

  const tiles: Array<{ label: string; value: number; icon: string; hint?: string }> = stats
    ? [
        { label: "Tasks done", value: stats.tasks_completed, icon: "✅" },
        { label: "Done in 30d", value: stats.tasks_completed_30d, icon: "📈" },
        { label: "Day streak", value: stats.streak_days, icon: "🔥" },
        { label: "Projects", value: stats.projects_created, icon: "🚀" },
        { label: "Meetings", value: stats.meetings_hosted, icon: "🎙️" },
        { label: "Notes", value: stats.notes_created, icon: "📝" },
        { label: "Comments", value: stats.comments_written, icon: "💬" },
        { label: "Mentions", value: stats.mentions, icon: "📣" },
      ]
    : [];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg">{t.icon}</span>
            <span className="text-2xl font-semibold tabular-nums">{t.value}</span>
          </div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {t.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================ */

export function BadgeShelf({ userId, editable }: { userId: string; editable: boolean }) {
  const qc = useQueryClient();
  const { data: catalog = [] } = useBadgeCatalog();
  const { data: earned = [] } = useEarnedBadges(userId);
  const evaluate = useServerFn(evaluateMyBadges);
  const claim = useServerFn(claimFunBadge);

  const earnedMap = new Map(earned.map((e) => [e.badge_key, e]));

  const evalMut = useMutation({
    mutationFn: () => evaluate({}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["earned-badges", userId] });
      toast.success("Badges refreshed");
    },
  });

  const togglePin = useMutation({
    mutationFn: async (badge_key: string) => {
      const current = earnedMap.get(badge_key);
      const { error } = await supabase
        .from("user_badges")
        .update({ pinned: !current?.pinned })
        .eq("user_id", userId)
        .eq("badge_key", badge_key);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["earned-badges", userId] }),
  });

  const claimMut = useMutation({
    mutationFn: (key: "night_owl" | "early_bird") => claim({ data: { badge_key: key } }),
    onSuccess: (res) => {
      if (res && "ok" in res && !res.ok) {
        toast.error(res.error);
        return;
      }
      void qc.invalidateQueries({ queryKey: ["earned-badges", userId] });
      toast.success("Badge claimed!");
    },
  });

  const groups = catalog.reduce<Record<string, BadgeDef[]>>((acc, b) => {
    (acc[b.category] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Trophy className="h-4 w-4 text-amber-500" />
            Badges
            <span className="text-sm font-normal text-muted-foreground">
              {earned.length} / {catalog.length}
            </span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Earn badges by doing meaningful work in Aurora. Pin your favorites.
          </p>
        </div>
        {editable && (
          <Button size="sm" variant="outline" onClick={() => evalMut.mutate()} disabled={evalMut.isPending}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {evalMut.isPending ? "Checking…" : "Check for new badges"}
          </Button>
        )}
      </div>

      <div className="space-y-5">
        {Object.entries(groups).map(([cat, items]) => (
          <section key={cat}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {cat}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((b) => {
                const got = earnedMap.get(b.key);
                const isManualClaim =
                  editable && !got && (b.key === "night_owl" || b.key === "early_bird");
                return (
                  <div
                    key={b.key}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg border bg-card p-2.5 transition",
                      got
                        ? cn("ring-2 ring-offset-2 ring-offset-background border-transparent", TIER_RING[b.tier])
                        : "border-dashed opacity-50 grayscale hover:opacity-80",
                    )}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
                      style={{ background: got ? `${b.color}20` : undefined }}
                    >
                      {b.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <div className="truncate text-xs font-medium">{b.name}</div>
                        {got?.pinned && <span title="Pinned" className="text-[10px]">📌</span>}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">{b.description}</div>
                      {editable && got && (
                        <button
                          onClick={() => togglePin.mutate(b.key)}
                          className="mt-0.5 text-[10px] text-primary opacity-0 transition group-hover:opacity-100"
                        >
                          {got.pinned ? "Unpin" : "Pin to profile"}
                        </button>
                      )}
                      {isManualClaim && (
                        <button
                          onClick={() =>
                            claimMut.mutate(b.key as "night_owl" | "early_bird")
                          }
                          className="mt-0.5 text-[10px] text-primary hover:underline"
                        >
                          Claim now
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */

export function PinnedBadges({ userId }: { userId: string }) {
  const { data: earned = [] } = useEarnedBadges(userId);
  const { data: catalog = [] } = useBadgeCatalog();
  const pinned = earned.filter((e) => e.pinned).slice(0, 5);
  const map = new Map(catalog.map((b) => [b.key, b]));
  if (pinned.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {pinned.map((e) => {
        const b = map.get(e.badge_key);
        if (!b) return null;
        return (
          <span
            key={e.badge_key}
            title={b.description}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-xs ring-1",
              TIER_RING[b.tier],
            )}
          >
            <span>{b.icon}</span>
            <span className="font-medium">{b.name}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ============================================================ */

export function AccomplishmentsList({
  profile,
  editable,
  onUpdated,
}: {
  profile: RichProfile;
  editable: boolean;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [emoji, setEmoji] = useState("🏆");

  const add = async () => {
    if (!title.trim()) return;
    const next = [
      ...profile.accomplishments,
      {
        title: title.trim(),
        description: desc.trim() || undefined,
        emoji,
        date: new Date().toISOString().slice(0, 10),
      },
    ];
    const { error } = await supabase
      .from("profiles")
      .update({ accomplishments: next })
      .eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success("Added");
    setOpen(false);
    setTitle("");
    setDesc("");
    setEmoji("🏆");
    onUpdated();
  };

  const remove = async (idx: number) => {
    const next = profile.accomplishments.filter((_, i) => i !== idx);
    const { error } = await supabase
      .from("profiles")
      .update({ accomplishments: next })
      .eq("id", profile.id);
    if (error) return toast.error(error.message);
    onUpdated();
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Flame className="h-3.5 w-3.5" />
          Things I'm proud of
        </h3>
        {editable && (
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        )}
      </div>
      {profile.accomplishments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {editable
            ? "Share a project, ship, lesson, or win that made you proud."
            : "Nothing here yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {profile.accomplishments.map((a, i) => (
            <li
              key={i}
              className="group flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
            >
              <div className="text-xl">{a.emoji ?? "🏆"}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm">{a.title}</div>
                  {a.date && (
                    <span className="text-[10px] text-muted-foreground">{a.date}</span>
                  )}
                </div>
                {a.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                )}
              </div>
              {editable && (
                <button
                  onClick={() => remove(i)}
                  className="text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add an accomplishment</DialogTitle>
            <DialogDescription>
              Something you shipped, learned, or want to remember.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
                className="w-14 text-center text-xl"
              />
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Shipped Aurora v1 to 500 users"
                className="flex-1"
              />
            </div>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="A bit of context (optional)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={add} disabled={!title.trim()}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ============================================================ */

export function ProfileEditor({
  profile,
  onUpdated,
}: {
  profile: RichProfile;
  onUpdated: () => void;
}) {
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [pronouns, setPronouns] = useState(profile.pronouns ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [skills, setSkills] = useState<string[]>(profile.skills);
  const [newSkill, setNewSkill] = useState("");
  const [links, setLinks] = useState(profile.links);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        pronouns: pronouns.trim() || null,
        location: location.trim() || null,
        skills,
        links: links.filter((l) => l.url.trim()),
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    onUpdated();
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s) return;
    if (skills.includes(s)) return setNewSkill("");
    setSkills([...skills, s]);
    setNewSkill("");
  };

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Your profile
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Headline">
          <Input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Product designer @ Aurora"
            maxLength={120}
          />
        </Field>
        <Field label="Pronouns">
          <Input
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
            placeholder="they/them"
            maxLength={40}
          />
        </Field>
        <Field label="Location">
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Lisbon, Portugal"
            maxLength={80}
          />
        </Field>
      </div>

      <Field label="Bio">
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="A short intro. What do you work on? What gets you out of bed?"
        />
        <div className="mt-1 text-right text-[10px] text-muted-foreground">
          {bio.length} / 500
        </div>
      </Field>

      <Field label="Skills">
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <Badge key={s} variant="secondary" className="gap-1">
              {s}
              <button onClick={() => setSkills(skills.filter((x) => x !== s))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
            placeholder="Add a skill"
            className="h-8"
          />
          <Button size="sm" variant="outline" onClick={addSkill}>Add</Button>
        </div>
      </Field>

      <Field label="Links">
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={l.label}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...next[i], label: e.target.value };
                  setLinks(next);
                }}
                placeholder="Label"
                className="h-8 w-32"
              />
              <Input
                value={l.url}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...next[i], url: e.target.value };
                  setLinks(next);
                }}
                placeholder="https://…"
                className="h-8 flex-1"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setLinks(links.filter((_, x) => x !== i))}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLinks([...links, { label: "", url: "" }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add link
          </Button>
        </div>
      </Field>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save profile
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
