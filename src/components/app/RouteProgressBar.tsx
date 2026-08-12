import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

/**
 * Top-of-page progress bar that animates while a route is loading.
 * Listens to TanStack Router's pending state — no extra deps.
 */
export function RouteProgressBar() {
  const isPending = useRouterState({ select: (s) => s.isLoading || s.isTransitioning });
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeOut = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isPending) {
      if (fadeOut.current) clearTimeout(fadeOut.current);
      setVisible(true);
      setProgress(8);
      let p = 8;
      const tick = () => {
        // Ease toward 90% while loading
        p = p + Math.max(0.5, (90 - p) * 0.08);
        setProgress(Math.min(p, 90));
        timer.current = setTimeout(tick, 180);
      };
      timer.current = setTimeout(tick, 180);
    } else {
      if (timer.current) clearTimeout(timer.current);
      setProgress(100);
      fadeOut.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 280);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [isPending]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-0.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease-out" }}
    >
      <div
        className="h-full bg-aura-gradient shadow-[0_0_8px_rgba(139,92,246,0.6)]"
        style={{
          width: `${progress}%`,
          transition: "width 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
    </div>
  );
}
