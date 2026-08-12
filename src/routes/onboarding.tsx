import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Sparkles,
  User,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Sun,
  Moon,
  Monitor,
  Handshake,
  Rocket,
  Briefcase,
  Mail,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";

import { isPersonalEmailDomain } from "@/lib/personal-email-domains";
import { createTourPlan, saveTourPlan } from "@/lib/welcome-tour";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

type Step = "choose" | "name" | "invite" | "theme";
type ThemeKey = "light" | "dark" | "system";
type AudienceKey = "solo" | "freelancer" | "agency" | "internal";

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "workspace"
  );
}

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  const fetchWs = useWorkspaceStore((s) => s.fetch);
  const [step, setStep] = useState<Step>("choose");
  const [wsName, setWsName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeKey>("system");
  const [isSolo, setIsSolo] = useState(false);
  const [chosenAudience, setChosenAudience] = useState<AudienceKey>("solo");
  const [inviteEmails, setInviteEmails] = useState<string[]>(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const [domainMatch, setDomainMatch] = useState<
    { id: string; name: string; logo_url: string | null; matched_domain: string } | null
  >(null);
  const [checkingDomain, setCheckingDomain] = useState(true);
  const [joining, setJoining] = useState(false);


  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("id, name, slug, owner_id, plan, kind, linked_delivery_workspace_id")
        .limit(1);
      if (data && data.length > 0) {
        setCurrent(data[0] as never);
        navigate({ to: "/app" });
        return;
      }
      // No workspaces yet — check if email domain claims an existing one
      if (user.email) {
        try {
          const { data: match } = await supabase.rpc("find_workspace_for_email", {
            _email: user.email,
          });
          const ws = Array.isArray(match) ? match[0] : null;
          if (ws?.id) {
            setDomainMatch(ws);
          }
        } catch (e) {
          console.warn("Domain match check failed", e);
        }
      }
      setCheckingDomain(false);
    })();
  }, [user, navigate, setCurrent]);

  const handleJoinExisting = async () => {
    if (!domainMatch) return;
    setJoining(true);
    try {
      await supabase.rpc("join_workspace_by_email_domain", {
        _workspace_id: domainMatch.id,
      });
      toast.success(`Joined ${domainMatch.name}`);
      await fetchWs();
      navigate({ to: "/app" });
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to join workspace");
      setJoining(false);
    }
  };

  const finalize = async (wsName: string, themeChoice: ThemeKey) => {
    if (!user) return;
    setBusy(true);
    try {
      const finalName =
        wsName.trim() ||
        orgName.trim() ||
        `${user.email?.split("@")[0] ?? "My"}'s workspace`;
      const baseSlug = slugify(finalName);
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      // Derive auto-join email domain from the owner's email if it's a
      // non-personal address. Lets future signups from that domain auto-join.
      const emailDomain = user.email?.split("@")[1]?.toLowerCase();
      const autoJoinDomains =
        orgName.trim() && emailDomain && !isPersonalEmailDomain(emailDomain) ? [emailDomain] : [];

      const audienceToMode: Record<AudienceKey, "solo" | "internal_team" | "client_services"> = {
        solo: "solo",
        freelancer: "client_services",
        agency: "client_services",
        internal: "internal_team",
      };

      const wsInsert: Record<string, unknown> = {
        name: finalName,
        slug,
        owner_id: user.id,
        auto_join_domains: autoJoinDomains,
        workspace_mode: audienceToMode[chosenAudience] ?? "client_services",
      };
      if (orgName.trim()) wsInsert.settings = { organization_name: orgName.trim() };


      const { data: ws, error: wsErr } = await supabase
        .from("workspaces")
        .insert(wsInsert as never)
        .select()
        .single();
      if (wsErr) {
        // Trigger blocks creation if email domain is already claimed
        const msg = wsErr.message || "";
        const claimMatch = msg.match(/EMAIL_DOMAIN_CLAIMED:([^:]+):(.+)/);
        if (claimMatch) {
          const claimedId = claimMatch[1];
          const claimedName = claimMatch[2];
          try {
            await supabase.rpc("join_workspace_by_email_domain", { _workspace_id: claimedId });
            toast.success(`Joined ${claimedName}`);
            await fetchWs();
            navigate({ to: "/app" });
            return;
          } catch (joinErr) {
            console.error(joinErr);
            toast.error(`Your email domain belongs to ${claimedName}. Please contact your admin.`);
            return;
          }
        }
        throw wsErr;
      }

      const [{ error: roleErr }, { error: memErr }] = await Promise.all([
        supabase.from("user_roles").insert({ user_id: user.id, workspace_id: ws.id, role: "owner" }),
        supabase.from("workspace_members").insert({ workspace_id: ws.id, user_id: user.id }),
      ]);
      if (roleErr) throw roleErr;
      if (memErr) throw memErr;

      // Upload logo if provided — must run AFTER the owner role insert above,
      // because the workspace-logos storage policy checks has_role(...).
      if (logoFile) {
        const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${ws.id}/logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("workspace-logos")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (!upErr) {
          const { data: pub } = supabase.storage.from("workspace-logos").getPublicUrl(path);
          await supabase
            .from("workspaces")
            .update({ logo_url: pub.publicUrl } as never)
            .eq("id", ws.id);
        } else {
          console.warn("Logo upload failed", upErr);
        }
      }

      // Create pending invitations for teammates entered during onboarding.
      const cleanInvites = inviteEmails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      if (cleanInvites.length > 0) {
        try {
          await supabase.from("workspace_invitations").insert(
            cleanInvites.map((email) => ({
              workspace_id: ws.id,
              email,
              invited_by: user.id,
              role: "member",
            })),
          );
        } catch (e) {
          console.warn("Invite creation failed", e);
        }
      }
      // Persona-aware welcome tour — the floating checklist in app shell
      // reads this from localStorage on next mount. New workspaces stay blank.
      saveTourPlan(
        createTourPlan({
          workspaceId: ws.id,
          audience: chosenAudience,
          primaryProjectId: null,
          seedTags: [],
        }),
      );

      // Persist theme preference + apply immediately
      await supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, theme: themeChoice }, { onConflict: "user_id" });
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      if (themeChoice === "system") {
        const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.add(sysDark ? "dark" : "light");
      } else {
        root.classList.add(themeChoice);
      }

      setCurrent(ws as never);
      await fetchWs();
      toast.success("Workspace ready");
      navigate({ to: "/app" });
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to create workspace");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user || checkingDomain) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If the user's email domain is already claimed by an existing workspace,
  // they MUST join that workspace — they cannot create a new one.
  if (domainMatch) {
    return (
      <div className="min-h-screen aura-mesh">
        <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
          <div className="mb-8 flex items-center justify-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aura-gradient shadow-pop">
              <Sparkles className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-semibold">Aurora</span>
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-pop text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-aura-gradient shadow-pop overflow-hidden">
              {domainMatch.logo_url ? (
                <img src={domainMatch.logo_url} alt={domainMatch.name} className="h-full w-full object-cover" />
              ) : (
                <Handshake className="h-7 w-7 text-primary-foreground" />
              )}
            </div>
            <h1 className="text-2xl font-semibold">Join {domainMatch.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your team at <span className="font-medium text-foreground">@{domainMatch.matched_domain}</span> already has
              a workspace on Aurora. To keep everyone on the same plan and data, you'll join the existing workspace.
            </p>
            <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-left text-sm">
              <p className="font-medium">Signed in as</p>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
            <Button
              onClick={handleJoinExisting}
              disabled={joining}
              className="mt-6 w-full bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
            >
              {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join {domainMatch.name}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              Need a separate workspace? Sign out and use a different email address.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const progress =
    step === "choose" ? 20
    : step === "name" ? 40
    : step === "invite" ? 60
    : step === "theme" ? 80
    : 100;


  const THEMES: { key: ThemeKey; label: string; description: string; icon: typeof Sun }[] = [
    { key: "light", label: "Light", description: "Bright and clean.", icon: Sun },
    { key: "dark", label: "Dark", description: "Easy on the eyes.", icon: Moon },
    { key: "system", label: "System", description: "Match your device.", icon: Monitor },
  ];

  return (
    <div className="min-h-screen aura-mesh">
      <div className="fixed left-0 right-0 top-0 z-10 h-1 bg-muted/30">
        <div
          className="h-full bg-aura-gradient transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aura-gradient shadow-pop">
            <Sparkles className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-semibold">Aurora</span>
        </div>

        {step === "choose" && (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-pop">
            <h1 className="text-2xl font-semibold">How will you use Aurora?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick what fits best — this just preselects sensible defaults. You can change anything later.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    key: "solo",
                    icon: User,
                    accent: "#22c55e",
                    title: "Just me",
                    desc: "Personal workspace for tasks and side projects.",
                    presetWsName: `${user.email?.split("@")[0] ?? "My"}'s workspace`,
                  },
                  {
                    key: "freelancer",
                    icon: Briefcase,
                    accent: "#0ea5e9",
                    title: "Freelancer with clients",
                    desc: "You + a roster of clients. Pipeline, engagements, deliverables.",
                    presetWsName: "",
                  },
                  {
                    key: "agency",
                    icon: Handshake,
                    accent: "#8b5cf6",
                    title: "Agency or client services",
                    desc: "A team delivering to external clients. Onboarding → Project flow.",
                    presetWsName: "",
                  },
                  {
                    key: "internal",
                    icon: Rocket,
                    accent: "#3b82f6",
                    title: "Internal product team",
                    desc: "Building your own product. Sprints, roadmap, backlog.",
                    presetWsName: "",
                  },
                ] as {
                  key: AudienceKey;
                  icon: LucideIcon;
                  accent: string;
                  title: string;
                  desc: string;
                  presetWsName: string;
                }[]
              ).map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setWsName(opt.presetWsName);
                      setIsSolo(opt.key === "solo");
                      setChosenAudience(opt.key);
                      setStep("name");
                    }}

                    disabled={busy}
                    className="group rounded-xl border border-border bg-background p-5 text-left transition-all hover:border-primary hover:shadow-pop disabled:opacity-60"
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${opt.accent}22`, color: opt.accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 font-semibold">{opt.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "name" && (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-pop">
            <button
              onClick={() => setStep("choose")}
              className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h1 className="text-2xl font-semibold">Set up your workspace</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All fields are optional — you can change everything later from settings.
            </p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setStep(isSolo ? "theme" : "invite");
              }}
            >
              <div>
                <Label htmlFor="org">Organization name <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="org"
                  autoFocus
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Inc."
                  className="mt-1.5"
                />
                {orgName.trim() &&
                  user.email &&
                  (() => {
                    const PERSONAL = new Set(["gmail.com","yahoo.com","hotmail.com","outlook.com","icloud.com","proton.me","protonmail.com","aol.com","live.com","me.com","msn.com"]);
                    const d = user.email.split("@")[1]?.toLowerCase();
                    if (!d || PERSONAL.has(d)) return null;
                    return (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Teammates with <span className="font-medium text-foreground">@{d}</span> emails will auto-join this workspace.
                      </p>
                    );
                  })()}
              </div>

              <div>
                <Label htmlFor="ws">Workspace name <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="ws"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder={orgName.trim() || "My workspace"}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Can differ from organization name (e.g. "Acme – Design").
                </p>
              </div>

              <div>
                <Label>Logo <span className="text-muted-foreground">(optional)</span></Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted text-sm font-semibold text-muted-foreground"
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                    ) : (
                      ((orgName || wsName || "A").slice(0, 2).toUpperCase())
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <input
                      id="logo"
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 2 * 1024 * 1024) {
                          toast.error("Logo must be under 2 MB");
                          return;
                        }
                        setLogoFile(f);
                        setLogoPreview(URL.createObjectURL(f));
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("logo")?.click()}>
                      {logoFile ? "Replace logo" : "Upload logo"}
                    </Button>
                    {logoFile && (
                      <button
                        type="button"
                        onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                        className="text-left text-xs text-muted-foreground hover:text-foreground"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </div>
        )}

        {step === "invite" && (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-pop">
            <button
              onClick={() => setStep("name")}
              className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h1 className="text-2xl font-semibold">Invite your team</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll email them an invite link. Skip this if you'd rather invite later from Settings.
            </p>

            <div className="mt-6 space-y-2">
              {inviteEmails.map((email, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        const next = [...inviteEmails];
                        next[idx] = e.target.value;
                        setInviteEmails(next);
                      }}
                      placeholder="teammate@company.com"
                      className="pl-9"
                    />
                  </div>
                  {inviteEmails.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setInviteEmails(inviteEmails.filter((_, i) => i !== idx))}
                      aria-label="Remove email"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setInviteEmails([...inviteEmails, ""])}
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus className="mr-1 h-4 w-4" /> Add another
              </Button>
            </div>

            {(() => {
              const PERSONAL = new Set(["gmail.com","yahoo.com","hotmail.com","outlook.com","icloud.com","proton.me","protonmail.com","aol.com","live.com","me.com","msn.com"]);
              const d = user.email?.split("@")[1]?.toLowerCase();
              if (!d || PERSONAL.has(d)) return null;
              return (
                <p className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Tip: anyone with a <span className="font-medium text-foreground">@{d}</span> email can auto-join later — these invites are for people outside your domain or to nudge teammates directly.
                </p>
              );
            })()}

            <div className="mt-6 flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setInviteEmails(["", "", ""]);
                  setStep("theme");
                }}
              >
                Skip for now
              </Button>
              <Button
                onClick={() => setStep("theme")}
                className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "theme" && (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-pop">
            <button
              onClick={() => setStep(isSolo ? "name" : "invite")}
              className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h1 className="text-2xl font-semibold">Choose your theme</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sets the look across Aurora. You can change it later in profile settings.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {THEMES.map((t) => {
                const Icon = t.icon;
                const active = theme === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTheme(t.key)}
                    className={`group rounded-xl border bg-background p-5 text-left transition-all hover:shadow-pop ${
                      active
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aura-gradient-subtle">
                      <Icon className="h-5 w-5 text-aura-gradient" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">{t.label}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => finalize(wsName.trim(), theme)}
                disabled={busy}
                className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create workspace <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
