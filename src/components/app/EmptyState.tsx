import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  primaryAction?: {
    label: string;
    to?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    to?: string;
    onClick?: () => void;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Standardized empty state for any list/page with no data.
 * Always pair an empty state with a clear next action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  size = "md",
}: EmptyStateProps) {
  const padding = size === "sm" ? "py-8" : size === "lg" ? "py-20" : "py-14";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 px-6 text-center",
        padding,
        className,
      )}
    >
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-aura-gradient-subtle">
          <Icon className="h-6 w-6 text-foreground/70" />
        </div>
      )}
      <h3 className="text-base font-medium">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {primaryAction &&
            (primaryAction.to ? (
              <Button asChild className="bg-aura-gradient text-primary-foreground hover:opacity-90">
                <Link to={primaryAction.to as never}>{primaryAction.label}</Link>
              </Button>
            ) : (
              <Button
                onClick={primaryAction.onClick}
                className="bg-aura-gradient text-primary-foreground hover:opacity-90"
              >
                {primaryAction.label}
              </Button>
            ))}
          {secondaryAction &&
            (secondaryAction.to ? (
              <Button asChild variant="outline">
                <Link to={secondaryAction.to as never}>{secondaryAction.label}</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}
