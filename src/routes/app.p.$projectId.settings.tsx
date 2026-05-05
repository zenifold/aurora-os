import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useProject } from "@/hooks/use-projects";
import { StatusWorkflowBuilder } from "@/components/projects/StatusWorkflowBuilder";
import { TransitionMatrix } from "@/components/projects/TransitionMatrix";
import { WorkflowTemplatePicker } from "@/components/projects/WorkflowTemplatePicker";
import { ClientEngagementSettings } from "@/components/projects/ClientEngagementSettings";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/p/$projectId/settings")({
  component: ProjectSettingsPage,
});

function ProjectSettingsPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <Link
        to="/app/p/$projectId"
        params={{ projectId }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to project
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Project settings</h1>
          <p className="text-sm text-muted-foreground">{project?.name}</p>
        </div>
        <WorkflowTemplatePicker projectId={projectId} />
      </div>

      <Tabs defaultValue="engagement" className="mt-6">
        <TabsList>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="statuses">Statuses</TabsTrigger>
          <TabsTrigger value="transitions">Transitions</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            {project ? (
              <ClientEngagementSettings project={project} />
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="statuses" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <StatusWorkflowBuilder projectId={projectId} />
          </div>
        </TabsContent>

        <TabsContent value="transitions" className="mt-4">
          <div className="space-y-2 rounded-xl border border-border bg-card p-4 sm:p-6">
            <h3 className="text-base font-medium">Transition matrix</h3>
            <p className="text-sm text-muted-foreground">
              Click any cell to allow a path and configure gates, permissions, and confirmation messages.
              Diagonal cells (status → itself) are not transitions.
            </p>
            <div className="pt-3">
              <TransitionMatrix projectId={projectId} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
