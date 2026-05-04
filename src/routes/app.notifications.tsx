import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from "@/hooks/use-notifications";
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import { useMemo } from "react";

export const Route = createFileRoute("/app/notifications")({
  component: NotificationsPage,
});

function bucket(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisWeek(date)) return "This week";
  return "Earlier";
}

function NotificationsPage() {
  const { data: notifications = [], isLoading } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();
  const navigate = useNavigate();

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof notifications>();
    for (const n of notifications) {
      const k = bucket(new Date(n.created_at));
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(n);
    }
    return Array.from(groups.entries());
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
            <Check className="mr-2 h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Bell className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="text-lg font-medium">No notifications yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">When teammates assign or mention you, it'll show up here.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {grouped.map(([label, items]) => (
              <section key={label}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h2>
                <div className="overflow-hidden rounded-lg border border-border">
                  {items.map((n) => {
                    const unread = !n.read_at;
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (unread) markRead.mutate(n.id);
                          if (n.link) navigate({ to: n.link as never });
                        }}
                        className={`relative flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-accent/50 ${
                          unread ? "bg-primary/5" : ""
                        }`}
                      >
                        {unread && <span className="absolute left-0 top-0 h-full w-[3px] bg-primary" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">{n.title}</p>
                          {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground" title={format(new Date(n.created_at), "PPpp")}>
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
