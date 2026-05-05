import { useTaskStatusHistory } from "@/hooks/use-project-workflow";
import { History, Clock } from "lucide-react";
import { formatDistanceStrict, formatDistanceToNow } from "date-fns";

/**
 * Vertical timeline showing the task's status history with dwell times.
 */
export function StatusHistoryTimeline({ taskId }: { taskId: string }) {
  const { data: history = [], isLoading } = useTaskStatusHistory(taskId);

  if (isLoading) return null;
  if (history.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
        No status changes recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4 text-primary" /> Status history
      </div>
      <ol className="relative space-y-3 border-l border-border pl-4">
        {history.map((row, idx) => {
          const enteredAt = new Date(row.entered_at);
          const leftAt = row.left_at ? new Date(row.left_at) : null;
          const dwell = leftAt
            ? formatDistanceStrict(leftAt, enteredAt)
            : `${formatDistanceStrict(new Date(), enteredAt)} (current)`;
          const isLatest = idx === 0;
          return (
            <li key={row.id} className="relative">
              <span
                className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-background ${
                  isLatest ? "bg-primary" : "bg-muted-foreground/40"
                }`}
              />
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {row.from_status_name && (
                  <>
                    <span className="text-muted-foreground">{row.from_status_name}</span>
                    <span className="text-muted-foreground">→</span>
                  </>
                )}
                <span className="font-medium">{row.to_status_name ?? "Unknown"}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{formatDistanceToNow(enteredAt, { addSuffix: true })}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" /> {dwell}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
