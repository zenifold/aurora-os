import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-border/60 bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-pop backdrop-blur md:bottom-4"
    >
      <span className="inline-flex items-center gap-1.5">
        <WifiOff className="h-3.5 w-3.5" />
        Offline — changes will sync when you reconnect
      </span>
    </div>
  );
}
