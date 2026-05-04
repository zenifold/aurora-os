import { useTaskActivity, type ActivityEntry } from "@/hooks/use-activity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

export function ActivityFeed({ taskId }: { taskId: string }) {
  const { data: entries = [], isLoading } = useTaskActivity(taskId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;

  return (
    <ul className="space-y-3">
      {entries.map((e) => (
        <li key={e.id} className="flex items-start gap-2">
          <Avatar className="h-6 w-6">
            {e.actor?.avatar_url && <AvatarImage src={e.actor.avatar_url} alt={e.actor.display_name ?? ""} />}
            <AvatarFallback className="text-[10px]">{(e.actor?.display_name ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-sm">
            <span className="font-medium">{e.actor?.display_name ?? "Someone"}</span>{" "}
            <span className="text-muted-foreground">{describe(e)}</span>
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function describe(e: ActivityEntry): string {
  if (e.action === "created") return "created this task";
  if (e.action === "deleted") return "deleted this task";
  if (e.action === "updated" && e.changes) {
    const keys = Object.keys(e.changes);
    if (keys.length === 0) return "updated this task";
    const k = keys[0];
    const change = (e.changes as Record<string, { from?: unknown; to?: unknown }>)[k];
    const to = change?.to;
    if (to === undefined || to === null || to === "") return `cleared ${humanize(k)}`;
    return `set ${humanize(k)} to ${String(to)}`;
  }
  return e.action;
}

function humanize(key: string): string {
  return key.replace(/_/g, " ");
}
