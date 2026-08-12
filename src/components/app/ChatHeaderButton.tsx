import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { useChannelUnreadCounts } from "@/hooks/use-channels";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export function ChatHeaderButton() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: unreadMap } = useChannelUnreadCounts();
  const unread = useMemo(() => {
    if (!unreadMap) return 0;
    let n = 0;
    for (const v of Object.values(unreadMap)) n += v.unread_count;
    return n;
  }, [unreadMap]);
  const active = path.startsWith("/app/chat");
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className={cn("relative h-8 w-8", active && "bg-accent")}
      aria-label="Chat"
      title="Chat"
    >
      <Link to="/app/chat" search={{ c: undefined }}>
        <MessageSquare className="h-4 w-4" />
        {unread > 0 && (
          <Badge
            variant="default"
            className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none"
          >
            {unread > 99 ? "99+" : unread}
          </Badge>
        )}
      </Link>
    </Button>
  );
}
