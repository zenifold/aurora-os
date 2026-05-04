import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useProject } from "@/hooks/use-projects";
import { StatusWorkflowBuilder } from "@/components/projects/StatusWorkflowBuilder";

export const Route = createFileRoute("/app/p/$projectId/settings")({
  component: ProjectSettingsPage,
});

function ProjectSettingsPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <Link
        to="/app/p/$projectId"
        params={{ projectId }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to project
      </Link>
      <h1 className="text-2xl font-semibold">Project settings</h1>
      <p className="text-sm text-muted-foreground">{project?.name}</p>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <StatusWorkflowBuilder projectId={projectId} />
      </div>
    </div>
  );
}
