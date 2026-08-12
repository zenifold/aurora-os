import { cn } from "@/lib/utils";
import { formatTaskRef } from "@/lib/task-ref";
import type { Project, Task } from "@/lib/types";

interface Props {
  task: Pick<Task, "task_number"> | null | undefined;
  project: Pick<Project, "key" | "name"> | null | undefined;
  className?: string;
  /** Optional click handler (e.g. open task detail). */
  onClick?: (e: React.MouseEvent) => void;
  size?: "xs" | "sm";
}

/**
 * Mono-style ticket id badge ("AURA-42") used across views, detail header,
 * comments, breadcrumbs, etc.
 */
export function TaskRefBadge({ task, project, className, onClick, size = "xs" }: Props) {
  const ref = formatTaskRef(task, project);
  if (!ref) return null;
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center rounded border border-border bg-muted/40 px-1.5 font-mono tabular-nums text-muted-foreground",
        size === "xs" ? "h-4 text-[10px] leading-none" : "h-5 text-[11px]",
        onClick && "transition hover:border-primary/40 hover:text-foreground",
        className,
      )}
      title={`Task ${ref}`}
    >
      {ref}
    </Comp>
  );
}
