import { useEffect, useRef, useState } from "react";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { Menu, Search, Bell, ArrowLeft } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";

interface Props {
  title?: string;
  showBack?: boolean;
}

export function MobileTopBar({ title, showBack = false }: Props) {
  const setMobileDrawerOpen = useUIStore((s) => s.setMobileDrawerOpen);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  // Auto-hide on scroll down, reveal on scroll up.
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const diff = y - lastY.current;
        if (y < 32) setHidden(false);
        else if (diff > 6) setHidden(true);
        else if (diff < -6) setHidden(false);
        lastY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const derivedTitle =
    title ??
    (path === "/app"
      ? "Today"
      : path.startsWith("/app/my-tasks")
        ? "My Tasks"
        : path.startsWith("/app/settings")
          ? "Settings"
          : path.startsWith("/app/notifications")
            ? "Notifications"
            : "");

  return (
    <header
      className={`sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1 border-b border-border bg-background/95 px-2 pt-safe backdrop-blur transition-transform duration-300 lg:hidden ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      {showBack ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => navigate({ to: ".." as never })}
          className="h-10 w-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={() => setMobileDrawerOpen(true)}
          className="h-10 w-10"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      <h1 className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
        {derivedTitle}
      </h1>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Search"
        onClick={() => setCommandOpen(true)}
        className="h-10 w-10"
      >
        <Search className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        onClick={() => navigate({ to: "/app/notifications" })}
        className="h-10 w-10"
      >
        <Bell className="h-5 w-5" />
      </Button>
    </header>
  );
}
