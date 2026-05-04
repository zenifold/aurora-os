import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/lib/types";
import { Folder, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateProject } from "@/hooks/use-projects";

export const Route = createFileRoute("/app/")({
  component: AppHome,
});

function AppHome() {
  const ws = useWorkspaceStore((s) => s.current);
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const handleCreate = async () => {
    if (!ws) return;
    const proj = await createProject.mutateAsync({ name: "Untitled project" });
    navigate({ to: "/app/p/$projectId", params: { projectId: proj.id } });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome to <span className="text-aura-gradient">{ws?.name}</span>
          </h1>
          <p className="mt-1 text-muted-foreground">Pick a project or start something new.</p>
        </div>
        <Button onClick={handleCreate} className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
          <Plus className="mr-1.5 h-4 w-4" /> New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-border bg-aura-gradient-subtle p-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-aura-gradient shadow-pop">
            <Folder className="h-6 w-6 text-primary-foreground" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">No projects yet</h2>
          <p className="mt-1 text-muted-foreground">Create your first project to get started.</p>
          <Button onClick={handleCreate} className="mt-6 bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
            <Plus className="mr-1.5 h-4 w-4" /> Create project
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/app/p/$projectId"
              params={{ projectId: p.id }}
              className="group rounded-2xl border border-border bg-card p-5 shadow-elegant transition-all hover:shadow-pop"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${p.color}22`, color: p.color }}>
                <Folder className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-semibold">{p.name}</h3>
              {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
