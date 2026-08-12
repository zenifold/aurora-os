import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useChannels } from "@/hooks/use-channels";
import { useProject } from "@/hooks/use-projects";
import { ChannelView } from "@/components/chat/ChannelView";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/p/$projectId/chat")({
  component: ProjectChatPage,
});

function ProjectChatPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: channels = [], isLoading } = useChannels({ projectId });

  const general = useMemo(
    () => channels.find((c) => c.slug === "general") ?? channels[0],
    [channels],
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Link
          to="/app/p/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {project?.name ?? "Project"}
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : general ? (
          <ChannelView channelId={general.id} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No channel for this project yet.
          </div>
        )}
      </div>
    </div>
  );
}
