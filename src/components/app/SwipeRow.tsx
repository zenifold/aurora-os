import { useRef, useState, type PointerEvent, type ReactNode } from "react";

interface SwipeAction {
  label: string;
  icon?: ReactNode;
  color: string; // tailwind bg-* class
  onAction: () => void;
}

interface Props {
  children: ReactNode;
  leftAction?: SwipeAction;   // revealed by swiping right
  rightActions?: SwipeAction[]; // revealed by swiping left
  threshold?: number;
  className?: string;
}

/**
 * Lightweight horizontal-swipe row.
 * - Swipe right past threshold triggers `leftAction` immediately on release.
 * - Swipe left snaps open to reveal `rightActions`.
 */
export function SwipeRow({
  children,
  leftAction,
  rightActions = [],
  threshold = 80,
  className = "",
}: Props) {
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false); // left actions revealed
  const start = useRef<{ x: number; y: number } | null>(null);
  const locked = useRef<"x" | "y" | null>(null);

  const actionsWidth = rightActions.length * 72;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY };
    locked.current = null;
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dxRaw = e.clientX - start.current.x;
    const dyRaw = e.clientY - start.current.y;
    if (!locked.current) {
      if (Math.abs(dxRaw) < 8 && Math.abs(dyRaw) < 8) return;
      locked.current = Math.abs(dxRaw) > Math.abs(dyRaw) ? "x" : "y";
    }
    if (locked.current !== "x") return;
    const baseDx = open ? -actionsWidth : 0;
    let next = baseDx + dxRaw;
    if (!leftAction && next > 0) next = 0;
    if (rightActions.length === 0 && next < 0) next = 0;
    next = Math.max(-actionsWidth - 40, Math.min(120, next));
    setDx(next);
  };
  const onPointerUp = () => {
    if (!start.current) return;
    start.current = null;
    if (locked.current !== "x") {
      setDx(0);
      return;
    }
    locked.current = null;
    if (leftAction && dx > threshold) {
      // Trigger immediately
      setDx(0);
      leftAction.onAction();
      return;
    }
    if (rightActions.length > 0 && dx < -threshold / 2) {
      setOpen(true);
      setDx(-actionsWidth);
      return;
    }
    setOpen(false);
    setDx(0);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Left action background */}
      {leftAction && dx > 0 && (
        <div
          className={`absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-white ${leftAction.color}`}
          style={{ width: Math.max(dx, 0) }}
        >
          {leftAction.icon}
          <span className="ml-2">{leftAction.label}</span>
        </div>
      )}

      {/* Right actions */}
      {rightActions.length > 0 && (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: actionsWidth }}>
          {rightActions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                a.onAction();
                setOpen(false);
                setDx(0);
              }}
              className={`flex w-[72px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-white ${a.color}`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${dx}px)`,
          transition: start.current ? undefined : "transform 200ms ease-out",
          touchAction: "pan-y",
        }}
        className="relative bg-background"
      >
        {children}
      </div>
    </div>
  );
}
