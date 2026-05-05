import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Reusable loading scaffolds. All scaffolds animate in via `.animate-page-in`
 * and use the shimmer Skeleton.
 */

export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-page-in space-y-3", className)}>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="stagger-children grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4 space-y-2"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("stagger-children space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3"
        >
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 8,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="animate-page-in overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-12 gap-3 border-b border-border bg-muted/30 px-4 py-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton
            key={i}
            className="col-span-2 h-3 first:col-span-4"
          />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid grid-cols-12 gap-3 px-4 py-3"
            style={{ animation: `aura-page-in 320ms ${r * 30}ms both` }}
          >
            {Array.from({ length: cols }).map((__, c) => (
              <Skeleton
                key={c}
                className="col-span-2 h-3.5 first:col-span-4"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function KanbanSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="animate-page-in flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: columns }).map((_, c) => (
        <div
          key={c}
          className="w-72 shrink-0 space-y-3 rounded-xl bg-muted/40 p-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-6 rounded-full" />
          </div>
          {Array.from({ length: 3 + (c % 2) }).map((__, i) => (
            <div
              key={i}
              className="space-y-2 rounded-lg border border-border bg-card p-3"
            >
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-1.5 pt-1">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-page-in space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={3} />
      <div className="grid gap-4 lg:grid-cols-[1.6fr,1fr]">
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <ListSkeleton rows={4} />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function SidebarTreeSkeleton() {
  return (
    <div className="space-y-1.5 px-2 py-2">
      {Array.from({ length: 3 }).map((_, sec) => (
        <div key={sec} className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <div className="ml-4 space-y-1">
            {Array.from({ length: 2 + (sec % 2) }).map((__, i) => (
              <Skeleton key={i} className="h-4 w-3/4" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
