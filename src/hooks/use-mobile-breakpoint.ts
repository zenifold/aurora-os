import { useEffect, useState } from "react";

/**
 * Returns true when viewport is below 1024px (lg breakpoint).
 * Mobile shell should render in this range per the spec.
 */
export function useIsMobile(query = "(max-width: 1023px)") {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    setMatches(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
