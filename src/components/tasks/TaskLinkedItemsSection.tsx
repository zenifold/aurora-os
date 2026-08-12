import { useTaskLinks, useUnlinkFromTask, type TaskLink } from "@/hooks/use-task-links";
import { Button } from "@/components/ui/button";
import { FileText, Map, Palette, Link2, X } from "lucide-react";

const ICONS: Record<TaskLink["link_kind"], React.ReactNode> = {
  page: <FileText className="h-3.5 w-3.5" />,
  plan: <Map className="h-3.5 w-3.5" />,
  canvas: <Palette className="h-3.5 w-3.5" />,
  document: <FileText className="h-3.5 w-3.5" />,
  task: <Link2 className="h-3.5 w-3.5" />,
};

export function TaskLinkedItemsSection({ taskId }: { taskId: string }) {
  const { data: links = [] } = useTaskLinks(taskId);
  const unlink = useUnlinkFromTask(taskId);

  if (links.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Linked items
      </h4>
      <ul className="space-y-1">
        {links.map((l) => (
          <li
            key={l.id}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-sm"
          >
            <span className="text-muted-foreground">{l.target?.icon ?? ICONS[l.link_kind]}</span>
            <span className="flex-1 truncate">{l.target?.title ?? l.label ?? l.target_id}</span>
            <span className="text-[10px] uppercase text-muted-foreground">{l.link_kind}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => unlink.mutate(l.id)}
              title="Unlink"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
