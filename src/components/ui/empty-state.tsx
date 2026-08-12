import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Compact variant for inline / small areas */
  compact?: boolean;
}

/**
 * Standardized empty state. Use everywhere a list or section has zero items.
 * Pairs with <ListSkeleton /> for the loading state.
 */
export function EmptyState({ icon: Icon, title, description, action, className, compact }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 text-center",
        compact ? "px-4 py-8" : "px-6 py-12",
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "mb-3 flex items-center justify-center rounded-full bg-aura-gradient-subtle text-foreground/70",
            compact ? "h-9 w-9" : "h-12 w-12",
          )}
        >
          <Icon className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
        </div>
      )}
      <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>{title}</p>
      {description && (
        <p
          className={cn(
            "mt-1 max-w-sm text-muted-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
