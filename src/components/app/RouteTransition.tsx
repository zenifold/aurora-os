import { useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";

/**
 * Wraps page content with a subtle fade + rise transition on route change.
 * Uses the route pathname as the React key so the animation re-runs per route.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div key={pathname} className="animate-page-in h-full">
      {children}
    </div>
  );
}
