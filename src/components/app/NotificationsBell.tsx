import { useMemo, useState } from "react";
import { Bell, Check, Trash2, AtSign, UserPlus, MessageSquare, Clock, AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useDeleteNotification,
  type Notification,
} from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

const ICONS: Record<string, { icon: typeof Bell; color: string }> = {
  assigned: { icon: UserPlus, color: "text-purple-500" },
  mentioned: { icon: AtSign, color: "text-pink-500" },
  comment: { icon: MessageSquare, color: "text-emerald-500" },
  status: { icon: CheckCircle2, color: "text-blue-500" },
  due_soon: { icon: Clock, color: "text-amber-500" },
  overdue: { icon: AlertTriangle, color: "text-red-500" },
  invite: { icon: Mail, color: "text-indigo-500" },
};

function NotificationRow({ n, onClick }: { n: Notification; onClick: () => void }) {
  const meta = ICONS[n.type] ?? { icon: Bell, color: "text-muted-foreground" };
  const Icon = meta.icon;
  const markRead = useMarkNotificationRead();
  const remove = useDeleteNotification();
  const unread = !n.read_at;
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex cursor-pointer gap-3 border-b border-border px-3 py-2.5 hover:bg-accent/50",
        unread && "bg-primary/5"
      )}
    >
      {unread && <span className="absolute left-0 top-0 h-full w-[3px] bg-primary" />}
      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted", meta.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{n.title}</p>
        {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {unread && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              markRead.mutate(n.id);
            }}
            aria-label="Mark read"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            remove.mutate(n.id);
          }}
          aria-label="Dismiss"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();
  const navigate = useNavigate();

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read_at).length, [notifications]);

  const handleClick = (n: Notification) => {
    if (!n.read_at) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) navigate({ to: n.link as never });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h3 className="text-sm font-semibold">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markAll.mutate()}>
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[60vh]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <Bell className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">You're all caught up</p>
              <p className="mt-1 text-xs text-muted-foreground">New activity will show up here.</p>
            </div>
          ) : (
            notifications.map((n) => <NotificationRow key={n.id} n={n} onClick={() => handleClick(n)} />)
          )}
        </ScrollArea>
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setOpen(false);
              navigate({ to: "/app/notifications" as never });
            }}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
