import { useMemo } from "react";
import type { Page } from "@/lib/page-types";

interface Props {
  page: Page;
}

/**
 * Decorative gradient band rendered above a page's title. Color is derived
 * deterministically from the page id so every doc gets a stable identity,
 * with a subtle hue shift per page type.
 */
export function PageCoverBand({ page }: Props) {
  const style = useMemo(() => {
    // Stable hash from id
    let hash = 0;
    for (let i = 0; i < page.id.length; i++) hash = (hash * 31 + page.id.charCodeAt(i)) >>> 0;
    const baseHue = hash % 360;
    // Per-type accent
    const typeShift: Record<string, number> = {
      doc: 0,
      prd: 25,
      decision: 200,
      journal: 280,
      runbook: 10,
      meeting_notes: 160,
      canvas: 320,
      plan: 220,
      folder: 60,
    };
    const h1 = (baseHue + (typeShift[page.page_type] ?? 0)) % 360;
    const h2 = (h1 + 40) % 360;
    return {
      background: `linear-gradient(120deg, oklch(0.72 0.14 ${h1}) 0%, oklch(0.78 0.10 ${h2}) 100%)`,
    } as React.CSSProperties;
  }, [page.id, page.page_type]);

  return (
    <div
      className="relative h-28 w-full overflow-hidden lg:h-36"
      aria-hidden
    >
      <div className="absolute inset-0" style={style} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      <div
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6), transparent 40%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.25), transparent 50%)",
        }}
      />
    </div>
  );
}
