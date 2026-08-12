import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProject } from "@/hooks/use-projects";
import { StrategyCanvas } from "@/components/canvas/StrategyCanvas";

export const Route = createFileRoute("/app/p/$projectId/canvas")({
  head: () => ({
    meta: [{ title: "Strategy Canvas" }],
  }),
  component: ProjectCanvasPage,
});

function ProjectCanvasPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 shrink-0">
            <Link to="/app/p/$projectId" params={{ projectId }} aria-label="Back to project">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Strategy Canvas
            </div>
            <h1 className="truncate text-base font-semibold leading-tight">
              {project?.name ?? "Project"}
            </h1>
          </div>
        </div>
        <p className="hidden max-w-md text-right text-xs text-muted-foreground md:block">
          Mind maps, phase plans, risk grids — the project's thinking space.
          Tasks live in Table and Kanban.
        </p>
      </header>
      <div className="flex-1 overflow-hidden">
        <StrategyCanvas projectId={projectId} />
      </div>
    </div>
  );
}
