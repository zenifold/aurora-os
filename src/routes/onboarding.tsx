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
  Users,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Layers,
  Bug,
  CalendarDays,
  CheckCircle2,
  FileText,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

type Step = "choose" | "name" | "theme" | "template";
type TemplateKey = "blank" | "sprint" | "content" | "bugs" | "personal";
type ThemeKey = "light" | "dark" | "system";

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "workspace"
  );
}

interface Template {
  key: TemplateKey;
  name: string;
  description: string;
  icon: typeof Sparkles;
  color: string;
  projectName: string;
  tasks: { title: string; status: string; priority: "low" | "medium" | "high" | "urgent" }[];
}

const TEMPLATES: Template[] = [
  {
    key: "blank",
    name: "Blank project",
    description: "Start with a clean slate.",
    icon: FileText,
    color: "#94a3b8",
    projectName: "My Project",
    tasks: [],
  },
  {
    key: "sprint",
    name: "Product sprint",
    description: "Backlog → In progress → Review → Done.",
    icon: Layers,
    color: "#8b5cf6",
    projectName: "Product Sprint",
    tasks: [
      { title: "Define sprint goal", status: "todo", priority: "high" },
      { title: "Refine top backlog items", status: "todo", priority: "medium" },
      { title: "Design new feature mockups", status: "in_progress", priority: "high" },
      { title: "Build API endpoints", status: "in_progress", priority: "high" },
      { title: "Write release notes", status: "review", priority: "medium" },
      { title: "Sprint retro", status: "todo", priority: "low" },
    ],
  },
  {
    key: "content",
    name: "Content calendar",
    description: "Idea → Writing → Review → Published.",
    icon: CalendarDays,
    color: "#ec4899",
    projectName: "Content Calendar",
    tasks: [
      { title: "Blog: launch announcement", status: "in_progress", priority: "high" },
      { title: "Newsletter: monthly recap", status: "todo", priority: "medium" },
      { title: "Social: feature highlights", status: "review", priority: "medium" },
      { title: "Case study: customer win", status: "todo", priority: "high" },
    ],
  },
  {
    key: "bugs",
    name: "Bug tracker",
    description: "Reported → Confirmed → In progress → Fixed.",
    icon: Bug,
    color: "#ef4444",
    projectName: "Bug Tracker",
    tasks: [
      { title: "Login button unresponsive on Safari", status: "todo", priority: "urgent" },
      { title: "Avatar fails to upload >5MB", status: "in_progress", priority: "high" },
      { title: "Timezone off by one in reports", status: "review", priority: "medium" },
      { title: "Typo on settings page", status: "todo", priority: "low" },
    ],
  },
  {
    key: "personal",
    name: "Personal tasks",
    description: "Simple to-do, doing, done.",
    icon: CheckCircle2,
    color: "#10b981",
    projectName: "Personal Tasks",
    tasks: [
      { title: "Plan the week ahead", status: "in_progress", priority: "high" },
      { title: "Reply to important emails", status: "todo", priority: "medium" },
      { title: "Workout 3x this week", status: "todo", priority: "medium" },
      { title: "Read for 30 minutes", status: "todo", priority: "low" },
    ],
  },
];

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  const fetchWs = useWorkspaceStore((s) => s.fetch);
  const [step, setStep] = useState<Step>("choose");
  const [wsName, setWsName] = useState("");
  const [theme, setTheme] = useState<ThemeKey>("system");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>("blank");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("id, name, slug, owner_id, plan")
        .limit(1);
      if (data && data.length > 0) {
        setCurrent(data[0]);
        navigate({ to: "/app" });
      }
    })();
  }, [user, navigate, setCurrent]);

  const finalize = async (wsName: string, tmplKey: TemplateKey, themeChoice: ThemeKey) => {
    if (!user) return;
    const tmpl = TEMPLATES.find((t) => t.key === tmplKey)!;
    setBusy(true);
    try {
      const baseSlug = slugify(wsName);
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: ws, error: wsErr } = await supabase
        .from("workspaces")
        .insert({ name: wsName, slug, owner_id: user.id })
        .select()
        .single();
      if (wsErr) throw wsErr;

      const [{ error: roleErr }, { error: memErr }] = await Promise.all([
        supabase.from("user_roles").insert({ user_id: user.id, workspace_id: ws.id, role: "owner" }),
        supabase.from("workspace_members").insert({ workspace_id: ws.id, user_id: user.id }),
      ]);
      if (roleErr) throw roleErr;
      if (memErr) throw memErr;

      const { data: proj, error: projErr } = await supabase
        .from("projects")
        .insert({
          workspace_id: ws.id,
          name: tmpl.projectName,
          color: tmpl.color,
          icon: "sparkles",
          created_by: user.id,
        })
        .select()
        .single();
      if (projErr) throw projErr;

      await supabase.from("views").insert({
        workspace_id: ws.id,
        project_id: proj.id,
        name: "All tasks",
        view_type: "table",
        is_default: true,
        config: {},
        filters: [],
        sorts: [],
        created_by: user.id,
      });

      if (tmpl.tasks.length > 0) {
        await supabase.from("tasks").insert(
          tmpl.tasks.map((t, i) => ({
            workspace_id: ws.id,
            project_id: proj.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            position: i * 1000,
            created_by: user.id,
          }))
        );
      }

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

      setCurrent(ws);
      await fetchWs();
      toast.success("Workspace ready");
      navigate({ to: "/app/p/$projectId", params: { projectId: proj.id } });
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to create workspace");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progress = step === "choose" ? 33 : step === "team" ? 66 : 100;

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
          <span className="text-2xl font-semibold">Aura</span>
        </div>

        {step === "choose" && (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-pop">
            <h1 className="text-2xl font-semibold">How will you use Aura?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick one — you can always invite people later.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => {
                  const name = `${user.email?.split("@")[0] ?? "My"}'s workspace`;
                  setPendingWsName(name);
                  setStep("template");
                }}
                disabled={busy}
                className="group rounded-xl border border-border bg-background p-5 text-left transition-all hover:border-primary hover:shadow-pop disabled:opacity-60"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aura-gradient-subtle">
                  <User className="h-5 w-5 text-aura-gradient" />
                </div>
                <h3 className="mt-3 font-semibold">I'm starting solo</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Personal workspace with a starter template.
                </p>
              </button>

              <button
                onClick={() => setStep("team")}
                disabled={busy}
                className="group rounded-xl border border-border bg-background p-5 text-left transition-all hover:border-primary hover:shadow-pop disabled:opacity-60"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aura-gradient-subtle">
                  <Users className="h-5 w-5 text-aura-gradient" />
                </div>
                <h3 className="mt-3 font-semibold">I'm setting up a team</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Name your workspace and pick a template.
                </p>
              </button>
            </div>
          </div>
        )}

        {step === "team" && (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-pop">
            <button
              onClick={() => setStep("choose")}
              className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h1 className="text-2xl font-semibold">Name your workspace</h1>
            <p className="mt-1 text-sm text-muted-foreground">This is your team's home in Aura.</p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (teamName.trim()) {
                  setPendingWsName(teamName.trim());
                  setStep("template");
                }
              }}
            >
              <div>
                <Label htmlFor="ws">Workspace name</Label>
                <Input
                  id="ws"
                  autoFocus
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Acme Inc."
                  className="mt-1.5"
                />
              </div>
              <Button
                type="submit"
                disabled={!teamName.trim()}
                className="w-full bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </div>
        )}

        {step === "template" && (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-pop">
            <button
              onClick={() => setStep(pendingWsName?.includes("workspace") ? "choose" : "team")}
              className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              disabled={busy}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h1 className="text-2xl font-semibold">Pick a starting template</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll create your first project with a few sample tasks.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES.map((t) => {
                const Icon = t.icon;
                const active = selectedTemplate === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setSelectedTemplate(t.key)}
                    disabled={busy}
                    className={`group relative rounded-xl border bg-background p-4 text-left transition-all hover:shadow-pop disabled:opacity-60 ${
                      active
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${t.color}22`, color: t.color }}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">{t.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                    {t.tasks.length > 0 && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {t.tasks.length} sample tasks
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep("choose")} disabled={busy}>
                Cancel
              </Button>
              <Button
                onClick={() => pendingWsName && finalize(pendingWsName, selectedTemplate)}
                disabled={busy || !pendingWsName}
                className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create workspace
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
