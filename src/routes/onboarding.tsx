import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, User, Users, Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

type Step = "choose" | "team";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "workspace";
}

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  const fetchWs = useWorkspaceStore((s) => s.fetch);
  const [step, setStep] = useState<Step>("choose");
  const [teamName, setTeamName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  // If user already has a workspace, skip
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

  const createWorkspace = async (name: string, seedDemo: boolean) => {
    if (!user) return;
    setBusy(true);
    try {
      const baseSlug = slugify(name);
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: ws, error: wsErr } = await supabase
        .from("workspaces")
        .insert({ name, slug, owner_id: user.id })
        .select()
        .single();
      if (wsErr) throw wsErr;

      // Add owner role + member record
      const [{ error: roleErr }, { error: memErr }] = await Promise.all([
        supabase.from("user_roles").insert({ user_id: user.id, workspace_id: ws.id, role: "owner" }),
        supabase.from("workspace_members").insert({ workspace_id: ws.id, user_id: user.id }),
      ]);
      if (roleErr) throw roleErr;
      if (memErr) throw memErr;

      // Create first project
      const projectName = seedDemo ? "Welcome to Aura" : "My Project";
      const { data: proj, error: projErr } = await supabase
        .from("projects")
        .insert({ workspace_id: ws.id, name: projectName, color: "#8b5cf6", icon: "sparkles", created_by: user.id })
        .select()
        .single();
      if (projErr) throw projErr;

      // Default view
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

      // Seed demo tasks
      if (seedDemo) {
        const demoTasks = [
          { title: "👋 Welcome to Aura — start here", status: "todo", priority: "high" as const },
          { title: "Try editing this row inline", status: "todo", priority: "medium" as const },
          { title: "Click to open the task panel", status: "in_progress", priority: "high" as const },
          { title: "Add a custom field with the + button", status: "in_progress", priority: "medium" as const },
          { title: "Filter and sort to find what matters", status: "review", priority: "low" as const },
          { title: "Save this configuration as a view", status: "review", priority: "medium" as const },
          { title: "Invite a teammate from Settings → Members", status: "todo", priority: "low" as const },
          { title: "Ship something great ✨", status: "done", priority: "urgent" as const },
        ];
        await supabase.from("tasks").insert(
          demoTasks.map((t, i) => ({
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

  return (
    <div className="min-h-screen aura-mesh">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
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
                onClick={() => createWorkspace(`${user.email?.split("@")[0] ?? "My"}'s workspace`, true)}
                disabled={busy}
                className="group rounded-xl border border-border bg-background p-5 text-left transition-all hover:border-primary hover:shadow-pop disabled:opacity-60"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aura-gradient-subtle">
                  <User className="h-5 w-5 text-aura-gradient" />
                </div>
                <h3 className="mt-3 font-semibold">I'm starting solo</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Personal workspace with a demo project to explore.
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
                  Name your workspace and invite teammates next.
                </p>
              </button>
            </div>
            {busy && (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Setting things up…
              </p>
            )}
          </div>
        )}

        {step === "team" && (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-pop">
            <button onClick={() => setStep("choose")} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h1 className="text-2xl font-semibold">Name your workspace</h1>
            <p className="mt-1 text-sm text-muted-foreground">This is your team's home in Aura.</p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (teamName.trim()) createWorkspace(teamName.trim(), false);
              }}
            >
              <div>
                <Label htmlFor="ws">Workspace name</Label>
                <Input id="ws" autoFocus value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Acme Inc." className="mt-1.5" />
              </div>
              <Button type="submit" disabled={busy || !teamName.trim()} className="w-full bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create workspace
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
