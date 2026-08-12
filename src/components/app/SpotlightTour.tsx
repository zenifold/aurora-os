import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, X } from "lucide-react";

export interface SpotlightStop {
  id: string;
  selector: string;
  title: string;
  body: string;
  /** Optional route to navigate to before searching for selector */
  route?: { to: string; params?: Record<string, string> };
  /** Extra padding around the highlighted element (px) */
  padding?: number;
  /** Preferred placement of tooltip */
  placement?: "top" | "bottom" | "left" | "right" | "auto";
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  stops: SpotlightStop[];
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const PAD_DEFAULT = 8;
const TOOLTIP_W = 320;
const TOOLTIP_GAP = 14;

export function SpotlightTour({ stops, open, onClose, onComplete }: Props) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);

  const stop = stops[index];

  // Reset when opened
  useEffect(() => {
    if (open) {
      setIndex(0);
    }
  }, [open]);

  // Navigate then locate target
  const locate = useCallback(() => {
    if (!stop) return;
    const el = document.querySelector(stop.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      setMissing(true);
      return;
    }
    setMissing(false);
    el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    // Wait one frame for scroll to settle
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    });
  }, [stop]);

  useLayoutEffect(() => {
    if (!open || !stop) return;
    let cancelled = false;
    const run = async () => {
      if (stop.route) {
        try {
          await navigate({ to: stop.route.to as any, params: stop.route.params as any });
        } catch {
          /* ignore nav errors */
        }
      }
      // Give the page a moment to mount the target
      const tries = [80, 200, 400, 800];
      for (const delay of tries) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, delay));
        const el = document.querySelector(stop.selector);
        if (el) break;
      }
      if (!cancelled) locate();
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  // Reposition on resize/scroll
  useEffect(() => {
    if (!open) return;
    const handler = () => locate();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [open, locate]);

  if (!open || !stop) return null;

  const pad = stop.padding ?? PAD_DEFAULT;
  const total = stops.length;
  const isLast = index === total - 1;

  const next = () => {
    if (isLast) {
      onComplete?.();
      onClose();
    } else {
      setIndex((i) => i + 1);
    }
  };
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  // Compute tooltip position
  let tipTop = 80;
  let tipLeft = 24;
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const placement =
      stop.placement && stop.placement !== "auto"
        ? stop.placement
        : spaceBelow > 200
          ? "bottom"
          : spaceAbove > 200
            ? "top"
            : "bottom";

    if (placement === "bottom") {
      tipTop = rect.top + rect.height + TOOLTIP_GAP;
      tipLeft = Math.min(Math.max(12, rect.left + rect.width / 2 - TOOLTIP_W / 2), vw - TOOLTIP_W - 12);
    } else if (placement === "top") {
      tipTop = rect.top - TOOLTIP_GAP - 180;
      tipLeft = Math.min(Math.max(12, rect.left + rect.width / 2 - TOOLTIP_W / 2), vw - TOOLTIP_W - 12);
    } else if (placement === "right") {
      tipTop = Math.max(12, rect.top);
      tipLeft = Math.min(rect.left + rect.width + TOOLTIP_GAP, vw - TOOLTIP_W - 12);
    } else {
      tipTop = Math.max(12, rect.top);
      tipLeft = Math.max(12, rect.left - TOOLTIP_W - TOOLTIP_GAP);
    }
    tipTop = Math.min(Math.max(12, tipTop), vh - 200);
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] animate-fade-in" aria-live="polite">
      {/* Dim layer with cut-out */}
      {rect && !missing ? (
        <div
          className="pointer-events-auto absolute rounded-xl ring-2 ring-aura-purple/80 transition-all duration-300"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow:
              "0 0 0 9999px rgba(7, 10, 25, 0.65), 0 0 0 4px rgba(168, 85, 247, 0.35), 0 0 28px 6px rgba(168, 85, 247, 0.45)",
            animation: "tour-pulse 2.2s ease-in-out infinite",
          }}
        />
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-[rgba(7,10,25,0.65)]" />
      )}

      {/* Tooltip card */}
      <div
        className="pointer-events-auto absolute w-80 rounded-xl border border-border bg-card p-4 shadow-pop animate-scale-in"
        style={{ top: tipTop, left: tipLeft, width: TOOLTIP_W }}
        role="dialog"
        aria-labelledby="spotlight-title"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-aura-purple">
            Step {index + 1} of {total}
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close tour"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <h3 id="spotlight-title" className="text-base font-semibold leading-tight">
          {stop.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{stop.body}</p>
        {missing && (
          <p className="mt-2 rounded-md bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
            We couldn't find this element on the current page — click Next to continue.
          </p>
        )}
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Skip
          </Button>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <Button variant="outline" size="sm" onClick={prev}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={next}
              className="bg-aura-gradient text-primary-foreground hover:opacity-90"
            >
              {isLast ? "Finish" : "Next"}
              {!isLast && <ArrowRight className="ml-1 h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        {/* Progress dots */}
        <div className="mt-3 flex items-center justify-center gap-1">
          {stops.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === index ? "w-5 bg-aura-purple" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(7,10,25,0.65), 0 0 0 4px rgba(168,85,247,0.35), 0 0 24px 4px rgba(168,85,247,0.35); }
          50%      { box-shadow: 0 0 0 9999px rgba(7,10,25,0.65), 0 0 0 6px rgba(168,85,247,0.55), 0 0 36px 10px rgba(168,85,247,0.55); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
