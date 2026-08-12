import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, addHours, addDays, nextMonday, set } from "date-fns";
import {
  AtSign, Bell, Bot, CheckCheck, Clock, Inbox, MessageSquare, Archive, ArrowUpRight,
  AlarmClock, UserPlus, ShieldAlert, MailOpen, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/loading-scaffolds";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useInbox, useInboxActions, type InboxItem, type InboxKind } from "@/hooks/use-inbox";
import { PriorityStream } from "@/components/inbox/PriorityStream";

export const Route = createFileRoute("/app/inbox")({
  component: InboxPage,
});

type Filter = "all" | "unread" | "snoozed" | "archived";

const KIND_META: Record<InboxKind, { label: string; icon: typeof Bell; tone: string }> = {
  mention: { label: "Mention", icon: AtSign, tone: "text-primary" },
  assignment: { label: "Assigned", icon: UserPlus, tone: "text-blue-500" },
  due_soon: { label: "Due", icon: AlarmClock, tone: "text-amber-500" },
  approval: { label: "Approval", icon: ShieldAlert, tone: "text-purple-500" },
  agent: { label: "Agent", icon: Bot, tone: "text-fuchsia-500" },
  comment: { label: "Comment", icon: MessageSquare, tone: "text-foreground/70" },
  channel_message: { label: "Chat", icon: MessageSquare, tone: "text-foreground/70" },
  portal: { label: "Client", icon: Inbox, tone: "text-emerald-500" },
  other: { label: "Update", icon: Bell, tone: "text-foreground/70" },
};

function bucketLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return "This week";
  return "Earlier";
}

function isActive(it: InboxItem, now: number) {
  if (it.archived_at) return false;
  if (it.snoozed_until && new Date(it.snoozed_until).getTime() > now) return false;
  return true;
}

function InboxPage() {
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useInbox();
  const { markRead, markUnread, archive, snooze, markAllRead } = useInboxActions();
  const [filter, setFilter] = useState<Filter>("all");
  const [kindFilter, setKindFilter] = useState<InboxKind | "any">("any");

  const now = Date.now();

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (kindFilter !== "any" && it.kind !== kindFilter) return false;
      if (filter === "all") return isActive(it, now);
      if (filter === "unread") return isActive(it, now) && !it.read_at;
      if (filter === "snoozed")
        return !it.archived_at && it.snoozed_until && new Date(it.snoozed_until).getTime() > now;
      if (filter === "archived") return !!it.archived_at;
      return true;
    });
  }, [items, filter, kindFilter, now]);

  const grouped = useMemo(() => {
    const map = new Map<string, InboxItem[]>();
    for (const it of filtered) {
      const k = bucketLabel(new Date(it.created_at));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const counts = useMemo(() => {
    let unread = 0;
    let snoozed = 0;
    let archived = 0;
    for (const it of items) {
      if (it.archived_at) {
        archived++;
        continue;
      }
      if (it.snoozed_until && new Date(it.snoozed_until).getTime() > now) {
        snoozed++;
        continue;
      }
      if (!it.read_at) unread++;
    }
    return { unread, snoozed, archived };
  }, [items, now]);

  const handleOpen = (it: InboxItem) => {
    if (!it.read_at && it.source === "notification") markRead.mutate(it.id);
    if (it.link) navigate({ to: it.link });
    else if (it.task_id && it.project_id) navigate({ to: `/app/p/${it.project_id}` });
  };

  return (
    <div className="animate-page-in mx-auto flex h-full max-w-4xl flex-col p-6">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="icon-tile h-10 w-10">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Inbox</h1>
            <p className="text-sm text-muted-foreground">
              Mentions, assignments, due work and approvals — one place to triage.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="press"
          onClick={() => markAllRead.mutate()}
          disabled={!counts.unread}
        >
          <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all read
        </Button>
      </header>

      <PriorityStream />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="unread">
            Unread {counts.unread > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{counts.unread}</Badge>}
          </ToggleGroupItem>
          <ToggleGroupItem value="snoozed">
            Snoozed {counts.snoozed > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{counts.snoozed}</Badge>}
          </ToggleGroupItem>
          <ToggleGroupItem value="archived">
            Archived
          </ToggleGroupItem>
        </ToggleGroup>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              {kindFilter === "any" ? "Any type" : KIND_META[kindFilter].label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setKindFilter("any")}>Any type</DropdownMenuItem>
            {(Object.keys(KIND_META) as InboxKind[]).map((k) => (
              <DropdownMenuItem key={k} onClick={() => setKindFilter(k)}>
                {KIND_META[k].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-4">
            <ListSkeleton rows={6} />
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <MailOpen className="h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">You're all caught up.</p>
            <p className="text-xs">Nothing here. Go ship something.</p>
          </div>
        ) : (
          grouped.map(([label, list]) => (
            <div key={label}>
              <div className="sticky top-0 z-[1] border-b border-border bg-card/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                {label}
              </div>
              {list.map((it) => (
                <InboxRow
                  key={it.id}
                  item={it}
                  onOpen={handleOpen}
                  onMarkRead={(id) => markRead.mutate(id)}
                  onMarkUnread={(id) => markUnread.mutate(id)}
                  onArchive={(id) => archive.mutate(id)}
                  onSnooze={(id, until) => snooze.mutate({ inboxId: id, until })}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function InboxRow({
  item,
  onOpen,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onSnooze,
}: {
  item: InboxItem;
  onOpen: (it: InboxItem) => void;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
  onArchive: (id: string) => void;
  onSnooze: (id: string, until: Date) => void;
}) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const isNotif = item.source === "notification";
  const unread = !item.read_at && isNotif;

  const snoozeOptions = [
    { label: "1 hour", at: () => addHours(new Date(), 1) },
    { label: "Later today", at: () => set(new Date(), { hours: 18, minutes: 0, seconds: 0 }) },
    { label: "Tomorrow", at: () => set(addDays(new Date(), 1), { hours: 9, minutes: 0, seconds: 0 }) },
    { label: "Next week", at: () => set(nextMonday(new Date()), { hours: 9, minutes: 0, seconds: 0 }) },
  ];

  return (
    <div
      className={cn(
        "group flex items-start gap-3 border-b border-border/60 px-4 py-3 transition-colors hover:bg-accent/40",
        unread && "bg-primary/[0.04]",
      )}
    >
      <button
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted transition-transform group-hover:scale-110", meta.tone)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {unread && <span className="pulse-soft h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
            <span className={cn("truncate text-sm", unread && "font-semibold")}>{item.title}</span>
          </div>
          {item.body && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
          )}
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium uppercase tracking-wide">{meta.label}</span>
            <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
            {item.snoozed_until && new Date(item.snoozed_until).getTime() > Date.now() && (
              <span className="flex items-center gap-1 text-amber-600">
                <Clock className="h-3 w-3" />
                until {new Date(item.snoozed_until).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {isNotif && (unread ? (
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Mark read" onClick={() => onMarkRead(item.id)}>
            <CheckCheck className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Mark unread" onClick={() => onMarkUnread(item.id)}>
            <Bell className="h-3.5 w-3.5" />
          </Button>
        ))}
        {isNotif && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Snooze">
                <Clock className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {snoozeOptions.map((o) => (
                <DropdownMenuItem key={o.label} onClick={() => onSnooze(item.id, o.at())}>
                  {o.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {isNotif && (
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Archive" onClick={() => onArchive(item.id)}>
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
        {item.link && (
          <Link to={item.link} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
